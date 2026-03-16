# CLAUDE.md - Project Guide for Claude Code

## What This Project Is

A Zotero 7 plugin ("Literature PDF Export") that:
1. Exports PDF attachments to a local folder with smart sync
2. **Exposes HTTP API endpoints** on Zotero's built-in server (`localhost:23119`) for LLM-driven bibliographic import

## Using the HTTP API to Import References

### Prerequisites

- Zotero 7 desktop app must be running
- The plugin must be installed
- In Zotero Settings > Literature PDF Export, **enable the HTTP API** checkbox
- If an API key is set, include `X-API-Key: <key>` in all request headers

### Import a Single Item by DOI

```bash
curl -X POST http://localhost:23119/litpdfexport/addByIdentifier \
  -H "Content-Type: application/json" \
  -d '{"DOI": "10.1038/nature12373"}'
```

### Import a Single Item by ISBN

```bash
curl -X POST http://localhost:23119/litpdfexport/addByIdentifier \
  -H "Content-Type: application/json" \
  -d '{"ISBN": "978-0-321-12521-7"}'
```

### Supported Identifier Types

| Key     | Format Example          |
| ------- | ----------------------- |
| `DOI`   | `10.1038/nature12373`   |
| `ISBN`  | `978-0-321-12521-7`    |
| `PMID`  | `23842501`             |
| `arXiv` | `2301.07041`           |

### Batch Import (Multiple Identifiers)

```bash
curl -X POST http://localhost:23119/litpdfexport/addByIdentifier \
  -H "Content-Type: application/json" \
  -d '{
    "identifiers": [
      {"DOI": "10.1038/nature12373"},
      {"DOI": "10.1126/science.1234567"},
      {"ISBN": "978-0-321-12521-7"}
    ],
    "libraryID": 1,
    "collectionID": null
  }'
```

- `identifiers`: array of identifier objects (max 50 per request)
- `libraryID`: optional, defaults to user's personal library
- `collectionID`: optional, adds imported items to a specific collection

### Response Format

```json
{
  "success": [
    {
      "identifier": {"DOI": "10.1038/nature12373"},
      "itemID": 42,
      "key": "ABC12345",
      "title": "The article title"
    }
  ],
  "failed": [
    {
      "identifier": {"DOI": "10.9999/invalid"},
      "error": "No translators found for this identifier"
    }
  ]
}
```

### Search Existing Items

```bash
curl "http://localhost:23119/litpdfexport/search?q=machine+learning&limit=10"
```

Query parameters:
- `q` (required): search query
- `field`: `title`, `creator`, `doi`, `isbn`, `year`, or `any` (default)
- `limit`: max results, 1-100 (default 20)
- `libraryID`: optional

### List Collections

```bash
curl http://localhost:23119/litpdfexport/collections
```

### Error Codes

| HTTP Status | Code             | Meaning                    |
| ----------- | ---------------- | -------------------------- |
| 400         | `INVALID_REQUEST`  | Bad request body / params  |
| 401         | `UNAUTHORIZED`     | Wrong or missing API key   |
| 403         | `API_DISABLED`     | API not enabled in prefs   |
| 500         | `INTERNAL_ERROR`   | Unexpected server error    |

### Typical Workflow for an LLM Agent

1. Check if Zotero is running: `curl http://localhost:23119/connector/ping`
2. List collections to find target: `GET /litpdfexport/collections`
3. Search if item already exists: `GET /litpdfexport/search?q=<doi>&field=doi`
4. If not found, import: `POST /litpdfexport/addByIdentifier` with the DOI/ISBN
5. Verify import succeeded by checking the `success` array in the response

## Build & Development

```bash
npm install
npm run build    # produces .scaffold/build/literature-pdf-export.xpi
npm start        # dev mode with hot reload
```

## Project Structure (Key Files)

- `src/modules/apiEndpoints.ts` - HTTP API endpoint implementations
- `src/modules/exportPdfs.ts` - PDF export logic
- `src/hooks.ts` - Plugin lifecycle (registers API on startup)
- `addon/prefs.js` - Default preferences (apiEnabled, apiKey, apiMaxBatchSize)
- `addon/content/preferences.xhtml` - Settings UI
