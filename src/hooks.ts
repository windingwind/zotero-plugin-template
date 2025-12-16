import { HelperExampleFactory } from "./modules/examples";
import { getString, initLocale } from "./utils/locale";
import {
  registerPrefs,
  registerPrefsScripts,
} from "./modules/preferenceScript";
import { createZToolkit } from "./utils/ztoolkit";
import {
  exampleNotifierCallback,
  registerNotifier,
  unregisterNotifier,
} from "./modules/notifier";
import {
  registerExtraColumn,
  registerExtraColumnWithCustomCell,
} from "./modules/item-tree";
import {
  exampleShortcutLargerCallback,
  exampleShortcutSmallerCallback,
  registerShortcuts,
} from "./modules/shortcut";
import {
  registerItemPaneCustomInfoRow,
  registerItemPaneSection,
  registerReaderItemPaneSection,
} from "./modules/item-pane";
import { registerStyleSheet, unregisterStyleSheet } from "./modules/stylesheet";
import {
  registerRightClickMenuItem,
  registerRightClickMenuPopup,
  registerWindowMenuWithSeparator,
} from "./modules/menu";
import {
  registerAnonymousCommandExample,
  registerConditionalCommandExample,
  registerNormalCommandExample,
} from "./modules/prompt";

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();

  registerPrefs();

  registerNotifier();

  registerShortcuts();

  await registerExtraColumn();

  await registerExtraColumnWithCustomCell();

  registerItemPaneCustomInfoRow();

  registerItemPaneSection();

  registerReaderItemPaneSection();

  await Promise.all(Zotero.getMainWindows().map(onMainWindowLoad));

  // Mark initialized as true to confirm plugin loading status
  // outside of the plugin (e.g. scaffold testing process)
  addon.data.initialized = true;
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  // Create ztoolkit for every window
  addon.data.ztoolkit = createZToolkit();

  win.MozXULElement.insertFTLIfNeeded(
    `${addon.data.config.addonRef}-mainWindow.ftl`,
  );

  const popupWin = new ztoolkit.ProgressWindow(addon.data.config.addonName, {
    closeOnClick: true,
    closeTime: -1,
  })
    .createLine({
      text: getString("startup-begin"),
      type: "default",
      progress: 0,
    })
    .show();

  await Zotero.Promise.delay(1000);
  popupWin.changeLine({
    progress: 30,
    text: `[30%] ${getString("startup-begin")}`,
  });

  registerStyleSheet(win);

  registerRightClickMenuItem();

  registerRightClickMenuPopup(win);

  registerWindowMenuWithSeparator();

  registerNormalCommandExample();

  registerAnonymousCommandExample(win);

  registerConditionalCommandExample();

  await Zotero.Promise.delay(1000);

  popupWin.changeLine({
    progress: 100,
    text: `[100%] ${getString("startup-finish")}`,
  });
  popupWin.startCloseTimer(5000);

  addon.hooks.onDialogEvents("dialogExample");
}

async function onMainWindowUnload(win: _ZoteroTypes.MainWindow): Promise<void> {
  unregisterStyleSheet(win);
  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();
}

function onShutdown(): void {
  unregisterNotifier();
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
      return;
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
      HelperExampleFactory.dialogExample();
      break;
    case "clipboardExample":
      HelperExampleFactory.clipboardExample();
      break;
    case "filePickerExample":
      HelperExampleFactory.filePickerExample();
      break;
    case "progressWindowExample":
      HelperExampleFactory.progressWindowExample();
      break;
    case "vtableExample":
      HelperExampleFactory.vtableExample();
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
