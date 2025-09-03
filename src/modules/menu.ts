/**
 * Module: UI - Menu
 * Purpose: Register a menu
 *
 * Lifecycle:
 * - Register: onStartup
 * - Unregister: onShutdown
 * - Requires manual unregister: No, handled by Zotero Plugin Toolkit
 */

import { getString } from "../utils/locale";

export function registerRightClickMenuItem() {
  const menuIcon = `chrome://${addon.data.config.addonRef}/content/icons/favicon@0.5x.png`;
  // item menuitem with icon
  ztoolkit.Menu.register("item", {
    tag: "menuitem",
    id: "zotero-itemmenu-addontemplate-test",
    label: getString("menuitem-label"),
    commandListener: (ev) => addon.hooks.onDialogEvents("dialogExample"),
    icon: menuIcon,
  });
}

export function registerRightClickMenuPopup(win: Window) {
  ztoolkit.Menu.register(
    "item",
    {
      tag: "menu",
      label: getString("menupopup-label"),
      children: [
        {
          tag: "menuitem",
          label: getString("menuitem-submenulabel"),
          oncommand: "alert('Hello World! Sub Menuitem.')",
        },
      ],
    },
    "before",
    win.document?.querySelector(
      "#zotero-itemmenu-addontemplate-test",
    ) as XUL.MenuItem,
  );
}

export function registerWindowMenuWithSeparator() {
  ztoolkit.Menu.register("menuFile", {
    tag: "menuseparator",
  });
  // menu->File menuitem
  ztoolkit.Menu.register("menuFile", {
    tag: "menuitem",
    label: getString("menuitem-filemenulabel"),
    oncommand: "alert('Hello World! File Menuitem.')",
  });
}
