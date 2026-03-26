import { initLocale, getString } from "./utils/locale";
import { registerPrefsScripts } from "./modules/preferenceScript";
import { ExportPdfsFactory } from "./modules/exportPdfs";
import { FindPdfFactory } from "./modules/findPdf";
import {
  registerApiEndpoints,
  unregisterApiEndpoints,
} from "./modules/apiEndpoints";
import { createZToolkit } from "./utils/ztoolkit";

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();

  // Register the preference pane so it appears in Zotero Settings sidebar.
  // Use the addon display name directly since getString() only loads addon.ftl
  // and "pref-title" is defined in preferences.ftl (loaded later by the pane).
  try {
    Zotero.PreferencePanes.register({
      pluginID: addon.data.config.addonID,
      src: rootURI + "content/preferences.xhtml",
      label: addon.data.config.addonName,
      image: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
    });
  } catch (e) {
    Zotero.log(
      `[${addon.data.config.addonName}] Failed to register prefs pane: ${e}`,
      "warning",
    );
  }

  try {
    registerApiEndpoints();
  } catch (e) {
    Zotero.log(
      `[${addon.data.config.addonName}] Failed to register API endpoints: ${e}`,
      "warning",
    );
  }

  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
  );

  addon.data.initialized = true;
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  try {
    addon.data.ztoolkit = createZToolkit();

    win.MozXULElement.insertFTLIfNeeded(
      `${addon.data.config.addonRef}-mainWindow.ftl`,
    );

    ExportPdfsFactory.registerCollectionMenuItem();
    ExportPdfsFactory.registerItemMenuItem();
    FindPdfFactory.registerItemMenuItem();
  } catch (e) {
    Zotero.log(
      `[${addon.data.config.addonName}] Failed to init main window: ${e}`,
      "warning",
    );
  }
}

async function onMainWindowUnload(win: Window): Promise<void> {
  ztoolkit.unregisterAll();
}

function onShutdown(): void {
  unregisterApiEndpoints();
  ztoolkit.unregisterAll();
  // Remove addon object
  addon.data.alive = false;
  // @ts-expect-error - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  extraData: { [key: string]: any },
) {
  ztoolkit.log("notify", event, type, ids, extraData);
}

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
    default:
      break;
  }
}

function onDialogEvents(type: string) {
  switch (type) {
    case "exportCollectionPdfs":
      ExportPdfsFactory.exportCollectionPdfs();
      break;
    case "exportSelectedPdfs":
      ExportPdfsFactory.exportSelectedItemsPdfs();
      break;
    case "findPdfForSelected":
      FindPdfFactory.findPdfForSelectedItems();
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
