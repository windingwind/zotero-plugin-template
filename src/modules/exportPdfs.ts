import { getString } from "../utils/locale";
import { getPref, setPref } from "../utils/prefs";

// ── Manifest types ──────────────────────────────────────────────

const MANIFEST_FILENAME = ".zotero-export-manifest.json";
const MANIFEST_VERSION = 1;

interface ManifestEntry {
  destFilename: string;
  size: number;
  lastModified: number;
  collectionKeys: string[];
}

interface Manifest {
  version: number;
  lastExport: string;
  files: Record<string, ManifestEntry>;
}

// ── Gathered PDF info ───────────────────────────────────────────

interface PdfInfo {
  sourcePath: string;
  destFilename: string;
  size: number;
  lastModified: number;
}

// ── Main class ──────────────────────────────────────────────────

export class ExportPdfsFactory {
  /**
   * Register a right-click menu item on the collection context menu.
   */
  static registerCollectionMenuItem() {
    const menuIcon = `chrome://${addon.data.config.addonRef}/content/icons/favicon@0.5x.png`;
    ztoolkit.Menu.register("collection", {
      tag: "menuitem",
      id: "zotero-collectionmenu-export-pdfs",
      label: getString("menuitem-export-collection-pdfs"),
      commandListener: (_ev) =>
        addon.hooks.onDialogEvents("exportCollectionPdfs"),
      icon: menuIcon,
    });
  }

  /**
   * Register a right-click menu item on the item context menu.
   */
  static registerItemMenuItem() {
    const menuIcon = `chrome://${addon.data.config.addonRef}/content/icons/favicon@0.5x.png`;
    ztoolkit.Menu.register("item", {
      tag: "menuitem",
      id: "zotero-itemmenu-export-pdfs",
      label: getString("menuitem-export-selected-pdfs"),
      commandListener: (_ev) =>
        addon.hooks.onDialogEvents("exportSelectedPdfs"),
      icon: menuIcon,
    });
  }

  /**
   * Export PDFs from the currently selected collection.
   */
  static async exportCollectionPdfs() {
    const zoteroPane = ztoolkit.getGlobal("ZoteroPane");
    const collection = zoteroPane.getSelectedCollection();
    if (!collection) {
      new ztoolkit.ProgressWindow(addon.data.config.addonName)
        .createLine({
          text: getString("export-pdfs-no-collection"),
          type: "fail",
          progress: 100,
        })
        .show();
      return;
    }

    const destFolder = await this.pickExportFolder();
    if (!destFolder) return;

    const recursive = getPref("exportPdfRecursive") as boolean;
    const items = recursive
      ? this.getCollectionItemsRecursive(collection)
      : collection.getChildItems();

    const pdfList = await this.gatherPdfAttachments(items);

    if (pdfList.length === 0) {
      new ztoolkit.ProgressWindow(addon.data.config.addonName)
        .createLine({
          text: getString("export-pdfs-no-pdfs"),
          type: "fail",
          progress: 100,
        })
        .show();
      return;
    }

    const collectionKey = collection.key;
    await this.syncPdfsWithProgress(pdfList, destFolder, collectionKey);
  }

  /**
   * Export PDFs from the currently selected items.
   * No orphan cleanup (no collection scope).
   */
  static async exportSelectedItemsPdfs() {
    const zoteroPane = ztoolkit.getGlobal("ZoteroPane");
    const items = zoteroPane.getSelectedItems();
    if (!items || items.length === 0) return;

    const destFolder = await this.pickExportFolder();
    if (!destFolder) return;

    const pdfList = await this.gatherPdfAttachments(items);

    if (pdfList.length === 0) {
      new ztoolkit.ProgressWindow(addon.data.config.addonName)
        .createLine({
          text: getString("export-pdfs-no-pdfs"),
          type: "fail",
          progress: 100,
        })
        .show();
      return;
    }

    // Item-level export: no collection key, skip orphan cleanup
    await this.syncPdfsWithProgress(pdfList, destFolder, null);
  }

  // ── Folder picker ───────────────────────────────────────────

  private static async pickExportFolder(): Promise<string | false> {
    const lastPath = getPref("exportPdfPath") as string;

    const fp = ztoolkit
      .getGlobal("Components")
      .classes[
        "@mozilla.org/filepicker;1"
      ].createInstance(ztoolkit.getGlobal("Components").interfaces.nsIFilePicker);

    const win = ztoolkit.getGlobal("Zotero").getMainWindow();
    fp.init(win, getString("export-pdfs-pick-folder"), fp.modeGetFolder);

    if (lastPath) {
      try {
        fp.displayDirectory = ztoolkit
          .getGlobal("Components")
          .classes[
            "@mozilla.org/file/local;1"
          ].createInstance(ztoolkit.getGlobal("Components").interfaces.nsIFile);
        fp.displayDirectory.initWithPath(lastPath);
      } catch {
        // Ignore if last path is invalid
      }
    }

    const result = await new Promise<number>((resolve) => {
      fp.open(resolve);
    });

    if (result !== fp.returnOK) {
      return false;
    }

    const selectedPath = fp.file.path;
    setPref("exportPdfPath", selectedPath);
    return selectedPath;
  }

