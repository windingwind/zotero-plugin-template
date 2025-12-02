/**
 * Module: UI - ExtraColumn
 * Purpose: Add a custom column to the Zotero item list
 *
 * Lifecycle:
 * - Register: onStartup
 * - Unregister: onShutdown
 * - Requires manual unregister: No, handled by Zotero
 */

export async function registerExtraColumn() {
  const field = "test1";
  await Zotero.ItemTreeManager.registerColumns({
    pluginID: addon.data.config.addonID,
    dataKey: field,
    label: "text column",
    dataProvider: (item: Zotero.Item, dataKey: string) => {
      return field + String(item.id);
    },
    iconPath: "chrome://zotero/skin/cross.png",
  });
}

export async function registerExtraColumnWithCustomCell() {
  const field = "test2";
  await Zotero.ItemTreeManager.registerColumns({
    pluginID: addon.data.config.addonID,
    dataKey: field,
    label: "custom column",
    dataProvider: (item: Zotero.Item, dataKey: string) => {
      return field + String(item.id);
    },
    renderCell(index, data, column, isFirstColumn, doc) {
      ztoolkit.log("Custom column cell is rendered!");
      const span = doc.createElement("span");
      span.className = `cell ${column.className}`;
      span.style.background = "#0dd068";
      span.innerText = "⭐" + data;
      return span;
    },
  });
}
