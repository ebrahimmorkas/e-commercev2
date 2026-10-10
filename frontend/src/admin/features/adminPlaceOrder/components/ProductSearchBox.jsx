import { useEffect, useRef, useState } from 'react';
import SearchInput from '../../../../components/common/SearchInput';

const SEARCH_DEBOUNCE_MS = 300;
const MAX_RESULTS = 10;

/**
 * Product search for the admin product pickers (Place Order, and Edit Order's
 * "add products"): the same search bar the Inventory page uses, with a list
 * of matching products under it like the storefront's search. Picking a
 * result hands the product to the caller, which fills its category and
 * Product dropdowns with it - the variant and size are still chosen from
 * their dropdowns.
 *
 * Searched on the server like the Inventory search: product name or code, or
 * any of its variants' name / color or sizes' name / SKU / barcode (active
 * products only). A result is always the product itself.
 *
 * @param {Object} props
 * @param {(text: string) => Promise<Array<{ _id, name, productCode, mainCategory, subCategory }>>} props.searchProducts
 * @param {(product: Object) => void} props.onSelect
 * @param {string} [props.placeholder]
 */
const ProductSearchBox = ({ searchProducts, onSelect, placeholder = 'Search product, code, variant, size, SKU, barcode…' }) => {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  // `query` is the text the results belong to; while it differs from what is typed, a search is pending.
  const [result, setResult] = useState({ query: '', products: [], error: '' });
  const wrapperRef = useRef(null);
  const trimmed = text.trim();

  useEffect(() => {
    if (!trimmed) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchProducts(trimmed)
        .then((list) => {
          if (!cancelled) setResult({ query: trimmed, products: Array.isArray(list) ? list.slice(0, MAX_RESULTS) : [], error: '' });
        })
        .catch((err) => {
          if (!cancelled) setResult({ query: trimmed, products: [], error: err.message || 'Search failed. Please try again.' });
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trimmed, searchProducts]);

  // Close when clicking anywhere outside the search box.
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const loading = trimmed !== '' && result.query !== trimmed;
  const products = loading ? [] : result.products;
  const showPanel = open && trimmed !== '';

  const handleChange = (value) => {
    setText(value);
    setHighlight(-1);
    setOpen(true);
  };

  const pickProduct = (product) => {
    setText('');
    setOpen(false);
    setHighlight(-1);
    onSelect(product);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'ArrowDown' && products.length > 0) {
      e.preventDefault();
      setOpen(true);
      setHighlight((index) => (index + 1) % products.length);
    } else if (e.key === 'ArrowUp' && products.length > 0) {
      e.preventDefault();
      setHighlight((index) => (index <= 0 ? products.length - 1 : index - 1));
    } else if (e.key === 'Enter') {
      // Never submit the surrounding form from the search box.
      e.preventDefault();
      if (showPanel && products.length > 0) pickProduct(products[highlight >= 0 ? highlight : 0]);
    }
  };

  return (
    <div ref={wrapperRef} className="relative" onKeyDown={handleKeyDown} onFocus={() => setOpen(true)}>
      <SearchInput
        value={text}
        onChange={handleChange}
        placeholder={placeholder}
        ariaLabel="Search products"
        className="mb-0!"
      />

      {showPanel && (
        <div
          role="listbox"
          aria-label="Matching products"
          className="absolute left-0 top-full mt-1 z-30 w-full sm:max-w-sm max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          {loading && <p className="px-4 py-3 text-sm text-gray-500">Searching...</p>}
          {!loading && result.error && <p className="px-4 py-3 text-sm text-red-600">{result.error}</p>}
          {!loading && !result.error && products.length === 0 && (
            <p className="px-4 py-3 text-sm text-gray-500">No products match &ldquo;{trimmed}&rdquo;</p>
          )}
          {!loading &&
            products.map((product, index) => (
              <button
                key={product._id}
                type="button"
                role="option"
                aria-selected={index === highlight}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => pickProduct(product)}
                className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left cursor-pointer ${
                  index === highlight ? 'bg-blue-50' : ''
                }`}
              >
                <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{product.name}</span>
                {product.productCode && <span className="shrink-0 text-xs text-gray-400">{product.productCode}</span>}
              </button>
            ))}
        </div>
      )}
    </div>
  );
};

export default ProductSearchBox;
