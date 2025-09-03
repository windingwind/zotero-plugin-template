/**
 * Module: UI - ItemPaneCustomInfoRow and ItemPaneSection
 * Purpose: Add a custom column to the Zotero item list
 *
 * Lifecycle:
 * - Register: onStartup
 * - Unregister: onShutdown
 * - Requires manual unregister: No, handled by Zotero
 */

import { getLocaleID } from "../utils/locale";

export function registerItemPaneCustomInfoRow() {
  Zotero.ItemPaneManager.registerInfoRow({
    rowID: "example",
    pluginID: addon.data.config.addonID,
    editable: true,
    label: {
      l10nID: getLocaleID("item-info-row-example-label"),
    },
    position: "afterCreators",
    onGetData: ({ item }) => {
      return item.getField("title");
    },
    onSetData: ({ item, value }) => {
      item.setField("title", value);
    },
  });
}

export function registerItemPaneSection() {
  Zotero.ItemPaneManager.registerSection({
    paneID: "example",
    pluginID: addon.data.config.addonID,
    header: {
      l10nID: getLocaleID("item-section-example1-head-text"),
      icon: "chrome://zotero/skin/16/universal/book.svg",
    },
    sidenav: {
      l10nID: getLocaleID("item-section-example1-sidenav-tooltip"),
      icon: "chrome://zotero/skin/20/universal/save.svg",
    },
    onRender: ({ body, item, editable, tabType }) => {
      body.textContent = JSON.stringify({
        id: item?.id,
        editable,
        tabType,
      });
    },
  });
}

export async function registerReaderItemPaneSection() {
  Zotero.ItemPaneManager.registerSection({
    paneID: "reader-example",
    pluginID: addon.data.config.addonID,
    header: {
      l10nID: getLocaleID("item-section-example2-head-text"),
      // Optional
      l10nArgs: `{"status": "Initialized"}`,
      // Can also have a optional dark icon
      icon: "chrome://zotero/skin/16/universal/book.svg",
    },
    sidenav: {
      l10nID: getLocaleID("item-section-example2-sidenav-tooltip"),
      icon: "chrome://zotero/skin/20/universal/save.svg",
    },
    // Optional
    bodyXHTML:
      '<html:h1 id="test">THIS IS TEST</html:h1><browser disableglobalhistory="true" remote="true" maychangeremoteness="true" type="content" flex="1" id="browser" style="width: 180%; height: 280px"/>',
    // Optional, Called when the section is first created, must be synchronous
    onInit: ({ item }) => {
      ztoolkit.log("Section init!", item?.id);
    },
    // Optional, Called when the section is destroyed, must be synchronous
    onDestroy: (props) => {
      ztoolkit.log("Section destroy!");
    },
    // Optional, Called when the section data changes (setting item/mode/tabType/inTrash), must be synchronous. return false to cancel the change
    onItemChange: ({ item, setEnabled, tabType }) => {
      ztoolkit.log(`Section item data changed to ${item?.id}`);
      setEnabled(tabType === "reader");
      return true;
    },
    // Called when the section is asked to render, must be synchronous.
    onRender: ({
      body,
      item,
      setL10nArgs,
      setSectionSummary,
      setSectionButtonStatus,
    }) => {
      ztoolkit.log("Section rendered!", item?.id);
      const title = body.querySelector("#test") as HTMLElement;
      title.style.color = "red";
      title.textContent = "LOADING";
      setL10nArgs(`{ "status": "Loading" }`);
      setSectionSummary("loading!");
      setSectionButtonStatus("test", { hidden: true });
    },
    // Optional, can be asynchronous.
    onAsyncRender: async ({
      body,
      item,
      setL10nArgs,
      setSectionSummary,
      setSectionButtonStatus,
    }) => {
      ztoolkit.log("Section secondary render start!", item?.id);
      await Zotero.Promise.delay(1000);
      ztoolkit.log("Section secondary render finish!", item?.id);
      const title = body.querySelector("#test") as HTMLElement;
      title.style.color = "green";
      title.textContent = item.getField("title");
      setL10nArgs(`{ "status": "Loaded" }`);
      setSectionSummary("rendered!");
      setSectionButtonStatus("test", { hidden: false });
    },
    // Optional, Called when the section is toggled. Can happen anytime even if the section is not visible or not rendered
    onToggle: ({ item }) => {
      ztoolkit.log("Section toggled!", item?.id);
    },
    // Optional, Buttons to be shown in the section header
    sectionButtons: [
      {
        type: "test",
        icon: "chrome://zotero/skin/16/universal/empty-trash.svg",
        l10nID: getLocaleID("item-section-example2-button-tooltip"),
        onClick: ({ item, paneID }) => {
          ztoolkit.log("Section clicked!", item?.id);
          Zotero.ItemPaneManager.unregisterSection(paneID);
        },
      },
    ],
  });
}
