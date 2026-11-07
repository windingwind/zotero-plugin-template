import {
  BasicTool,
  ClipboardHelper,
  DialogHelper,
  FilePickerHelper,
  KeyboardManager,
  makeHelperTool,
  ProgressWindowHelper,
  UITool,
  unregister,
  VirtualizedTableHelper,
} from "zotero-plugin-toolkit";
import { config } from "../../package.json";

export { createZToolkit };

function createZToolkit() {
  const _ztoolkit = new ZoteroToolkit();
  initZToolkit(_ztoolkit);
  return _ztoolkit;
}

function initZToolkit(_ztoolkit: ReturnType<typeof createZToolkit>) {
  const env = __env__;
  _ztoolkit.basicOptions.log.prefix = `[${config.addonName}]`;
  _ztoolkit.basicOptions.log.disableConsole = env === "production";
  _ztoolkit.UI.basicOptions.ui.enableElementJSONLog = __env__ === "development";
  _ztoolkit.UI.basicOptions.ui.enableElementDOMLog = __env__ === "development";
  // Getting basicOptions.debug will load global modules like the debug bridge.
  // since we want to deprecate it, should avoid using it unless necessary.
  // _ztoolkit.basicOptions.debug.disableDebugBridgePassword =
  //   __env__ === "development";
  _ztoolkit.basicOptions.api.pluginID = config.addonID;
  _ztoolkit.ProgressWindow.setIconURI(
    "default",
    `chrome://${config.addonRef}/content/icons/favicon.png`,
  );
}

/**
 * On-demand toolkit: only the modules used by this plugin are bundled.
 *
 * Add the modules you need to the class below, e.g. `Reader: ReaderTool`,
 * `ExtraField: ExtraFieldTool`, `FieldHooks: FieldHookManager`,
 * `Patch: typeof PatchHelper`, `LargePrefObject: typeof LargePrefHelper`,
 * `Guide: typeof GuideHelper`.
 */
class ZoteroToolkit extends BasicTool {
  UI: UITool;
  Keyboard: KeyboardManager;
  Clipboard: typeof ClipboardHelper;
  FilePicker: typeof FilePickerHelper;
  ProgressWindow: typeof ProgressWindowHelper;
  VirtualizedTable: typeof VirtualizedTableHelper;
  Dialog: typeof DialogHelper;

  constructor() {
    super();
    this.UI = new UITool(this);
    this.Keyboard = new KeyboardManager(this);
    this.Clipboard = makeHelperTool(ClipboardHelper, this);
    this.FilePicker = makeHelperTool(FilePickerHelper, this);
    this.ProgressWindow = makeHelperTool(ProgressWindowHelper, this);
    this.VirtualizedTable = makeHelperTool(VirtualizedTableHelper, this);
    this.Dialog = makeHelperTool(DialogHelper, this);
  }

  /**
   * Unregister everything created by the modules.
   */
  unregisterAll() {
    unregister(this);
  }
}
