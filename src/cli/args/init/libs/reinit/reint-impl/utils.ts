/**
 * Escapes custom markdown code blocks (''' → ```).
 * Useful for safely embedding markdown in template literals.
 */
export function escapeMarkdownCodeBlocks(input: string): string {
    return input.replace(/'''/g, '```');
}
