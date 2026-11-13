// ABOUTME: Display-only shortening for long hashed identifiers in statement descriptions.
// ABOUTME: The original values remain intact for matching and exports.
export function shortenStatementHashes(value: string): string {
  return value.replace(/\bFrom\s+((?:[a-f0-9]+\s*){1,4})/gi, (match, fragments: string) => {
    const hash = fragments.replace(/\s/g, "");
    if (hash.length < 32) return match;
    return `From ${hash.slice(0, 8)}…${hash.slice(-4)} `;
  }).replace(/\b[a-f0-9]{32,}\b/gi, hash => `${hash.slice(0, 8)}…${hash.slice(-4)}`);
}