  // ── Collection traversal ────────────────────────────────────

  private static getCollectionItemsRecursive(
    collection: Zotero.Collection,
  ): Zotero.Item[] {
    const items: Zotero.Item[] = [...collection.getChildItems()];
    const childCollections = collection.getChildCollections();
    for (const child of childCollections) {
      items.push(...this.getCollectionItemsRecursive(child));
    }
    return items;
  }

  // ── Gather PDF attachments with stat info ───────────────────

  private static async gatherPdfAttachments(
    items: Zotero.Item[],
  ): Promise<PdfInfo[]> {
    const results: PdfInfo[] = [];
    const seenPaths = new Set<string>();

    for (const item of items) {
      if (!item.isRegularItem()) continue;

      const attachmentIDs = item.getAttachments();
      for (const attID of attachmentIDs) {
        const attachment = await Zotero.Items.getAsync(attID);
        if (!attachment) continue;

        const contentType = attachment.attachmentContentType;
        if (contentType !== "application/pdf") continue;

        const filePath = (await attachment.getFilePath()) as string;
        if (!filePath || seenPaths.has(filePath)) continue;
        seenPaths.add(filePath);

        // Get file stats for change detection
        try {
          const stat = await IOUtils.stat(filePath);
          const destFilename = this.buildPdfFilename(item, filePath);
          results.push({
            sourcePath: filePath,
            destFilename,
            size: stat.size ?? 0,
            lastModified: stat.lastModified ?? 0,
          });
        } catch {
          // File not accessible, skip
          ztoolkit.log(`Cannot stat file: ${filePath}`);
        }
      }
    }
    return results;
  }

  // ── Filename builder ────────────────────────────────────────

