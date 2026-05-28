import { Linter } from "eslint";
import reactHooks from "eslint-plugin-react-hooks";
import { describe, expect, it } from "vitest";

import selectiveHooks from "../src/index";

describe("wrap()", () => {
  it("returns a shallow copy without mutating the input plugin", () => {
    const originalExhaustiveDeps = reactHooks.rules["exhaustive-deps"];

    const wrapped = selectiveHooks.wrap(reactHooks);

    // Different plugin object.
    expect(wrapped).not.toBe(reactHooks);
    // Different rules object (so a later mutation can't leak into the input).
    expect(wrapped.rules).not.toBe(reactHooks.rules);
    // The input's `exhaustive-deps` rule is unchanged.
    expect(reactHooks.rules["exhaustive-deps"]).toBe(originalExhaustiveDeps);
    // The wrapped plugin has the selective-aware rule swapped in.
    expect(wrapped.rules?.["exhaustive-deps"]).not.toBe(originalExhaustiveDeps);
  });

  it("passes other react-hooks rules (e.g. rules-of-hooks) through unchanged", () => {
    const wrapped = selectiveHooks.wrap(reactHooks);

    expect(wrapped.rules?.["rules-of-hooks"]).toBe(reactHooks.rules["rules-of-hooks"]);
  });

  describe("registered as 'react-hooks' in a Linter config", () => {
    const linter = new Linter({ configType: "flat" });
    const code = (body: string) => `
      function C({ retry, pendingIds }) {
        ${body}
      }
    `;
    const config = {
      languageOptions: {
        parserOptions: {
          ecmaVersion: 2020 as const,
          sourceType: "module" as const,
          ecmaFeatures: { jsx: true },
        },
      },
      plugins: {
        "react-hooks": selectiveHooks.wrap(reactHooks),
      },
      rules: {
        "react-hooks/exhaustive-deps": "warn" as const,
      },
    };

    it("reports under the `react-hooks/exhaustive-deps` id (not the namespaced one)", () => {
      const messages = linter.verify(code(`useEffect(() => { retry(pendingIds); }, []);`), config);

      expect(messages).toHaveLength(1);
      expect(messages[0].ruleId).toBe("react-hooks/exhaustive-deps");
      expect(messages[0].message).toContain("missing dependencies");
      expect(messages[0].message).toContain("'pendingIds'");
      expect(messages[0].message).toContain("'retry'");
    });

    it("honours the exhaustive-deps-except-next-line directive", () => {
      const messages = linter.verify(
        code(`
        // exhaustive-deps-except-next-line pendingIds
        useEffect(() => { retry(pendingIds); }, []);
      `),
        config,
      );

      // pendingIds excepted; only retry remains.
      expect(messages).toHaveLength(1);
      expect(messages[0].ruleId).toBe("react-hooks/exhaustive-deps");
      expect(messages[0].message).toBe(
        "React Hook useEffect has a missing dependency: 'retry'. Either include it or remove the dependency array.",
      );
    });

    it("suppresses the report entirely when every missing dep is excepted", () => {
      const messages = linter.verify(
        code(`
        // exhaustive-deps-except-next-line pendingIds retry
        useEffect(() => { retry(pendingIds); }, []);
      `),
        config,
      );

      expect(messages).toEqual([]);
    });

    it("still responds to `eslint-disable react-hooks/exhaustive-deps`", () => {
      const messages = linter.verify(
        code(`
        useEffect(() => {
          retry(pendingIds);
        // eslint-disable-next-line react-hooks/exhaustive-deps
        }, []);
      `),
        config,
      );

      expect(messages).toEqual([]);
    });
  });
});
