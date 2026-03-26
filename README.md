# Literature PDF Export for Zotero

[![zotero target version](https://img.shields.io/badge/Zotero-7-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)

A Zotero 7 plugin that exports PDF attachments from collections or selected items to a local folder (e.g. a Google Drive sync directory) with smart sync, configurable filename formats, and an HTTP API for LLM integration.

[English](README.md) | [繁體中文](doc/README-zhTW.md) | [简体中文](doc/README-zhCN.md)

## Features

- **Collection & Item Export** - Right-click a collection or selected items to export all PDF attachments to a chosen folder.
- **Smart Sync** - Manifest-based tracking avoids duplicates, updates changed files, and removes orphans automatically.
- **Configurable Filename Formats** - Choose from 7 built-in formats or define your own custom template:

  | Format                        | Example                                           |
  | ----------------------------- | ------------------------------------------------- |
  | Author Year - Title (default) | `Smith 2023 - Machine Learning.pdf`               |
  | BibTeX Citation Key           | `smith2023.pdf`                                   |
  | BibTeX Citation Key - Title   | `smith2023 - Machine Learning.pdf`                |
  | Better BibTeX Key             | `smithMachineLearning2023.pdf`                    |
  | Better BibTeX Key - Title     | `smithMachineLearning2023 - Machine Learning.pdf` |
  | Year_Title                    | `2023_Machine_Learning.pdf`                       |
  | Custom Template               | User-defined with placeholders                    |

- **Custom Template Placeholders** - `{author}`, `{year}`, `{title}`, `{citekey}`, `{bbt}`
- **Better BibTeX Integration** - Reads BBT citation keys from item metadata; falls back to auto-generated BibTeX key if BBT is not installed.
- **Multi-language Support** - English, Traditional Chinese, Simplified Chinese.
- **Find & Attach PDFs** - Right-click selected items to automatically find and download available PDFs from publishers, Unpaywall, and open-access repositories.
- **HTTP API for LLM Integration** - Expose REST endpoints on `localhost:23119` so that AI agents (Claude, Codex, etc.) can programmatically import items, find PDFs, and query the library.

## Installation

1. Download the latest `.xpi` file from [Releases](https://github.com/email81227/zotero-liturature-survey-plugin/releases).
2. In Zotero, go to `Tools` > `Add-ons`.
3. Click the gear icon and select `Install Add-on From File...`.
4. Select the downloaded `.xpi` file.

## Usage

### Export from Collection

1. Right-click on a collection in the left panel.
2. Select **Export Collection PDFs to Folder...**
3. Choose a destination folder.

### Export Selected Items

1. Select one or more items in the middle panel.
2. Right-click and select **Export Selected PDFs to Folder...**
3. Choose a destination folder.

### Configure Filename Format

1. Go to `Tools` > `Add-ons` > **Literature PDF Export** > `Preferences`.
2. Select your preferred filename format from the dropdown.
3. If using **Custom Template**, enter your template string with placeholders.

### HTTP API (for LLM Integration)

1. Go to `Tools` > `Add-ons` > **Literature PDF Export** > `Preferences`.
2. Enable **HTTP API** and optionally set an API key.
3. The following endpoints become available on `http://localhost:23119`:

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `POST` | `/litpdfexport/addByIdentifier` | Import items by DOI, ISBN, PMID, or arXiv ID |
| `GET`  | `/litpdfexport/search?q=...`    | Search existing library items |
| `GET`  | `/litpdfexport/collections`     | List all collections |
| `GET`  | `/litpdfexport/collection-items?name=...` | List all items in a collection |
| `POST` | `/litpdfexport/findPdf`                   | Find & attach PDFs for existing items |

**Example - Add by DOI:**

```bash
curl -X POST http://localhost:23119/litpdfexport/addByIdentifier \
  -H "Content-Type: application/json" \
  -d '{"DOI": "10.1038/nature12373"}'
```

**Example - Batch import:**

```bash
curl -X POST http://localhost:23119/litpdfexport/addByIdentifier \
  -H "Content-Type: application/json" \
  -d '{"identifiers": [{"DOI": "10.1038/nature12373"}, {"ISBN": "978-0-321-12521-7"}]}'
```

**Example - Find & attach PDF:**

```bash
curl -X POST http://localhost:23119/litpdfexport/findPdf \
  -H "Content-Type: application/json" \
  -d '{"itemID": 42}'
```

If an API key is set, include `X-API-Key: <your-key>` in the request headers.

## Smart Sync Behavior

The plugin maintains a `.zotero-export-manifest.json` file in the target folder to track exported files:

- **New files** are copied to the folder.
- **Changed files** (different size or modification time) are overwritten.
- **Unchanged files** are skipped.
- **Orphaned files** (no longer in the source collection) are removed.

This makes it safe to re-export the same collection repeatedly without creating duplicates.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS)
- [Git](https://git-scm.com/)
- [Zotero 7 Beta](https://www.zotero.org/support/beta_builds)

### Setup

```bash
git clone https://github.com/email81227/zotero-liturature-survey-plugin.git
cd zotero-liturature-survey-plugin
npm install
cp .env.example .env
# Edit .env to set your Zotero path
```

### Build

```bash
npm run build
```

The `.xpi` file will be generated in `.scaffold/build/`.

### Dev Mode (Hot Reload)

```bash
npm start
```

## License

AGPL-3.0-or-later

## Acknowledgements

Built with [Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template).
