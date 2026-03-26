import { getString } from "../utils/locale";

export class FindPdfFactory {
  /**
   * Register a right-click menu item on the item context menu
   * to find and attach PDFs for selected items.
   */
  static registerItemMenuItem() {
    const menuIcon = `chrome://${addon.data.config.addonRef}/content/icons/favicon@0.5x.png`;
    ztoolkit.Menu.register("item", {
      tag: "menuitem",
      id: "zotero-itemmenu-find-pdf",
      label: getString("menuitem-find-pdf"),
      commandListener: (_ev) =>
        addon.hooks.onDialogEvents("findPdfForSelected"),
      icon: menuIcon,
    });
  }

  /**
   * Find and attach PDFs for the currently selected items.
   * Uses Zotero's built-in addAvailablePDF which resolves DOIs
   * through publisher sites, Unpaywall, and open-access repositories.
   */
  static async findPdfForSelectedItems() {
    const zoteroPane = ztoolkit.getGlobal("ZoteroPane");
    const items = zoteroPane.getSelectedItems();
    if (!items || items.length === 0) return;

    // Filter to regular items only (not attachments/notes)
    const regularItems = items.filter((item: any) => item.isRegularItem());
    if (regularItems.length === 0) return;

    const total = regularItems.length;
    let found = 0;
    let alreadyHas = 0;
    let notFound = 0;

    const popupWin = new ztoolkit.ProgressWindow(addon.data.config.addonName, {
      closeOnClick: true,
      closeTime: -1,
    })
      .createLine({
        text: getString("find-pdf-start"),
        type: "default",
        progress: 0,
      })
      .show();

    for (let i = 0; i < total; i++) {
      const item = regularItems[i];
      const title =
        (item.getField ? (item.getField("title") as string) : "") ||
        `Item ${item.id}`;
      const shortTitle =
        title.length > 40 ? title.substring(0, 40) + "..." : title;
      const percent = Math.round(((i + 1) / total) * 100);

      popupWin.changeLine({
        progress: percent,
        text: getString("find-pdf-searching", {
          args: {
            percent,
            current: i + 1,
            total,
            title: shortTitle,
          },
        }),
      });

      try {
        // Check if item already has a PDF
        const attachmentIDs = item.getAttachments();
        let hasPdf = false;
        for (const attID of attachmentIDs) {
          const att = await Zotero.Items.getAsync(attID);
          if (att && att.attachmentContentType === "application/pdf") {
            hasPdf = true;
            break;
          }
        }

        if (hasPdf) {
          alreadyHas++;
          continue;
        }

        const attachment = await Zotero.Attachments.addAvailablePDF(
          item as any,
        );
        if (attachment) {
          found++;
        } else {
          notFound++;
        }
      } catch (e: any) {
        ztoolkit.log(`Error finding PDF for item ${item.id}: ${e.message}`);
        notFound++;
      }
    }

    popupWin.changeLine({
      progress: 100,
      text: getString("find-pdf-done", {
        args: { found, alreadyHas, notFound },
      }),
      type: found > 0 ? "success" : "default",
    });
    popupWin.startCloseTimer(5000);
  }
}