  private static buildPdfFilename(
    parentItem: Zotero.Item,
    originalPath: string,
  ): string {
    const originalFilename = PathUtils.filename(originalPath);
    try {
      const parts: string[] = [];

      const firstCreator = parentItem.firstCreator;
      if (firstCreator) {
        parts.push(firstCreator);
      }

      const date = parentItem.getField("date") as string;
      if (date) {
        const year = date.substring(0, 4);
        if (year && year !== "0000") {
          parts.push(year);
        }
      }

      const title = parentItem.getField("title") as string;

      if (parts.length === 0 && !title) {
        return originalFilename;
      }

      let name = parts.join(" ");
      if (title) {
        if (name) name += " - ";
        name += title.length > 100 ? title.substring(0, 100) : title;
      }

      // Sanitize: remove characters invalid on Windows/Mac/Linux
      name = name
        .replace(/[<>:"/\\|?*]/g, "_")
        .replace(/\s+/g, " ")
        .trim();

      return name + ".pdf";
    } catch {
      return originalFilename;
    }
  }

  // ── Manifest I/O ────────────────────────────────────────────

  private static async loadManifest(destFolder: string): Promise<Manifest> {
    const manifestPath = PathUtils.join(destFolder, MANIFEST_FILENAME);
    try {
      const exists = await IOUtils.exists(manifestPath);
      if (!exists) {
        return { version: MANIFEST_VERSION, lastExport: "", files: {} };
      }
      const text = await IOUtils.readUTF8(manifestPath);
      const parsed = JSON.parse(text) as Manifest;
      if (parsed.version !== MANIFEST_VERSION) {
        return { version: MANIFEST_VERSION, lastExport: "", files: {} };
      }
      return parsed;
    } catch {
      ztoolkit.log("Manifest unreadable, starting fresh");
      return { version: MANIFEST_VERSION, lastExport: "", files: {} };
    }
  }

  private static async saveManifest(
    destFolder: string,
    manifest: Manifest,
  ): Promise<void> {
    const manifestPath = PathUtils.join(destFolder, MANIFEST_FILENAME);
    manifest.lastExport = new Date().toISOString();
    await IOUtils.writeUTF8(manifestPath, JSON.stringify(manifest, null, 2));
  }

  // ── Core sync logic ─────────────────────────────────────────

  /**
   * Smart sync: skip unchanged, overwrite updated, add new, remove orphans.
   * @param collectionKey  Enables orphan cleanup scoped to this collection.
   *                       If null (item-level export), orphan cleanup is skipped.
   */
  private static async syncPdfsWithProgress(
    pdfList: PdfInfo[],
    destFolder: string,
    collectionKey: string | null,
  ) {
    let added = 0;
    let updated = 0;
    let skipped = 0;
    let deleted = 0;

    const popupWin = new ztoolkit.ProgressWindow(addon.data.config.addonName, {
      closeOnClick: true,
      closeTime: -1,
    })
      .createLine({
        text: getString("export-pdfs-start"),
        type: "default",
        progress: 0,
      })
      .show();

    // Ensure destination directory exists
    try {
      const exists = await IOUtils.exists(destFolder);
      if (!exists) {
        await IOUtils.makeDirectory(destFolder, { createAncestors: true });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      popupWin.changeLine({
        text: getString("export-pdfs-error", { args: { message: msg } }),
        type: "fail",
        progress: 100,
      });
      popupWin.startCloseTimer(5000);
      return;
    }

    const manifest = await this.loadManifest(destFolder);
    const total = pdfList.length;
    const currentSourcePaths = new Set<string>();

    // ── Process each PDF ──────────────────────────────────────

    for (let i = 0; i < total; i++) {
      const pdf = pdfList[i];
      currentSourcePaths.add(pdf.sourcePath);
      const percent = Math.round(((i + 1) / total) * 100);

      popupWin.changeLine({
        progress: percent,
        text: getString("export-pdfs-copying", {
          args: {
            percent,
            current: i + 1,
            total,
            filename: pdf.destFilename,
          },
        }),
      });

      try {
        const existing = manifest.files[pdf.sourcePath];

        if (existing) {
          // ── Source path known in manifest ──
          const filenameChanged = existing.destFilename !== pdf.destFilename;
          const fileChanged =
            existing.size !== pdf.size ||
            existing.lastModified !== pdf.lastModified;

          if (!fileChanged && !filenameChanged) {
            // Check if dest file still exists (user may have deleted it)
            const destPath = PathUtils.join(destFolder, existing.destFilename);
            if (await IOUtils.exists(destPath)) {
              // Unchanged — just update collection keys and skip
              if (collectionKey) {
                this.addCollectionKey(existing, collectionKey);
              }
              skipped++;
              continue;
            }
            // Dest file missing — need to re-copy (fall through)
          }

          // File changed or filename changed — delete old dest file first
          if (filenameChanged && existing.destFilename) {
            const oldPath = PathUtils.join(destFolder, existing.destFilename);
            try {
              if (await IOUtils.exists(oldPath)) {
                await IOUtils.remove(oldPath);
              }
            } catch {
              // Best-effort old file cleanup
            }
          }

          // Copy / overwrite
          const destPath = PathUtils.join(destFolder, pdf.destFilename);
          await IOUtils.copy(pdf.sourcePath, destPath);

          existing.destFilename = pdf.destFilename;
          existing.size = pdf.size;
          existing.lastModified = pdf.lastModified;
          if (collectionKey) {
            this.addCollectionKey(existing, collectionKey);
          }
          updated++;
        } else {
          // ── New file — not in manifest ──
          const destPath = PathUtils.join(destFolder, pdf.destFilename);
          await IOUtils.copy(pdf.sourcePath, destPath);

          manifest.files[pdf.sourcePath] = {
            destFilename: pdf.destFilename,
            size: pdf.size,
            lastModified: pdf.lastModified,
            collectionKeys: collectionKey ? [collectionKey] : [],
          };
          added++;
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        ztoolkit.log(`Error syncing ${pdf.sourcePath}: ${msg}`);
        skipped++;
      }
    }

    // ── Orphan cleanup (only for collection-level exports) ────

    if (collectionKey) {
      const orphanKeys: string[] = [];
      for (const [sourcePath, entry] of Object.entries(manifest.files)) {
        if (currentSourcePaths.has(sourcePath)) continue;
        if (!entry.collectionKeys.includes(collectionKey)) continue;

        // Previously exported from this collection, now gone
        this.removeCollectionKey(entry, collectionKey);

        if (entry.collectionKeys.length === 0) {
          // No collections reference this file — safe to delete
          const orphanPath = PathUtils.join(destFolder, entry.destFilename);
          try {
            if (await IOUtils.exists(orphanPath)) {
              await IOUtils.remove(orphanPath);
              deleted++;
            }
          } catch {
            ztoolkit.log(`Failed to delete orphan: ${orphanPath}`);
          }
          orphanKeys.push(sourcePath);
        }
      }

      for (const key of orphanKeys) {
        delete manifest.files[key];
      }
    }

    // ── Save manifest and show results ────────────────────────

    try {
      await this.saveManifest(destFolder, manifest);
    } catch (e: unknown) {
      ztoolkit.log(
        `Failed to save manifest: ${e instanceof Error ? e.message : String(e)}`,
      );
    }

    popupWin.changeLine({
      progress: 100,
      text: getString("export-pdfs-done", {
        args: { added, updated, skipped, deleted },
      }),
      type: added > 0 || updated > 0 ? "success" : "default",
    });
    popupWin.startCloseTimer(5000);
  }

  // ── Collection key helpers ──────────────────────────────────

  private static addCollectionKey(entry: ManifestEntry, key: string): void {
    if (!entry.collectionKeys.includes(key)) {
      entry.collectionKeys.push(key);
    }
  }

  private static removeCollectionKey(entry: ManifestEntry, key: string): void {
    const idx = entry.collectionKeys.indexOf(key);
    if (idx !== -1) {
      entry.collectionKeys.splice(idx, 1);
    }
  }
}
