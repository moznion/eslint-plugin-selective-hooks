# eslint-plugin-selective-hooks

`eslint-plugin-selective-hooks` extends [`react-hooks/exhaustive-deps`](https://www.npmjs.com/package/eslint-plugin-react-hooks)
by allowing fine-grained exceptions for specific missing dependencies,
instead of disabling the whole rule.

Instead of disabling the entire rule and silently hiding *every* missing
dependency:

```ts
// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => {
  retry(pendingIds);
}, []);
```

you can preserve most of the dependency checking and only excuse the
dependencies you intend to:

```ts
// exhaustive-deps-except-next-line pendingIds
useEffect(() => {
  retry(pendingIds);
}, []);
```

In this example only `pendingIds` is ignored. Other missing dependencies (here
`retry`) are still reported.

## Why

The motivating use cases are effects where a stale closure is intentional or a
value is deliberately omitted:

- subscription / WebSocket / SSE listeners
- timers
- imperative API integration
- stable ref escape hatches
- external store integration

Disabling the whole rule throws away the rest of the dependency graph
information. This plugin keeps it: disable less, preserve more.

## Installation

```sh
npm install --save-dev @moznion/eslint-plugin-selective-hooks
```

This plugin wraps `eslint-plugin-react-hooks` and declares it (along with
`eslint`) as a **peer dependency** — it does not bundle its own copy. Most
projects already have it; if not, install a matching version:

```sh
npm install --save-dev eslint-plugin-react-hooks@^4.6.0
```

> **Compatibility:** requires `eslint-plugin-react-hooks@4.6.x` and ESLint
> 7–8. The rule parses the upstream rule's 4.6.x message format, so newer
> react-hooks (5+) and ESLint 9+ are not supported.

## Usage (flat config)

The recommended way is to register the wrapped `eslint-plugin-react-hooks`
under its usual name. The `wrap()` helper returns a shallow copy of the plugin
whose `exhaustive-deps` rule is the selective-aware version; nothing else
changes.

```js
import reactHooks from "eslint-plugin-react-hooks";
import selectiveHooks from "@moznion/eslint-plugin-selective-hooks";

export default [
  {
    plugins: {
      "react-hooks": selectiveHooks.wrap(reactHooks),
    },
    rules: {
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
```

Why this shape:

- The rule id stays `react-hooks/exhaustive-deps`. There is no separate rule,
  no `"off"` + alias pair to keep in sync, and no double-reporting.
- Existing `// eslint-disable-next-line react-hooks/exhaustive-deps` comments
  and any `rules: { "react-hooks/exhaustive-deps": [...] }` options
  (`additionalHooks`, severity, etc.) keep working unchanged.
- `wrap()` does not mutate the input plugin; the original `reactHooks` object
  is untouched.

### Alternative: namespaced rule

If you would rather not wrap the react-hooks plugin, you can also enable the
rule under this plugin's own namespace. In that case you must turn the upstream
rule off so the two do not double-report:

```js
import selectiveHooks from "@moznion/eslint-plugin-selective-hooks";

export default [
  {
    plugins: {
      "@moznion/selective-hooks": selectiveHooks,
    },
    rules: {
      // Turn off the upstream rule so the two do not double-report.
      "react-hooks/exhaustive-deps": "off",
      "@moznion/selective-hooks/exhaustive-deps": "warn",
    },
  },
];
```

A ready-made preset is exported for this style:

```js
import selectiveHooks from "@moznion/eslint-plugin-selective-hooks";

export default [
  selectiveHooks.configs.recommended, // enables @moznion/selective-hooks/exhaustive-deps as "warn"
  {
    rules: {
      "react-hooks/exhaustive-deps": "off",
    },
  },
];
```

## The directive

```txt
// exhaustive-deps-except-next-line <dep> [<dep> ...]
```

Place it on the line directly above the hook statement. The listed
dependencies are excluded from the missing-dependency report; everything else
is still reported.

| Code | Result |
| --- | --- |
| `useEffect(() => { retry(pendingIds); }, [])` (no directive) | reports `pendingIds` and `retry` |
| `// exhaustive-deps-except-next-line pendingIds` | reports `retry` only |
| `// exhaustive-deps-except-next-line pendingIds retry` | nothing reported |
| `// exhaustive-deps-except-next-line foo` (not actually missing) | reports `pendingIds` and `retry` (directive is a no-op) |

Notes:

- The directive must be on the immediately preceding line. A blank line
  between the directive and the hook invalidates it.
- When a partial exception is applied, the upstream autofix / suggestion is
  dropped, because re-adding the excepted dependency would defeat the point.
  When the directive matches none of the actual missing dependencies, the
  upstream behavior (including the suggestion) is preserved unchanged.
- Member expressions are matched by the name as the rule prints it, e.g.
  `props.foo` or (with optional chaining) `props?.foo`.

### Fully disabling the rule

For a complete disable, use the standard ESLint directive. Note that — exactly
like the upstream `react-hooks/exhaustive-deps` rule — the report is attached
to the dependency array node, so the disable comment must sit directly
above the `}, [])` line, not above `useEffect`:

```ts
useEffect(() => {
  retry(pendingIds);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

(If you went with the namespaced alternative above, the rule id in the disable
comment is `@moznion/selective-hooks/exhaustive-deps` instead.)

(The `exhaustive-deps-except-next-line` directive, by contrast, is anchored to
the hook *statement*, so it goes above `useEffect` as shown earlier.)

## How it works

The rule wraps the original `react-hooks/exhaustive-deps`:

1. It delegates to the upstream rule, intercepting its `context.report` calls.
2. For each missing-dependency report, it parses the dependency names out of
   the report message.
3. It reads the `exhaustive-deps-except-next-line` directive (if any) above the
   enclosing statement.
4. Excepted dependencies are removed. If none remain, the report is suppressed;
   otherwise the message is rewritten to list only the remaining dependencies.

Because step 2 parses the upstream message text, this plugin is pinned to a
specific upstream version (`4.6.0`). This is a known piece of technical debt;
future work may fork the upstream rule or propose an internal API upstream.

## Scope

Implemented:

- `wrap(reactHooksPlugin)` for registering the selective-aware rule under the
  upstream `react-hooks/exhaustive-deps` name
- `@moznion/selective-hooks/exhaustive-deps` as a standalone alternative
- the `exhaustive-deps-except-next-line` directive
- partial suppression of missing dependencies with message rewrite
- dropping fix/suggestion when a selective exception is applied
- flat config support

Not (yet) implemented:

- ignoring *unnecessary* (extra) dependencies
- a reason syntax (`-- explanation`)
- unused-exception detection
- suggestion rewriting (rather than removal)
- TypeScript type-aware analysis

## Development

This repository uses [pnpm](https://pnpm.io) (pinned via the `packageManager`
field). Enable it once with [Corepack](https://nodejs.org/api/corepack.html),
which ships with Node.js:

```sh
corepack enable pnpm
```

```sh
pnpm install
pnpm test            # vitest + ESLint RuleTester
pnpm build           # tsc -> dist/
pnpm typecheck       # tsc --noEmit

# Static analysis (oxc)
pnpm lint            # oxlint
pnpm lint:fix        # oxlint --fix
pnpm format          # oxfmt (writes in place)
pnpm format:check

pnpm check           # typecheck + lint + format:check + test
```

Linting uses [oxlint](https://oxc.rs/docs/guide/usage/linter) (config:
`.oxlintrc.json`) and formatting uses [oxfmt](https://oxc.rs) (config:
`.oxfmtrc.json`, scoped to TypeScript sources). Both honour `.gitignore`.

## License

MIT

