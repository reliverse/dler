/**
 * Spell engine – parses and evaluates magic comments embedded
 * in a single line of code.
 *
 * Supported directives:
 *   // <dler-replace-line-to `NEW CONTENT` [if 'cond'] [else 'alt']>
 *   // <dler-remove-line>
 *   // <dler-remove-file>
 *   // <dler-remove-comment>
 *
 * A directive is recognised whether written as:
 *   // <dler-…>                or
 *   // @ts-expect-error * <dler-…>
 *
 * Conditions (if/else) – currently supported:
 *   current file path starts with <prefix> [or <prefix> ...]
 */

import { relinka } from "@reliverse/relinka";

export interface SpellEvaluationContext {
  /** Path relative to project root (slash-separated) */
  filePath: string;
}

export interface SpellOutcome {
  replacement?: string;
  removeLine: boolean;
  removeFile: boolean;
}

export type SpellDirective =
  | "dler-replace-line-to"
  | "dler-remove-line"
  | "dler-remove-file"
  | "dler-remove-comment";

export interface SpellInfo {
  /** The name of the spell directive */
  name: SpellDirective;
  /** A short description of what the spell does */
  description: string;
  /** Example usage of the spell */
  example: string;
  /** Additional notes about the spell's behavior */
  notes?: string;
}

// Pre-compiled regex patterns for better performance
const SPELL_REGEX = /\/\/\s*(?:@ts-expect-error\s+.*?)?<\s*(dler-[^>\s]+)(.*?)>/i;
const REPLACEMENT_REGEX = /`([^`]+)`/;
const IF_CONDITION_REGEX = /\bif\s+['"`]([^'"`]+)['"`]/i;
const ELSE_CONTENT_REGEX = /\belse\s+['"`]([^'"`]+)['"`]/i;
const STARTS_WITH_REGEX = /current file path starts with\s+(.+)$/i;

/**
 * Returns information about all available magic directives
 */
export function getAvailableSpells(): SpellInfo[] {
  return [
    {
      name: "dler-replace-line-to",
      description: "Replaces the current line with new content, optionally based on a condition",
      example:
        "// <dler-replace-line-to `export const version = \"1.0.0\";` if 'current file path starts with dist-npm'>",
      notes:
        "If condition is not met and else content is provided, uses else content. Otherwise keeps original line. Also supports @ts-expect-error prefix.",
    },
    {
      name: "dler-remove-line",
      description: "Removes the current line from the output",
      example: "// <dler-remove-line>",
      notes: "Also supports @ts-expect-error prefix.",
    },
    {
      name: "dler-remove-file",
      description: "Removes the entire file from the output",
      example: "// <dler-remove-file>",
      notes:
        "This directive should be placed at the top of the file for clarity. Also supports @ts-expect-error prefix.",
    },
    {
      name: "dler-remove-comment",
      description: "Removes the current line if it's a comment",
      example: "// <dler-remove-comment>",
      notes:
        "Only removes the line if it starts with //. Useful for cleaning up comments in output files. Also supports @ts-expect-error prefix.",
    },
  ];
}

/**
 * Evaluates a single line for magic directives and returns the effect.
 * If no directive is present, returns neutral outcome.
 */
export function evaluateMagicDirective(line: string, ctx: SpellEvaluationContext): SpellOutcome {
  const match = line.match(SPELL_REGEX);
  if (!match) return NO_OP;

  const [, directive = "", body] = match;
  if (!isValidMagicDirective(directive)) {
    relinka("warn", `[spells] unknown directive: ${directive}`);
    return NO_OP;
  }

  switch (directive) {
    /* -------------------------------------------------------------- */
    /* dler-remove-file                                               */
    /* -------------------------------------------------------------- */
    case "dler-remove-file": {
      return { removeFile: true, removeLine: true };
    }

    /* -------------------------------------------------------------- */
    /* dler-remove-line                                               */
    /* -------------------------------------------------------------- */
    case "dler-remove-line": {
      return { removeLine: true, removeFile: false };
    }

    /* -------------------------------------------------------------- */
    /* dler-remove-comment                                            */
    /* -------------------------------------------------------------- */
    case "dler-remove-comment": {
      // Only remove if the line is a comment
      const isComment = line.trim().startsWith("//");
      return { removeLine: isComment, removeFile: false };
    }

    /* -------------------------------------------------------------- */
    /* dler-replace-line-to                                           */
    /* -------------------------------------------------------------- */
    case "dler-replace-line-to": {
      const { replacement, elseContent, condition } = parseReplacementDirective(body ?? "");

      if (!replacement) {
        relinka("warn", "[spells] dler-replace-line-to missing replacement content");
        return NO_OP;
      }

      const condMet = condition === undefined ? true : evaluatePathCondition(condition, ctx);

      if (condMet) {
        return { replacement, removeLine: false, removeFile: false };
      }
      if (elseContent !== undefined) {
        return { replacement: elseContent, removeLine: false, removeFile: false };
      }
      // else "do nothing" – keep original line
      return NO_OP;
    }

    default:
      // This should never happen due to the isValidMagicDirective check above
      return NO_OP;
  }
}

/* --------------------------------------------------------------------- */
/* Implementation details                                                */
/* --------------------------------------------------------------------- */

const NO_OP: SpellOutcome = { removeLine: false, removeFile: false };

interface ReplaceParts {
  replacement: string;
  elseContent?: string;
  condition?: string;
}

/** Type guard to validate magic directives */
function isValidMagicDirective(directive: string): directive is SpellDirective {
  return [
    "dler-replace-line-to",
    "dler-remove-line",
    "dler-remove-file",
    "dler-remove-comment",
  ].includes(directive);
}

/** Extracts components from a replacement directive like `replacement`, `if …`, `else …` */
function parseReplacementDirective(body: string): ReplaceParts {
  const parts: ReplaceParts = {
    replacement: "",
  };

  const replacementMatch = body.match(REPLACEMENT_REGEX);
  if (replacementMatch?.[1]) parts.replacement = replacementMatch[1].trim();

  const ifMatch = body.match(IF_CONDITION_REGEX);
  if (ifMatch?.[1]) {
    parts.condition = ifMatch[1].trim();
  } else {
    // Default condition if none provided
    parts.condition = "current file path starts with dist-jsr or dist-npm";
  }

  const elseMatch = body.match(ELSE_CONTENT_REGEX);
  if (elseMatch?.[1]) parts.elseContent = elseMatch[1].trim();

  return parts;
}

/** Evaluates a path-based condition against the file context */
function evaluatePathCondition(condition: string, ctx: SpellEvaluationContext): boolean {
  const STARTS_WITH = STARTS_WITH_REGEX.exec(condition)?.[1];

  if (STARTS_WITH) {
    const prefixes = STARTS_WITH.split(/\s+or\s+/i).map((p) =>
      p.replace(/['"`]/g, "").trim().replaceAll("\\", "/"),
    );
    return prefixes.some((p) => ctx.filePath.startsWith(p));
  }

  // Unknown condition → log warning and return false (safety)
  if (condition.trim()) {
    relinka(
      "warn",
      `[spells] unsupported condition "${condition}" - only "current file path starts with <prefix> [or <prefix> ...]" is supported`,
    );
  }
  return false;
}
