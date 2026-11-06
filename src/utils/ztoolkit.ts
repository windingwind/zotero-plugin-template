import { BasicTool, unregister } from "zotero-plugin-toolkit";
import { config } from "../../package.json";

export { createZToolkit };

/**
 * Minimal toolkit: the plugin only needs `getGlobal`, `log` and cleanup.
 * Importing only `BasicTool` keeps unused toolkit modules (and their
 * global side effects) out of the bundle.
 */
class MyToolkit extends BasicTool {
  unregisterAll() {
    unregister(this);
  }
}

function createZToolkit() {
  const _ztoolkit = new MyToolkit();
  _ztoolkit.basicOptions.log.prefix = `[${config.addonName}]`;
  _ztoolkit.basicOptions.log.disableConsole = __env__ === "production";
  _ztoolkit.basicOptions.api.pluginID = config.addonID;
  return _ztoolkit;
}
