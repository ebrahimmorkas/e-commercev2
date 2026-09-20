/**
 * Shared matching for the admin list search boxes (see components/common/SearchInput).
 * The lists are already loaded in full, so searching is a client-side filter.
 *
 * A term matches when EVERY whitespace-separated word appears somewhere in the
 * text, in any order, case-insensitively - so "red tee" finds "Tee ... RED".
 * A blank term matches everything.
 */

/** @returns {string[]} the lowercased, non-empty words of a search term */
export const parseSearchTerm = (term) => (term || '').toLowerCase().split(/\s+/).filter(Boolean);

/** @param {string[]} words - from parseSearchTerm; `text` is compared case-insensitively */
export const matchesSearch = (text, words) => {
  if (words.length === 0) return true;
  const haystack = (text || '').toLowerCase();
  return words.every((word) => haystack.includes(word));
};

/**
 * @param {Array} items
 * @param {string} term
 * @param {(item: Object) => Array<string|number|null|undefined>} fieldsOf - the values of `item` that are searchable;
 *   empty ones are skipped
 * @returns {Array} `items` itself (same reference) when the term is blank, so memoised consumers don't re-render
 */
export const filterBySearch = (items, term, fieldsOf) => {
  const words = parseSearchTerm(term);
  if (words.length === 0) return items;
  return items.filter((item) => matchesSearch(fieldsOf(item).filter((v) => v !== null && v !== undefined && v !== '').join(' '), words));
};
