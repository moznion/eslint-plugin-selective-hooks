import type { ESLint, Rule } from "eslint";

import { exhaustiveDeps } from "./exhaustive-deps";

const rules: Record<string, Rule.RuleModule> = {
  "exhaustive-deps": exhaustiveDeps,
};

/**
 * Return a copy of an `eslint-plugin-react-hooks` plugin whose `exhaustive-deps`
 * rule is replaced with the selective-aware version, so it can be registered
 * under the usual `"react-hooks"` name.
 *
 * This is the recommended way to use this plugin: it keeps the rule id
 * `react-hooks/exhaustive-deps` unchanged, so there is no separate rule, no
 * `"off"` + alias pair to maintain, and existing
 * `eslint-disable react-hooks/exhaustive-deps` comments keep working. The
 * `exhaustive-deps-except-next-line` directive simply starts to take effect.
 *
 * ```js
 * import reactHooks from "eslint-plugin-react-hooks";
 * import selectiveHooks from "@moznion/eslint-plugin-selective-hooks";
 *
 * export default [
 *   {
 *     plugins: { "react-hooks": selectiveHooks.wrap(reactHooks) },
 *     rules: { "react-hooks/exhaustive-deps": "warn" },
 *   },
 * ];
 * ```
 *
 * The input plugin is not mutated; a shallow copy is returned with only the
 * `exhaustive-deps` rule swapped. All other rules, configs, and metadata are
 * passed through unchanged.
 */
function wrap(reactHooksPlugin: ESLint.Plugin): ESLint.Plugin {
  return {
    ...reactHooksPlugin,
    rules: {
      ...reactHooksPlugin.rules,
      "exhaustive-deps": exhaustiveDeps,
    },
  };
}

const plugin = {
  meta: {
    name: "@moznion/eslint-plugin-selective-hooks",
    version: "4.6.0",
  },
  rules,
  configs: {} as Record<string, unknown>,
  wrap,
};

// Flat config preset for the standalone-rule style. Prefer `wrap()` (above):
// this preset registers the rule under the `@moznion/selective-hooks` namespace,
// which means it double-reports unless the caller also sets
// `react-hooks/exhaustive-deps` to "off".
plugin.configs.recommended = {
  plugins: {
    "@moznion/selective-hooks": plugin as unknown as ESLint.Plugin,
  },
  rules: {
    "@moznion/selective-hooks/exhaustive-deps": "warn",
  },
};

export = plugin;
