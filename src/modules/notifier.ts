/**
 * Module: Notifier
 * Purpose: Register a global Zotero Notifier observer to respond to item/tab/file events
 *
 * Lifecycle:
 * - Register: onStartup
 * - Unregister: onShutdown
 * - Requires manual unregister: Yes
 */

let notifierID: string | undefined;

export function registerNotifier() {
  const callback = {
    notify: async (
      event: string,
      type: string,
      ids: number[] | string[],
      extraData: { [key: string]: any },
    ) => {
      if (!addon?.data.alive) {
        unregisterNotifier();
        return;
      }
      addon.hooks.onNotify(event, type, ids, extraData);
    },
  };

  // Register the callback in Zotero as an item observer
  notifierID = Zotero.Notifier.registerObserver(callback, [
    "tab",
    "item",
    "file",
  ]);
}

export function unregisterNotifier() {
  if (!notifierID) return;
  Zotero.Notifier.unregisterObserver(notifierID);
}

export function exampleNotifierCallback() {
  new ztoolkit.ProgressWindow(addon.data.config.addonName)
    .createLine({
      text: "Open Tab Detected!",
      type: "success",
      progress: 100,
    })
    .show();
}
