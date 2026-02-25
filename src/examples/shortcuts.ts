/**
 * Keyboard Shortcuts Examples
 * - Shift+L: Larger action
 * - Shift+S: Smaller action
 */

export function initShortcutExamples() {
  registerShortcuts();
}

function registerShortcuts() {
  // Register an event key for Alt+L
  ztoolkit.Keyboard.register((ev, keyOptions) => {
    ztoolkit.log(ev, keyOptions.keyboard);
    if (keyOptions.keyboard?.equals("shift,l")) {
      addon.hooks.onShortcuts("larger");
    }
    if (ev.shiftKey && ev.key === "S") {
      addon.hooks.onShortcuts("smaller");
    }
  });

  new ztoolkit.ProgressWindow(addon.data.config.addonName)
    .createLine({
      text: "Example Shortcuts: Shift+L/S",
      type: "success",
    })
    .show();
}

export function exampleShortcutLargerCallback() {
  new ztoolkit.ProgressWindow(addon.data.config.addonName)
    .createLine({
      text: "Larger!",
      type: "default",
    })
    .show();
}

export function exampleShortcutSmallerCallback() {
  new ztoolkit.ProgressWindow(addon.data.config.addonName)
    .createLine({
      text: "Smaller!",
      type: "default",
    })
    .show();
}
