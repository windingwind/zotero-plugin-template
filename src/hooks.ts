import {
  clipboardExample,
  dialogExample,
  filePickerExample,
  progressWindowExample,
  vtableExample,
} from "./examples/helpers";
import {
  exampleShortcutLargerCallback,
  exampleShortcutSmallerCallback,
} from "./examples/shortcuts";
import {
  registerStyleSheetToWindow,
  unregisterStyleSheetFromWindow,
} from "./examples/ui-stylesheet";
import {
  registerItemPaneCustomInfoRow,
  registerItemPaneSection,
  registerReaderItemPaneSection,
} from "./modules/item-pane";
import {
  registerExtraColumn,
  registerExtraColumnWithCustomCell,
} from "./modules/item-tree";
import { registerMenu } from "./modules/menu";
import { exampleNotifierCallback, registerNotifier } from "./modules/notifier";
import { registerPrefPanes, registerPrefsScripts } from "./modules/preference";
import {
  initLocale,
  registerMainWindowLocale,
  unregisterMainWindowLocale,
} from "./utils/locale";
import { createZToolkit } from "./utils/ztoolkit";

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();

  /** --- Examples start --- */

  registerPrefPanes();
  registerNotifier();

  // Item Pane
  registerItemPaneSection();
  registerItemPaneCustomInfoRow();
  registerReaderItemPaneSection();

  // Item Tree
  registerExtraColumn();
  registerExtraColumnWithCustomCell();

  // Menu
  registerMenu();

  /** --- Examples end --- */

  await Promise.all(Zotero.getMainWindows().map(onMainWindowLoad));
  // Mark initialized as true to confirm plugin loading status
  // outside of the plugin (e.g. scaffold testing process)
  addon.data.initialized = true;
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  // Create ztoolkit for every window
  addon.data.ztoolkit = createZToolkit();

  registerMainWindowLocale(win);

  /** --- Examples start --- */
  // Stylesheet
  registerStyleSheetToWindow(win);

  /** --- Examples end --- */
}

async function onMainWindowUnload(win: _ZoteroTypes.MainWindow): Promise<void> {
  unregisterStyleSheetFromWindow(win);
  unregisterMainWindowLocale(win);
  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();
}

function onShutdown(): void {
  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();
  // Remove addon object
  addon.data.alive = false;
  // @ts-expect-error - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

/**
 * This function is just an example of dispatcher for Notify events.
 * Any operations should be placed in a function to keep this funcion clear.
 */
async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  extraData: { [key: string]: any },
) {
  // You can add your code to the corresponding notify type
  ztoolkit.log("notify", event, type, ids, extraData);
  if (
    event == "select" &&
    type == "tab" &&
    extraData[ids[0]].type == "reader"
  ) {
    exampleNotifierCallback();
  }
}

/**
 * This function is just an example of dispatcher for Preference UI events.
 * Any operations should be placed in a function to keep this funcion clear.
 * @param type event type
 * @param data event data
 */
async function onPrefsEvent(type: string, data: { [key: string]: any }) {
  switch (type) {
    case "load":
      registerPrefsScripts(data.window);
      break;
    default:
  }
}

function onShortcuts(type: string) {
  switch (type) {
    case "larger":
      exampleShortcutLargerCallback();
      break;
    case "smaller":
      exampleShortcutSmallerCallback();
      break;
    default:
      break;
  }
}

function onDialogEvents(type: string) {
  switch (type) {
    case "dialogExample":
      dialogExample();
      break;
    case "clipboardExample":
      clipboardExample();
      break;
    case "filePickerExample":
      filePickerExample();
      break;
    case "progressWindowExample":
      progressWindowExample();
      break;
    case "vtableExample":
      vtableExample();
      break;
    default:
      break;
  }
}

// Add your hooks here. For element click, etc.
// Keep in mind hooks only do dispatch. Don't add code that does real jobs in hooks.
// Otherwise the code would be hard to read and maintain.

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onNotify,
  onPrefsEvent,
  onShortcuts,
  onDialogEvents,
};
