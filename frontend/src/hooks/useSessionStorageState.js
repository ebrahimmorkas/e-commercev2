import { useCallback, useState } from 'react';

const readValue = (key, defaultValue) => {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw === null ? defaultValue : JSON.parse(raw);
  } catch {
    // Private browsing / blocked storage / corrupt value - fall back silently.
    return defaultValue;
  }
};

/**
 * Drop-in replacement for useState whose value survives a page refresh (but
 * not a closed tab/browser restart) via sessionStorage. Same functional-update
 * signature as useState, so `setValue(prev => ...)` works too.
 *
 * @param {string} key - sessionStorage key, e.g. 'ecom.admin.activePage'
 * @param {*} defaultValue - used when nothing is stored yet, or storage is unavailable
 */
export const useSessionStorageState = (key, defaultValue) => {
  const [value, setValue] = useState(() => readValue(key, defaultValue));

  const setStoredValue = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        try {
          window.sessionStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // sessionStorage unavailable - state still works in-memory for this render.
        }
        return resolved;
      });
    },
    [key]
  );

  return [value, setStoredValue];
};

export default useSessionStorageState;
