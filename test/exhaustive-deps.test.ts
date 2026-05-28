import { RuleTester } from "eslint";
import { afterAll, describe, it } from "vitest";

import { exhaustiveDeps } from "../src/exhaustive-deps";

// Wire ESLint's RuleTester into vitest's lifecycle.
RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
});

ruleTester.run("@moznion/selective-hooks/exhaustive-deps", exhaustiveDeps, {
  valid: [
    // Correct deps: nothing to report.
    {
      code: `
        function C({ retry, pendingIds }) {
          useEffect(() => {
            retry(pendingIds);
          }, [retry, pendingIds]);
        }
      `,
    },

    // All missing deps excepted -> fully suppressed.
    {
      code: `
        function C({ retry, pendingIds }) {
          // exhaustive-deps-except-next-line pendingIds retry
          useEffect(() => {
            retry(pendingIds);
          }, []);
        }
      `,
    },

    // Full disable via the standard ESLint directive. Note: like the upstream
    // rule, the report lands on the dependency-array node, so the disable
    // comment must sit directly above the `}, [])` line (not above useEffect).
    {
      code: `
        function C({ retry, pendingIds }) {
          useEffect(() => {
            retry(pendingIds);
          // eslint-disable-next-line @moznion/selective-hooks/exhaustive-deps
          }, []);
        }
      `,
    },

    // Single missing dep excepted -> suppressed.
    {
      code: `
        function C({ retry }) {
          // exhaustive-deps-except-next-line retry
          useEffect(() => {
            retry();
          }, []);
        }
      `,
    },

    // Single unnecessary dep excepted -> suppressed.
    {
      code: `
        function C({ a, b }) {
          // exhaustive-deps-except-next-line b
          const cb = useCallback(() => {
            return a;
          }, [a, b]);
          return cb;
        }
      `,
    },

    // All unnecessary deps excepted -> fully suppressed.
    {
      code: `
        function C({ a, b, c }) {
          // exhaustive-deps-except-next-line b c
          const cb = useCallback(() => {
            return a;
          }, [a, b, c]);
          return cb;
        }
      `,
    },
  ],

  invalid: [
    // No directive: both deps reported (upstream behavior preserved).
    {
      code: `
        function C({ retry, pendingIds }) {
          useEffect(() => {
            retry(pendingIds);
          }, []);
        }
      `,
      errors: [
        {
          message:
            "React Hook useEffect has missing dependencies: 'pendingIds' and 'retry'. Either include them or remove the dependency array. If 'retry' changes too often, find the parent component that defines it and wrap that definition in useCallback.",
        },
      ],
    },

    // One dep excepted -> only the other is reported, message rewritten.
    {
      code: `
        function C({ retry, pendingIds }) {
          // exhaustive-deps-except-next-line pendingIds
          useEffect(() => {
            retry(pendingIds);
          }, []);
        }
      `,
      errors: [
        {
          message:
            "React Hook useEffect has a missing dependency: 'retry'. Either include it or remove the dependency array.",
        },
      ],
    },

    // Excepting a dep that is not actually missing changes nothing.
    {
      code: `
        function C({ retry, pendingIds }) {
          // exhaustive-deps-except-next-line foo
          useEffect(() => {
            retry(pendingIds);
          }, []);
        }
      `,
      errors: [
        {
          message:
            "React Hook useEffect has missing dependencies: 'pendingIds' and 'retry'. Either include them or remove the dependency array. If 'retry' changes too often, find the parent component that defines it and wrap that definition in useCallback.",
        },
      ],
    },

    // A blank line between the directive and the hook invalidates the directive.
    {
      code: `
        function C({ retry, pendingIds }) {
          // exhaustive-deps-except-next-line pendingIds

          useEffect(() => {
            retry(pendingIds);
          }, []);
        }
      `,
      errors: [
        {
          message:
            "React Hook useEffect has missing dependencies: 'pendingIds' and 'retry'. Either include them or remove the dependency array. If 'retry' changes too often, find the parent component that defines it and wrap that definition in useCallback.",
        },
      ],
    },

    // Empty directive (no dep names) is a no-op: full report stands.
    {
      code: `
        function C({ retry, pendingIds }) {
          // exhaustive-deps-except-next-line
          useEffect(() => {
            retry(pendingIds);
          }, []);
        }
      `,
      errors: [
        {
          message:
            "React Hook useEffect has missing dependencies: 'pendingIds' and 'retry'. Either include them or remove the dependency array. If 'retry' changes too often, find the parent component that defines it and wrap that definition in useCallback.",
        },
      ],
    },

    // Three missing deps, one excepted -> rewritten to the remaining two.
    {
      code: `
        function C({ retry, pendingIds, foo }) {
          // exhaustive-deps-except-next-line pendingIds
          useEffect(() => {
            retry(pendingIds, foo);
          }, []);
        }
      `,
      errors: [
        {
          message:
            "React Hook useEffect has missing dependencies: 'foo' and 'retry'. Either include them or remove the dependency array.",
        },
      ],
    },

    // useMemo assigned to a const: directive sits above the declaration.
    {
      code: `
        function C({ retry, pendingIds }) {
          // exhaustive-deps-except-next-line pendingIds
          const value = useMemo(() => {
            return retry(pendingIds);
          }, []);
          return value;
        }
      `,
      errors: [
        {
          message:
            "React Hook useMemo has a missing dependency: 'retry'. Either include it or remove the dependency array.",
        },
      ],
    },

    // No directive: unnecessary dep is reported (upstream behavior preserved).
    {
      code: `
        function C({ a, b }) {
          const cb = useCallback(() => {
            return a;
          }, [a, b]);
          return cb;
        }
      `,
      errors: [
        {
          message:
            "React Hook useCallback has an unnecessary dependency: 'b'. Either exclude it or remove the dependency array.",
          suggestions: 1,
        },
      ],
    },

    // Excepting an unnecessary dep that is not actually reported changes nothing.
    {
      code: `
        function C({ a, b }) {
          // exhaustive-deps-except-next-line foo
          const cb = useCallback(() => {
            return a;
          }, [a, b]);
          return cb;
        }
      `,
      errors: [
        {
          message:
            "React Hook useCallback has an unnecessary dependency: 'b'. Either exclude it or remove the dependency array.",
          suggestions: 1,
        },
      ],
    },

    // Two unnecessary deps, one excepted -> rewritten to the remaining one.
    {
      code: `
        function C({ a, b, c }) {
          // exhaustive-deps-except-next-line b
          const cb = useCallback(() => {
            return a;
          }, [a, b, c]);
          return cb;
        }
      `,
      errors: [
        {
          message:
            "React Hook useCallback has an unnecessary dependency: 'c'. Either exclude it or remove the dependency array.",
        },
      ],
    },

    // Three unnecessary deps, one excepted -> remaining two reported.
    {
      code: `
        function C({ a, b, c, d }) {
          // exhaustive-deps-except-next-line b
          const cb = useCallback(() => {
            return a;
          }, [a, b, c, d]);
          return cb;
        }
      `,
      errors: [
        {
          message:
            "React Hook useCallback has unnecessary dependencies: 'c' and 'd'. Either exclude them or remove the dependency array.",
        },
      ],
    },
  ],
});
