import type { Rule, SourceCode } from "eslint";
import type { Node } from "estree";
import reactHooks from "eslint-plugin-react-hooks";

import { getEnclosingStatement, readExceptedDeps } from "./directive";
import { extractDepClause, rewriteDepClauseMessage } from "./message";

const originalRule = reactHooks.rules["exhaustive-deps"];

if (!originalRule) {
  throw new Error(
    "@moznion/eslint-plugin-selective-hooks: could not find the 'exhaustive-deps' rule " +
      "in eslint-plugin-react-hooks. Is a compatible version installed?",
  );
}

function getSourceCode(context: Rule.RuleContext): SourceCode {
  // ESLint 8.40+ exposes `context.sourceCode`; older versions use getSourceCode().
  const ctx = context as unknown as {
    sourceCode?: SourceCode;
    getSourceCode?: () => SourceCode;
  };
  return ctx.sourceCode ?? ctx.getSourceCode!();
}

/**
 * Decide what to do with a single descriptor reported by the wrapped rule.
 *
 * Returns the (possibly rewritten) descriptor to forward to the real
 * `context.report`, or `null` to suppress the report entirely.
 */
function applyExceptions(
  descriptor: Rule.ReportDescriptor,
  sourceCode: SourceCode,
): Rule.ReportDescriptor | null {
  const message = (descriptor as { message?: unknown }).message;
  if (typeof message !== "string") {
    return descriptor;
  }

  const clause = extractDepClause(message);
  if (!clause) {
    // Not a missing- or unnecessary-dependency report (e.g. duplicate deps,
    // ref-cleanup advice). Leave it untouched.
    return descriptor;
  }

  const node = (descriptor as { node?: Node }).node;
  if (!node) {
    return descriptor;
  }

  const statement = getEnclosingStatement(node);
  const excepted = readExceptedDeps(sourceCode, statement);
  if (excepted.size === 0) {
    return descriptor;
  }

  const remainingDeps = clause.deps.filter((dep) => !excepted.has(dep));

  // The directive matched none of the actual reported deps: behave exactly
  // like the upstream rule, preserving its suggestion/fix.
  if (remainingDeps.length === clause.deps.length) {
    return descriptor;
  }

  // Every reported dep was excepted: suppress the report.
  if (remainingDeps.length === 0) {
    return null;
  }

  const rewritten = rewriteDepClauseMessage(message, clause.kind, remainingDeps);
  if (rewritten === null) {
    return descriptor;
  }

  // Drop suggest/fix: a partial exception makes the upstream autofix
  // (which would re-add the excepted deps) misleading.
  return {
    ...descriptor,
    message: rewritten,
    suggest: undefined,
    fix: undefined,
  } as Rule.ReportDescriptor;
}

export const exhaustiveDeps: Rule.RuleModule = {
  meta: {
    ...originalRule.meta,
    docs: {
      ...originalRule.meta?.docs,
      description:
        "verifies the list of dependencies for Hooks like useEffect, allowing " +
        "fine-grained exceptions for specific missing dependencies",
      url: "https://github.com/moznion/eslint-plugin-selective-hooks",
    },
  },

  create(context: Rule.RuleContext): Rule.RuleListener {
    const sourceCode = getSourceCode(context);
    const realReport = context.report.bind(context);

    // `context.report` is a non-configurable, read-only own property, so it
    // cannot be intercepted with a Proxy (doing so violates a proxy
    // invariant). Instead, delegate everything to the real context via the
    // prototype chain and shadow only `report` with our own property.
    const wrappedContext: Rule.RuleContext = Object.create(context, {
      report: {
        value(descriptor: Rule.ReportDescriptor): void {
          const next = applyExceptions(descriptor, sourceCode);
          if (next !== null) {
            realReport(next);
          }
        },
        configurable: true,
        writable: true,
        enumerable: true,
      },
    });

    return originalRule.create(wrappedContext);
  },
};
