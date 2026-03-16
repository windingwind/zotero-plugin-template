import { getPref } from "../utils/prefs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type EndpointResponse =
  | number
  | [code: number, contentType?: string | Record<string, string>, body?: string];

function jsonResponse(status: number, data: unknown): EndpointResponse {
  return [status, "application/json", JSON.stringify(data)];
}

function errorResponse(
  status: number,
  message: string,
  code: string,
): EndpointResponse {
  return jsonResponse(status, { error: message, code });
}

function checkAuth(headers: Record<string, string>): EndpointResponse | null {
  if (!getPref("apiEnabled")) {
    return errorResponse(403, "API is disabled", "API_DISABLED");
  }
  const apiKey = getPref("apiKey");
  if (apiKey && apiKey.length > 0) {
    const provided = headers["X-API-Key"] || headers["x-api-key"] || "";
    if (provided !== apiKey) {
      return errorResponse(401, "Invalid API key", "UNAUTHORIZED");
    }
  }
  return null; // auth OK
}

/** Extract a single identifier object from various input shapes. */
function normalizeIdentifiers(
  data: any,
): Array<Record<string, string>> | null {
  if (!data) return null;

  // Array form: { identifiers: [...] }
  if (Array.isArray(data.identifiers)) {
    return data.identifiers;
  }

  // Single identifier shorthand: { DOI: "..." } or { ISBN: "..." } etc.
  for (const key of ["DOI", "ISBN", "PMID", "arXiv"]) {
    if (typeof data[key] === "string") {
      return [{ [key]: data[key] }];
    }
  }

  return null;
}

function serializeItem(item: any): Record<string, any> {
  const creators = item.getCreators
    ? item.getCreators().map((c: any) => ({
        firstName: c.firstName || "",
        lastName: c.lastName || "",
        creatorType: c.creatorType || "author",
      }))
    : [];

  return {
    itemID: item.id,
    key: item.key,
    itemType: item.itemType,
    title: item.getField ? item.getField("title") : "",
    creators,
    date: item.getField ? item.getField("date") : "",
    DOI: item.getField ? item.getField("DOI") : "",
    ISBN: item.getField ? item.getField("ISBN") : "",
    abstractNote: item.getField ? item.getField("abstractNote") : "",
    url: item.getField ? item.getField("url") : "",
  };
}

// ---------------------------------------------------------------------------
// Endpoint: POST /litpdfexport/addByIdentifier
// ---------------------------------------------------------------------------

const AddByIdentifierEndpoint = class {
  supportedMethods = ["POST"];
  supportedDataTypes = ["application/json"];
  permitBookmarklet = false;

  async init(options: {
    method: "GET" | "POST";
    pathname: string;
    query: Record<string, string>;
    headers: Record<string, string>;
    data: any;
  }): Promise<EndpointResponse> {
    try {
      const authErr = checkAuth(options.headers);
      if (authErr) return authErr;

      const data =
        typeof options.data === "string"
          ? JSON.parse(options.data)
          : options.data;

      const identifiers = normalizeIdentifiers(data);
      if (!identifiers || identifiers.length === 0) {
        return errorResponse(
          400,
          "Missing or invalid identifiers. Provide { identifiers: [{ DOI: ... }] } or { DOI: ... }",
          "INVALID_REQUEST",
        );
      }

      const maxBatch = getPref("apiMaxBatchSize") || 50;
      if (identifiers.length > maxBatch) {
        return errorResponse(
          400,
          `Batch size ${identifiers.length} exceeds max ${maxBatch}`,
          "BATCH_TOO_LARGE",
        );
      }

      const libraryID =
        data.libraryID ?? (Zotero.Libraries as any).userLibraryID;
      const collectionID = data.collectionID ?? null;

      const success: any[] = [];
      const failed: any[] = [];

      for (const identifier of identifiers) {
        try {
          // Use Zotero.Translate.Search to look up the identifier
          const translate = new (Zotero as any).Translate.Search();
          translate.setIdentifier(identifier);

          const translators = await translate.getTranslators();
          if (!translators || translators.length === 0) {
            failed.push({
              identifier,
              error: "No translators found for this identifier",
            });
            continue;
          }

          translate.setTranslator(translators);
          const items = await translate.translate({ libraryID });

          if (!items || items.length === 0) {
            failed.push({
              identifier,
              error: "Translation returned no items",
            });
            continue;
          }

          // Optionally add to collection
          if (collectionID) {
            for (const item of items) {
              const collection = await Zotero.Collections.getAsync(
                collectionID,
              );
              if (collection) {
                collection.addItem(item.id);
                await collection.saveTx();
              }
            }
          }

          for (const item of items) {
            success.push({
              identifier,
              itemID: item.id,
              key: item.key,
              title: item.getField ? item.getField("title") : "",
            });
          }
        } catch (e: any) {
          failed.push({
            identifier,
            error: e.message || String(e),
          });
        }
      }

      return jsonResponse(200, { success, failed });
    } catch (e: any) {
      return errorResponse(500, e.message || String(e), "INTERNAL_ERROR");
    }
  }
};

