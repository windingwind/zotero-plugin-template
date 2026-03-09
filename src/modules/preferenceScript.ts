import { config } from "../../package.json";

export async function registerPrefsScripts(_window: Window) {
  if (!addon.data.prefs) {
    addon.data.prefs = {
      window: _window,
    };
  } else {
    addon.data.prefs.window = _window;
  }
  bindFormatEvents();
  updateCustomTemplateVisibility();
}

/**
 * Show/hide the custom template input based on the selected format.
 */
function updateCustomTemplateVisibility() {
  const doc = addon.data.prefs?.window?.document;
  if (!doc) return;

  const menulist = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-filename-format`,
  ) as XUL.MenuList | null;
  const customRow = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-custom-row`,
  ) as HTMLElement | null;

  if (!menulist || !customRow) return;

  customRow.style.display = menulist.value === "custom" ? "" : "none";
}

/**
 * Bind event listeners for the format dropdown.
 */
function bindFormatEvents() {
  const doc = addon.data.prefs?.window?.document;
  if (!doc) return;

  const menulist = doc.querySelector(
    `#zotero-prefpane-${config.addonRef}-filename-format`,
  );
  menulist?.addEventListener("command", () => {
    updateCustomTemplateVisibility();
  });
}
