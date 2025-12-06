// packages/matcher/src/mod.ts

import zeptomatch from "zeptomatch";

// ============================================================================
// Types
// ============================================================================

interface MatchOptions {
  partial?: boolean;
}

interface CompileOptions {
  partial?: boolean;
}

interface MatcherOptions {
  partial?: boolean;
}

// ============================================================================
// Core Matcher Functions
// ============================================================================

/**
 * Check if a glob pattern matches a path
 * @param pattern - The glob pattern to match against
 * @param input - The input string to test
 * @param options - Optional configuration
 * @returns True if the pattern matches the input
 */
export const match = (
  pattern: string,
  input: string,
  options: MatchOptions = {},
): boolean => zeptomatch(pattern, input, options);

/**
 * Check if a glob pattern matches a path (alias for match)
 * @param pattern - The glob pattern to match against
 * @param input - The input string to test
 * @param options - Optional configuration
 * @returns True if the pattern matches the input
 */
export const isMatch = match;

/**
 * Create a matcher function for a specific pattern
 * @param pattern - The glob pattern to compile
 * @param options - Optional configuration
 * @returns A function that tests input against the pattern
 */
export const createMatcher =
  (pattern: string, options: MatcherOptions = {}) =>
  (input: string): boolean =>
    zeptomatch(pattern, input, options);

/**
 * Create multiple matcher functions for multiple patterns
 * @param patterns - Array of glob patterns to compile
 * @param options - Optional configuration
 * @returns Array of matcher functions
 */
export const createMatchers = (
  patterns: string[],
  options: MatcherOptions = {},
) => patterns.map((pattern) => createMatcher(pattern, options));

/**
 * Test if any of the patterns match the input
 * @param patterns - Array of glob patterns to test
 * @param input - The input string to test
 * @param options - Optional configuration
 * @returns True if any pattern matches
 */
export const matchAny = (
  patterns: string[],
  input: string,
  options: MatchOptions = {},
): boolean => patterns.some((pattern) => zeptomatch(pattern, input, options));

/**
 * Test if all patterns match the input
 * @param patterns - Array of glob patterns to test
 * @param input - The input string to test
 * @param options - Optional configuration
 * @returns True if all patterns match
 */
export const matchAll = (
  patterns: string[],
  input: string,
  options: MatchOptions = {},
): boolean => patterns.every((pattern) => zeptomatch(pattern, input, options));

/**
 * Filter an array of strings based on glob patterns
 * @param patterns - Array of glob patterns to match against
 * @param inputs - Array of strings to filter
 * @param options - Optional configuration
 * @returns Array of strings that match any of the patterns
 */
export const filter = (
  patterns: string[],
  inputs: string[],
  options: MatchOptions = {},
): string[] => inputs.filter((input) => matchAny(patterns, input, options));

/**
 * Filter an array of strings, excluding those that match glob patterns
 * @param patterns - Array of glob patterns to exclude
 * @param inputs - Array of strings to filter
 * @param options - Optional configuration
 * @returns Array of strings that don't match any of the patterns
 */
export const exclude = (
  patterns: string[],
  inputs: string[],
  options: MatchOptions = {},
): string[] => inputs.filter((input) => !matchAny(patterns, input, options));

// ============================================================================
// Compilation Functions
// ============================================================================

/**
 * Compile a glob pattern to a regular expression
 * @param pattern - The glob pattern to compile
 * @param options - Optional configuration
 * @returns Compiled regular expression
 */
export const compile = (
  pattern: string,
  options: CompileOptions = {},
): RegExp => zeptomatch.compile(pattern, options);

/**
 * Compile multiple glob patterns to a single regular expression
 * @param patterns - Array of glob patterns to compile
 * @param options - Optional configuration
 * @returns Compiled regular expression that matches any of the patterns
 */
export const compileAny = (
  patterns: string[],
  options: CompileOptions = {},
): RegExp => zeptomatch.compile(patterns, options);

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Normalize glob patterns by splitting on whitespace and filtering empty strings
 * @param patterns - String or array of patterns to normalize
 * @returns Normalized array of patterns
 */
export const normalizePatterns = (patterns: string | string[]): string[] =>
  Array.isArray(patterns)
    ? patterns.flatMap((pattern) => pattern.split(/\s+/).filter(Boolean))
    : patterns.split(/\s+/).filter(Boolean);

/**
 * Create a filter function that excludes patterns
 * @param ignorePatterns - Patterns to ignore (string or array)
 * @param options - Optional configuration
 * @returns Function that filters out matching items
 */
export const createIgnoreFilter = (
  ignorePatterns: string | string[],
  options: MatcherOptions = {},
) => {
  const patterns = normalizePatterns(ignorePatterns);
  const matchers = createMatchers(patterns, options);

  return <T extends { name: string }>(items: T[]): T[] =>
    items.filter((item) => {
      const shouldIgnore = matchers.some((matcher) => matcher(item.name));
      return !shouldIgnore;
    });
};

/**
 * Create a filter function that includes only matching patterns
 * @param includePatterns - Patterns to include (string or array)
 * @param options - Optional configuration
 * @returns Function that filters to only matching items
 */
export const createIncludeFilter = (
  includePatterns: string | string[],
  options: MatcherOptions = {},
) => {
  const patterns = normalizePatterns(includePatterns);
  const matchers = createMatchers(patterns, options);

  return <T extends { name: string }>(items: T[]): T[] =>
    items.filter((item) => matchers.some((matcher) => matcher(item.name)));
};

// ============================================================================
// Default Export
// ============================================================================

export default {
  match,
  isMatch,
  createMatcher,
  createMatchers,
  matchAny,
  matchAll,
  filter,
  exclude,
  compile,
  compileAny,
  normalizePatterns,
  createIgnoreFilter,
  createIncludeFilter,
};
