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
// Duplicate-detection helpers
// ---------------------------------------------------------------------------

/**
 * Search Zotero library for an existing item matching the given identifier.
 * Returns the first matching regular item, or null.
 */
async function findExistingItem(
  identifier: Record<string, string>,
  libraryID: number,
): Promise<any | null> {
  // Map identifier keys to Zotero search fields
  const fieldMap: Record<string, { condition: string; operator: string }> = {
    DOI: { condition: "DOI", operator: "is" },
    ISBN: { condition: "ISBN", operator: "is" },
    PMID: { condition: "extra", operator: "contains" },
    arXiv: { condition: "extra", operator: "contains" },
  };

  for (const [key, value] of Object.entries(identifier)) {
    const mapping = fieldMap[key];
    if (!mapping) continue;

    // For PMID/arXiv, search the Extra field where Zotero stores them
    const searchValue =
      key === "PMID" ? `PMID: ${value}` : key === "arXiv" ? `arXiv: ${value}` : value;

    try {
      const search = new Zotero.Search({ libraryID });
      (search.addCondition as Function)(mapping.condition, mapping.operator, searchValue);
      const ids = await search.search();
      if (ids && ids.length > 0) {
        const items = await Zotero.Items.getAsync(ids);
        const regular = items.find((item: any) => item.isRegularItem());
        if (regular) return regular;
      }
    } catch (_e) {
      // Search failed — fall through to import
    }
  }
  return null;
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
      // skipDuplicateCheck defaults to false — callers must explicitly opt out
      const skipDuplicateCheck = data.skipDuplicateCheck === true;

      const success: any[] = [];
      const failed: any[] = [];
      const skipped: any[] = [];

      for (const identifier of identifiers) {
        try {
          // --- Duplicate check (unless caller explicitly opts out) ---
          if (!skipDuplicateCheck) {
            const existing = await findExistingItem(identifier, libraryID);
            if (existing) {
              skipped.push({
                identifier,
                itemID: existing.id,
                key: existing.key,
                title: existing.getField ? existing.getField("title") : "",
                reason: "Item already exists in library",
              });

              // Still add to collection if requested
              if (collectionID) {
                try {
                  const collection =
                    await Zotero.Collections.getAsync(collectionID);
                  if (collection) {
                    collection.addItem(existing.id);
                    await collection.saveTx();
                  }
                } catch (_e) {
                  // ignore collection error for existing item
                }
              }
              continue;
            }
          }

          // --- Import via Zotero.Translate.Search ---
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

      return jsonResponse(200, { success, skipped, failed });
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
// Endpoint: GET /litpdfexport/collection-items
// ---------------------------------------------------------------------------

const CollectionItemsEndpoint = class {
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

      // Resolve collection by ID or name
      let collection: any = null;

      if (options.query.collectionID) {
        collection = await Zotero.Collections.getAsync(
          parseInt(options.query.collectionID, 10),
        );
      } else if (options.query.name) {
        const allCollections = Zotero.Collections.getByLibrary(libraryID);
        collection = allCollections.find(
          (col: any) => col.name === options.query.name,
        );
      } else {
        return errorResponse(
          400,
          "Missing required query parameter: collectionID or name",
          "INVALID_REQUEST",
        );
      }

      if (!collection) {
        return errorResponse(400, "Collection not found", "INVALID_REQUEST");
      }

      const limit = Math.min(
        parseInt(options.query.limit || "100", 10) || 100,
        500,
      );

      const childItems = collection.getChildItems();
      const regularItems = childItems
        .filter((item: any) => item.isRegularItem())
        .slice(0, limit)
        .map(serializeItem);

      return jsonResponse(200, {
        collectionID: collection.id,
        collectionName: collection.name,
        items: regularItems,
        total: regularItems.length,
      });
    } catch (e: any) {
      return errorResponse(500, e.message || String(e), "INTERNAL_ERROR");
    }
  }
};

// ---------------------------------------------------------------------------
// Endpoint: POST /litpdfexport/findPdf
// ---------------------------------------------------------------------------

const FindPdfEndpoint = class {
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

      // Resolve target items: single itemID, array of itemIDs, or DOI lookup
      const itemIDs: number[] = [];

      if (Array.isArray(data.itemIDs)) {
        itemIDs.push(...data.itemIDs);
      } else if (typeof data.itemID === "number") {
        itemIDs.push(data.itemID);
      } else if (typeof data.DOI === "string") {
        // Look up items by DOI
        const libraryID =
          data.libraryID ?? (Zotero.Libraries as any).userLibraryID;
        const search = new Zotero.Search({ libraryID });
        search.addCondition("DOI", "is", data.DOI);
        const ids = await search.search();
        if (ids.length === 0) {
          return errorResponse(
            400,
            `No item found with DOI: ${data.DOI}`,
            "INVALID_REQUEST",
          );
        }
        itemIDs.push(...ids);
      } else {
        return errorResponse(
          400,
          "Provide itemID, itemIDs, or DOI",
          "INVALID_REQUEST",
        );
      }

      const maxBatch = (getPref("apiMaxBatchSize") as number) || 50;
      if (itemIDs.length > maxBatch) {
        return errorResponse(
          400,
          `Batch size ${itemIDs.length} exceeds max ${maxBatch}`,
          "BATCH_TOO_LARGE",
        );
      }

      const success: any[] = [];
      const failed: any[] = [];
      const skipped: any[] = [];

      for (const id of itemIDs) {
        try {
          const item = await Zotero.Items.getAsync(id);
          if (!item || !item.isRegularItem()) {
            failed.push({ itemID: id, error: "Item not found or not a regular item" });
            continue;
          }

          // Check if item already has a PDF attachment
          const existingAttachments = item.getAttachments();
          let hasPdf = false;
          for (const attID of existingAttachments) {
            const att = await Zotero.Items.getAsync(attID);
            if (att && att.attachmentContentType === "application/pdf") {
              hasPdf = true;
              skipped.push({
                itemID: id,
                key: item.key,
                title: item.getField ? (item.getField("title") as string) : "",
                reason: "PDF attachment already exists",
              });
              break;
            }
          }
          if (hasPdf) continue;

          // Use Zotero's built-in PDF finder
          const attachment = await Zotero.Attachments.addAvailablePDF(item as any);

          if (attachment) {
            success.push({
              itemID: id,
              key: item.key,
              title: item.getField ? (item.getField("title") as string) : "",
              attachmentID: attachment.id,
              attachmentKey: attachment.key,
            });
          } else {
            failed.push({
              itemID: id,
              key: item.key,
              title: item.getField ? (item.getField("title") as string) : "",
              error: "No available PDF found (check network access or publisher permissions)",
            });
          }
        } catch (e: any) {
          failed.push({ itemID: id, error: e.message || String(e) });
        }
      }

      return jsonResponse(200, { success, skipped, failed });
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
  "/litpdfexport/collection-items",
  "/litpdfexport/findPdf",
] as const;

export function registerApiEndpoints(): void {
  Zotero.Server.Endpoints["/litpdfexport/addByIdentifier"] =
    AddByIdentifierEndpoint as any;
  Zotero.Server.Endpoints["/litpdfexport/search"] = SearchEndpoint as any;
  Zotero.Server.Endpoints["/litpdfexport/collections"] =
    CollectionsEndpoint as any;
  Zotero.Server.Endpoints["/litpdfexport/collection-items"] =
    CollectionItemsEndpoint as any;
  Zotero.Server.Endpoints["/litpdfexport/findPdf"] = FindPdfEndpoint as any;

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
