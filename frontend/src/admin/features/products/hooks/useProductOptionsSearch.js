import { useEffect, useMemo, useState } from 'react';
import { getProductOptionsAdmin } from '../api/productApi';

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_LIMIT = 30;

const labelOf = (row) => `${row.name}${row.productCode ? ` (${row.productCode})` : ''}`;

/**
 * Options for a product picker (a searchable Dropdown), searched on the
 * server as the admin types instead of loading the whole catalogue into the
 * dropdown - stays instant with tens of thousands of products. Already
 * selected products are resolved by id so their chips keep a proper label
 * even when they aren't in the current search results.
 *
 * @param {Object} options
 * @param {string[]} [options.selectedIds]
 * @param {'A'|'I'} [options.status] - Only offer products with this status (omit for both).
 * @param {string} [options.excludeId] - E.g. the product being edited, which can't recommend itself.
 * @param {boolean} [options.enabled=true]
 * @returns {{ options: Array<{ value, label, isActive }>, onSearchChange: (text: string) => void, loading: boolean }}
 */
export const useProductOptionsSearch = ({ selectedIds = [], status, excludeId, enabled = true } = {}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ query: null, rows: [] });
  const [knownRows, setKnownRows] = useState(() => new Map());

  // Debounced server search; the first (empty) search lists the first products by name.
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await getProductOptionsAdmin({ q: query.trim(), status, limit: SEARCH_LIMIT });
        if (!cancelled) setResults({ query, rows: data?.products || [] });
      } catch {
        if (!cancelled) setResults({ query, rows: [] });
      }
    }, query ? SEARCH_DEBOUNCE_MS : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, status, enabled]);

  // Labels for selected ids the picker hasn't seen yet (e.g. a product's saved recommendations).
  const missingKey = selectedIds.filter((id) => !knownRows.has(String(id))).sort().join(',');
  useEffect(() => {
    if (!enabled || !missingKey) return undefined;
    let cancelled = false;
    getProductOptionsAdmin({ ids: missingKey.split(',') })
      .then((data) => {
        if (cancelled) return;
        setKnownRows((prev) => {
          const next = new Map(prev);
          (data?.products || []).forEach((row) => next.set(String(row._id), row));
          return next;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [missingKey, enabled]);

  const options = useMemo(() => {
    const toOption = (row) => ({ value: String(row._id), label: labelOf(row), isActive: row.status === 'A' });
    const selectedSet = new Set(selectedIds.map(String));
    const searchRows = new Map(results.rows.map((row) => [String(row._id), row]));

    // Selected first (so their chips always have a label), then the search results.
    const selected = selectedIds.map((id) => {
      const row = searchRows.get(String(id)) || knownRows.get(String(id));
      return row ? toOption(row) : { value: String(id), label: 'Loading...', isActive: true };
    });
    const matches = results.rows
      .filter((row) => !selectedSet.has(String(row._id)) && String(row._id) !== String(excludeId))
      .map(toOption);
    return [...selected, ...matches];
  }, [results.rows, knownRows, selectedIds, excludeId]);

  return { options, onSearchChange: setQuery, loading: enabled && results.query !== query };
};

export default useProductOptionsSearch;
