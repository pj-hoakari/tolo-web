/** 名前・ID の部分一致。前後の空白、英字の大小、全角・半角を区別しない。 */
export function matchesSearch(query: string, ...values: string[]): boolean {
  const normalizedQuery = query.normalize("NFKC").trim().toLowerCase();
  return values.some((value) =>
    value.normalize("NFKC").toLowerCase().includes(normalizedQuery),
  );
}
