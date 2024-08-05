import antfu from "@antfu/eslint-config";

// https://github.com/antfu/eslint-config
export default antfu({
  stylistic: false,
  typescript: {
    overrides: {
      "unused-imports/no-unused-vars": "off",
    },
  },
});
