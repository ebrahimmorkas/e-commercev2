/**
 * Search box for filtering an in-memory list, used above the admin list pages.
 * Controlled: the parent owns the term and does the filtering.
 *
 * @param {Object} props - Component properties
 * @param {string} props.value - Current search term
 * @param {Function} props.onChange - Called with the new term string (not the event); called with '' by the clear button
 * @param {string} props.placeholder - Placeholder text
 * @param {string} props.ariaLabel - Accessible label for the input
 * @param {number} props.matchCount - Rows matching the current term (shown with totalCount while searching)
 * @param {number} props.totalCount - Rows in the unfiltered list
 * @param {string} props.itemLabel - Plural noun for the count, e.g. "products"
 * @param {string} props.className - Additional CSS classes for the outer wrapper
 */
const SearchInput = ({
  value,
  onChange,
  placeholder = 'Search…',
  ariaLabel = 'Search',
  matchCount,
  totalCount,
  itemLabel = 'results',
  className = '',
}) => {
  const isSearching = value.trim() !== '';
  const showCount = isSearching && matchCount !== undefined && totalCount !== undefined;

  return (
    <div className={`mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 ${className}`}>
      <div className="relative w-full sm:max-w-sm">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
          </svg>
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className="w-full pl-9 pr-9 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
        />
        {isSearching && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded cursor-pointer text-gray-400 hover:bg-gray-100"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {showCount && (
        <span className="text-sm text-gray-400" aria-live="polite">
          {matchCount} of {totalCount} {itemLabel}
        </span>
      )}
    </div>
  );
};

export default SearchInput;
