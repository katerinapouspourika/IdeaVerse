/** Splits a comma-separated tag field into tags; the API trims, lower-cases, and deduplicates them. */
export function parseTags(text: string): string[] {
  return text
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t !== '');
}

/** Shows tags in a comma-separated field. */
export function formatTags(tags: string[]): string {
  return tags.join(', ');
}
