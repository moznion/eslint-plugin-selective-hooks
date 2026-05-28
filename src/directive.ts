import type { SourceCode } from "eslint";
import type { Comment, Node } from "estree";

/**
 * The directive keyword that introduces a selective exception.
 *
 *   // exhaustive-deps-except-next-line pendingIds retry
 */
export const DIRECTIVE_KEYWORD = "exhaustive-deps-except-next-line";

const DIRECTIVE_PATTERN = new RegExp(`^${DIRECTIVE_KEYWORD}\\s+(.+)$`);

/**
 * Walk up from an arbitrary node (typically the dependency array reported by
 * `react-hooks/exhaustive-deps`) to the enclosing statement or declaration.
 *
 * The directive lives on the line directly above the hook *statement*
 * (e.g. `useEffect(...)` or `const cb = useCallback(...)`), not above the
 * dependency array, which usually sits on the closing line `}, []);`.
 */
export function getEnclosingStatement(node: Node): Node {
  let current: Node & { parent?: Node } = node as Node & { parent?: Node };

  while (current.parent && !/(Statement|Declaration)$/.test(current.type)) {
    current = current.parent as Node & { parent?: Node };
  }

  return current;
}

/**
 * Read the set of dependency names that the directive (if any) above `node`
 * marks as intentional exceptions.
 *
 * Returns an empty set when there is no directive, when the directive is not
 * on the immediately preceding line (e.g. a blank line breaks the link), or
 * when the directive lists no dependency names.
 */
export function readExceptedDeps(sourceCode: SourceCode, node: Node): Set<string> {
  const comments = sourceCode.getCommentsBefore(node) as Comment[];
  const last = comments[comments.length - 1];

  if (!last || !last.loc || !node.loc) {
    return new Set();
  }

  // "next-line" semantics: the directive must sit on the line directly above
  // the statement. A blank line in between invalidates it.
  if (last.loc.end.line + 1 !== node.loc.start.line) {
    return new Set();
  }

  const match = last.value.trim().match(DIRECTIVE_PATTERN);
  if (!match) {
    return new Set();
  }

  return new Set(
    match[1]
      .split(/\s+/)
      .map((dep) => dep.trim())
      .filter(Boolean),
  );
}
