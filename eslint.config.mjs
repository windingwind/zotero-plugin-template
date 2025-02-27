// @ts-check Let TS check this config file

import zotero from "@zotero-plugin/eslint-config";

export default zotero({
  overrides: [
    {
      files: ["**/*.ts"],
      rules: {
        "@typescript-eslint/no-unused-vars": "off",
        "no-restricted-globals": [
          "error",
          { message: "Use `Zotero.getMainWindow()` instead.", name: "window" },
          {
            message: "Use `Zotero.getMainWindow().document` instead.",
            name: "document",
          },
          {
            message: "Use `Zotero.getActiveZoteroPane()` instead.",
            name: "ZoteroPane",
          },
          "Zotero_Tabs",
        ],
      },
    },
  ],
});
