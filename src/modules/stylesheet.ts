/**
 * Module: StyleSheet
 * Purpose: Inject and manage custom stylesheets for Zotero windows
 *
 * Lifecycle:
 * - Register: onMainWindowLoad
 * - Unregister: onMainWindowUnload
 * - Requires manual unregister: Yes
 */

const stylePath = `chrome://${addon.data.config.addonRef}/content/zoteroPane.css`;

export function registerStyleSheet(win: _ZoteroTypes.MainWindow) {
  const doc = win.document;
  const styles = ztoolkit.UI.createElement(doc, "link", {
    properties: {
      type: "text/css",
      rel: "stylesheet",
      href: stylePath,
    },
  });
  doc.documentElement?.appendChild(styles);
  doc.getElementById("zotero-item-pane-content")?.classList.add("makeItRed");
}

export function unregisterStyleSheet(win: _ZoteroTypes.MainWindow) {
  const doc = win.document;
  const styles = doc.querySelector(`link[href="${stylePath}"]`);
  styles?.remove();
  doc.getElementById("zotero-item-pane-content")?.classList.remove("makeItRed");
}
