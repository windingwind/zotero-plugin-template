/**
 * Module: UI - Menu
 * Purpose: Register a menu
 *
 * Lifecycle:
 * - Register: onStartup
 * - Unregister: onShutdown
 * - Requires manual unregister: No, handled by Zotero
 */

import { getLocaleID } from "../utils/locale";
import { config } from "../../package.json";

const icon = `chrome://${config.addonRef}/content/icons/favicon@0.5x.png`;

export function registerMenu() {
  Zotero.MenuManager.registerMenu({
    menuID: getLocaleID("menuitem-label"),
    pluginID: config.addonID,
    target: "main/library/item",
    menus: [
      // Menuitem example
      {
        menuType: "menuitem",
        l10nID: getLocaleID("menuitem-label"),
        icon,
        onCommand: (event, context) => {
          if (!context.items?.length) return;

          addon.hooks.onDialogEvents("dialogExample");
        },
      },

      // Submenu example
      {
        menuType: "submenu",
        l10nID: getLocaleID("menupopup-label"),
        icon,
        menus: [
          {
            menuType: "menuitem",
            l10nID: getLocaleID("menuitem-submenulabel"),
            icon,
            onCommand: (event, context) => {
              if (!context.items?.length) return;

              Zotero.getMainWindow().alert("Hello!");
            },
          },
        ],
      },
    ],
  });
}
