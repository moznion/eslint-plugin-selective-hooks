declare module "eslint-plugin-react-hooks" {
  import type { Rule } from "eslint";

  const plugin: {
    rules: Record<string, Rule.RuleModule>;
    configs?: Record<string, unknown>;
  };

  export default plugin;
}