// ---------------------------------------------------------------------------
// Endpoint: GET /litpdfexport/search
// ---------------------------------------------------------------------------

const SearchEndpoint = class {
  supportedMethods = ["GET"];
  supportedDataTypes = ["application/json"];
  permitBookmarklet = false;

  async init(options: {
    method: "GET" | "POST";
    pathname: string;
    query: Record<string, string>;
    headers: Record<string, string>;
    data: any;
  }): Promise<EndpointResponse> {
    try {
      const authErr = checkAuth(options.headers);
      if (authErr) return authErr;

      const q = options.query.q;
      if (!q) {
        return errorResponse(400, "Missing required query parameter: q", "INVALID_REQUEST");
      }

      const libraryID = options.query.libraryID
        ? parseInt(options.query.libraryID, 10)
        : (Zotero.Libraries as any).userLibraryID;

      const limit = Math.min(
        parseInt(options.query.limit || "20", 10) || 20,
        100,
      );

      const field = options.query.field || "any";

      const search = new Zotero.Search({ libraryID });

      switch (field) {
        case "title":
          search.addCondition("title", "contains", q);
          break;
        case "creator":
          search.addCondition("creator", "contains", q);
          break;
        case "doi":
          search.addCondition("DOI", "is", q);
          break;
        case "isbn":
          search.addCondition("ISBN", "is", q);
          break;
        case "year":
          search.addCondition("date", "is", q);
          break;
        default:
          search.addCondition("quicksearch-titleCreatorYear", "contains", q);
          break;
      }

      const ids = await search.search();
      const sliced = ids.slice(0, limit);
      const items = await Zotero.Items.getAsync(sliced);

      const results = items
        .filter((item: any) => item.isRegularItem())
        .map(serializeItem);

      return jsonResponse(200, { results, total: results.length });
    } catch (e: any) {
      return errorResponse(500, e.message || String(e), "INTERNAL_ERROR");
    }
  }
};

// ---------------------------------------------------------------------------
// Endpoint: GET /litpdfexport/collections
// ---------------------------------------------------------------------------

const CollectionsEndpoint = class {
  supportedMethods = ["GET"];
  supportedDataTypes = ["application/json"];
  permitBookmarklet = false;

  async init(options: {
    method: "GET" | "POST";
    pathname: string;
    query: Record<string, string>;
    headers: Record<string, string>;
    data: any;
  }): Promise<EndpointResponse> {
    try {
      const authErr = checkAuth(options.headers);
      if (authErr) return authErr;

      const libraryID = options.query.libraryID
        ? parseInt(options.query.libraryID, 10)
        : (Zotero.Libraries as any).userLibraryID;

      const collections = Zotero.Collections.getByLibrary(libraryID);
      const result = collections.map((col: any) => ({
        collectionID: col.id,
        key: col.key,
        name: col.name,
        parentID: col.parentID || null,
        itemCount: col.getChildItems().length,
      }));

      return jsonResponse(200, { collections: result });
    } catch (e: any) {
      return errorResponse(500, e.message || String(e), "INTERNAL_ERROR");
    }
  }
};

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

const ENDPOINT_PATHS = [
  "/litpdfexport/addByIdentifier",
  "/litpdfexport/search",
  "/litpdfexport/collections",
] as const;

export function registerApiEndpoints(): void {
  Zotero.Server.Endpoints["/litpdfexport/addByIdentifier"] =
    AddByIdentifierEndpoint as any;
  Zotero.Server.Endpoints["/litpdfexport/search"] = SearchEndpoint as any;
  Zotero.Server.Endpoints["/litpdfexport/collections"] =
    CollectionsEndpoint as any;

  Zotero.log(
    `[${addon.data.config.addonName}] API endpoints registered on localhost:23119`,
    "warning",
  );
}

export function unregisterApiEndpoints(): void {
  for (const path of ENDPOINT_PATHS) {
    delete Zotero.Server.Endpoints[path];
  }
}
