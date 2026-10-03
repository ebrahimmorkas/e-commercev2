import { useEffect, useState } from 'react';
import { getStorefrontProducts } from '../api/productApi';
import { shapeProductForCard } from '../utils/shapeProduct';

const DEBOUNCE_MS = 300;
const MIN_CHARS = 2;
const SUGGESTION_COUNT = 6;
const MAX_CACHED_QUERIES = 30;

// Query -> suggestions, for the page's lifetime. Retyping or backspacing to a
// query already searched costs no request. Oldest entry goes first when full.
const cache = new Map();

const remember = (query, products) => {
  cache.set(query, products);
  if (cache.size > MAX_CACHED_QUERIES) cache.delete(cache.keys().next().value);
};

/**
 * Typeahead results for the header search box.
 *
 * Waits DEBOUNCE_MS after the last keystroke before asking the server, asks
 * for only a handful of products, and aborts the previous request when the
 * text changes, so a slow earlier response can never replace a newer one.
 * Failures just yield no suggestions - Enter still runs the full search.
 *
 * @param {string} text - Raw input value.
 * @returns {{ suggestions: Array<{ id: string, name: string, image: string|null, price: number|null }>, loading: boolean, query: string }}
 *   `query` is the trimmed text the suggestions belong to.
 */
export const useSearchSuggestions = (text) => {
  const query = text.trim();
  const active = query.length >= MIN_CHARS;
  // Results are stored with the query they answer; "loading" means none yet.
  const [result, setResult] = useState({ query: '', products: [] });

  useEffect(() => {
    if (!active || cache.has(query)) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      getStorefrontProducts({ q: query, limit: SUGGESTION_COUNT }, { signal: controller.signal })
        .then((data) => {
          const products = (data?.products || []).map((p) => shapeProductForCard(p));
          remember(query, products);
          setResult({ query, products });
        })
        .catch((err) => {
          if (err?.name !== 'AbortError') setResult({ query, products: [] });
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, active]);

  if (!active) return { suggestions: [], loading: false, query };
  if (cache.has(query)) return { suggestions: cache.get(query), loading: false, query };
  if (result.query === query) return { suggestions: result.products, loading: false, query };
  return { suggestions: [], loading: true, query };
};

export default useSearchSuggestions;
