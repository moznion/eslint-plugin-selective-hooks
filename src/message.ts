/**
 * Parsing and rewriting of `react-hooks/exhaustive-deps` report messages.
 *
 * These helpers depend on the exact message wording emitted by
 * `eslint-plugin-react-hooks@4.6.0`. The shapes we target are:
 *
 *   React Hook useEffect has a missing dependency: 'retry'. Either include it or remove the dependency array.
 *   React Hook useEffect has missing dependencies: 'pendingIds' and 'retry'. Either include them or remove the dependency array.
 *   React Hook useCallback has an unnecessary dependency: 'foo'. Either exclude it or remove the dependency array.
 *   React Hook useCallback has unnecessary dependencies: 'foo' and 'bar'. Either exclude them or remove the dependency array.
 *
 * Upstream emits at most one of `missing` / `unnecessary` / `duplicate` per
 * report (the first non-empty one), so a message contains exactly one
 * dependency clause for us to parse and, if needed, rewrite.
 */

export type DepClauseKind = "missing" | "unnecessary";

interface ClauseConfig {
  label: string;
  fixVerb: string;
  singlePrefix: string;
}

const CLAUSE_CONFIGS: Record<DepClauseKind, ClauseConfig> = {
  missing: { label: "missing", fixVerb: "include", singlePrefix: "a" },
  unnecessary: { label: "unnecessary", fixVerb: "exclude", singlePrefix: "an" },
};

// Captures the kind ("missing" / "unnecessary") and the dependency-list
// segment of a single dependency clause. We deliberately leave the "duplicate"
// kind out: duplicate deps are almost always a real mistake, not an
// intentional exception.
const CLAUSE_PATTERN = /(missing|unnecessary) dependenc(?:y|ies): (.*?)\. Either /;

// Captures the hook source (e.g. `useEffect`, `React.useMemo`).
const HOOK_SOURCE_PATTERN = /^React Hook (.+?) has /;

// Each dependency is rendered single-quoted, e.g. 'props.foo' or 'props?.foo'.
const QUOTED_DEP_PATTERN = /'([^']*)'/g;

export interface DepClause {
  kind: DepClauseKind;
  deps: string[];
}

/**
 * Extract the dependency clause from a report message: the kind ("missing"
 * or "unnecessary") and the dependency names in the (alphabetically sorted)
 * order the upstream rule emits them. Returns `null` for any message that is
 * not a missing- or unnecessary-dependency report.
 */
export function extractDepClause(message: string): DepClause | null {
  const segment = message.match(CLAUSE_PATTERN);
  if (!segment) {
    return null;
  }

  const kind = segment[1] as DepClauseKind;
  const deps: string[] = [];
  for (const match of segment[2].matchAll(QUOTED_DEP_PATTERN)) {
    deps.push(match[1]);
  }
  return { kind, deps };
}

/** Replicates the upstream `joinEnglish` helper (Oxford-comma list). */
function joinEnglish(items: string[]): string {
  let s = "";
  for (let i = 0; i < items.length; i++) {
    s += items[i];
    if (i === 0 && items.length === 2) {
      s += " and ";
    } else if (i === items.length - 2 && items.length > 2) {
      s += ", and ";
    } else if (i < items.length - 1) {
      s += ", ";
    }
  }
  return s;
}

/**
 * Rebuild a native-looking dependency-clause message for the subset of
 * dependencies that remain after exceptions are applied.
 *
 * Returns `null` when the hook source cannot be parsed, in which case the
 * caller should fall back to leaving the original message untouched.
 */
export function rewriteDepClauseMessage(
  originalMessage: string,
  kind: DepClauseKind,
  remainingDeps: string[],
): string | null {
  const hookMatch = originalMessage.match(HOOK_SOURCE_PATTERN);
  if (!hookMatch || remainingDeps.length === 0) {
    return null;
  }

  const hookSource = hookMatch[1];
  const config = CLAUSE_CONFIGS[kind];
  const plural = remainingDeps.length > 1;
  const list = joinEnglish(remainingDeps.map((dep) => `'${dep}'`));

  return (
    `React Hook ${hookSource} has ${plural ? "" : `${config.singlePrefix} `}${config.label} ` +
    `${plural ? "dependencies" : "dependency"}: ${list}. ` +
    `Either ${config.fixVerb} ${plural ? "them" : "it"} or remove the dependency array.`
  );
}
