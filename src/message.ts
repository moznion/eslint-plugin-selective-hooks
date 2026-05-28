/**
 * Parsing and rewriting of `react-hooks/exhaustive-deps` report messages.
 *
 * These helpers depend on the exact message wording emitted by
 * `eslint-plugin-react-hooks@4.6.0`. The shapes we target are:
 *
 *   React Hook useEffect has a missing dependency: 'retry'. Either include it or remove the dependency array.
 *   React Hook useEffect has missing dependencies: 'pendingIds' and 'retry'. Either include them or remove the dependency array.
 *
 * A missing-dependency clause is always emitted first (before any unnecessary
 * or duplicate clause and before the optional trailing advice), so we only
 * need to look at the segment between `missing dependenc(y|ies):` and the
 * terminating `. Either `.
 */

// Captures the dependency-list segment of a missing-dependency message.
const MISSING_DEPS_PATTERN = /missing dependenc(?:y|ies): (.*?)\. Either /;

// Captures the hook source (e.g. `useEffect`, `React.useMemo`).
const HOOK_SOURCE_PATTERN = /^React Hook (.+?) has /;

// Each dependency is rendered single-quoted, e.g. 'props.foo' or 'props?.foo'.
const QUOTED_DEP_PATTERN = /'([^']*)'/g;

/**
 * Extract the missing dependency names from a report message, in the order
 * (alphabetically sorted) that the upstream rule emits them. Returns an empty
 * array for any message that is not a missing-dependency report.
 */
export function extractMissingDeps(message: string): string[] {
  const segment = message.match(MISSING_DEPS_PATTERN);
  if (!segment) {
    return [];
  }

  const deps: string[] = [];
  for (const match of segment[1].matchAll(QUOTED_DEP_PATTERN)) {
    deps.push(match[1]);
  }
  return deps;
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
 * Rebuild a native-looking missing-dependency message for the subset of
 * dependencies that remain after exceptions are applied.
 *
 * Returns `null` when the hook source cannot be parsed, in which case the
 * caller should fall back to leaving the original message untouched.
 */
export function rewriteMissingDepsMessage(
  originalMessage: string,
  remainingDeps: string[],
): string | null {
  const hookMatch = originalMessage.match(HOOK_SOURCE_PATTERN);
  if (!hookMatch || remainingDeps.length === 0) {
    return null;
  }

  const hookSource = hookMatch[1];
  const plural = remainingDeps.length > 1;
  const list = joinEnglish(remainingDeps.map((dep) => `'${dep}'`));

  return (
    `React Hook ${hookSource} has ${plural ? "" : "a "}missing ` +
    `${plural ? "dependencies" : "dependency"}: ${list}. ` +
    `Either include ${plural ? "them" : "it"} or remove the dependency array.`
  );
}
