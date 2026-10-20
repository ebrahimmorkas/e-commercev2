import { useState } from 'react';
import Modal from '../../../../components/common/Modal';
import Button from '../../../../components/common/Buttons';
import InputField from '../../../../components/common/InputField';
import CategoryPathPicker from '../../../../components/common/CategoryPathPicker';
import { EMPTY_PRODUCT_FILTERS, getStockStatusOptions, hasStockRange, validatePriceRange, validateStockRange } from '../utils/productListFilters';
import theme from '../theme/theme';

const FilterSection = ({ title, description, children }) => (
  <section className="space-y-3">
    <div>
      <h3 className={`text-sm font-semibold ${theme.text.heading}`}>{title}</h3>
      {description && <p className={`text-xs mt-0.5 ${theme.text.muted}`}>{description}</p>}
    </div>
    {children}
  </section>
);

/**
 * Filter panel for the admin product list. Edits a local draft and only hands
 * it to `onApply` on "Apply", so the list doesn't refetch on every keystroke.
 * Mount it only while open - the draft is seeded from `filters` on mount.
 *
 * @param {Object} props
 * @param {Function} props.onClose
 * @param {Object} props.filters - currently applied filters (see EMPTY_PRODUCT_FILTERS)
 * @param {Function} props.onApply - (filters) => void
 * @param {Array} props.categories - flat category list (lookups.categories)
 * @param {boolean} props.isCategoryFeatureOn - hides the Category section when off
 * @param {boolean} props.isCategoryNestingAllowed
 * @param {number|null} props.lowStockThreshold
 * @param {string} props.currencySymbol - store currency symbol for the price labels
 */
const ProductFilterModal = ({
  onClose,
  filters,
  onApply,
  categories,
  isCategoryFeatureOn,
  isCategoryNestingAllowed,
  lowStockThreshold,
  currencySymbol,
}) => {
  const [draft, setDraft] = useState(() => ({ ...EMPTY_PRODUCT_FILTERS, ...filters }));
  const patch = (changes) => setDraft((prev) => ({ ...prev, ...changes }));
  const priceError = validatePriceRange(draft.minPrice, draft.maxPrice);
  const stockError = validateStockRange(draft.minStock, draft.maxStock);
  const isStockRangeSet = hasStockRange(draft);
  const priceSuffix = currencySymbol ? ` (${currencySymbol})` : '';
  const stockOptions = [{ value: '', label: 'Any', hint: 'All stock levels' }, ...getStockStatusOptions(lowStockThreshold)];

  // Stock status and stock range are one or the other: picking a status
  // clears the range, typing a range resets the status to "Any".
  const pickStockStatus = (stockStatus) => patch({ stockStatus, minStock: '', maxStock: '' });
  const patchStockRange = (changes) => patch({ ...changes, stockStatus: '' });

  const handleApply = (e) => {
    e?.preventDefault();
    if (priceError || stockError) return;
    onApply({
      ...draft,
      minPrice: String(draft.minPrice).trim(),
      maxPrice: String(draft.maxPrice).trim(),
      minStock: String(draft.minStock).trim(),
      maxStock: String(draft.maxStock).trim(),
    });
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Filter products"
      size="md"
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant={theme.button.ghost} onClick={() => setDraft(EMPTY_PRODUCT_FILTERS)}>
            Reset all
          </Button>
          <div className="flex items-center gap-2">
            <Button variant={theme.button.secondary} onClick={onClose}>
              Cancel
            </Button>
            <Button variant={theme.button.primary} onClick={handleApply} disabled={!!priceError || !!stockError}>
              Apply filters
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleApply} className="space-y-6">
        {isCategoryFeatureOn && (
          <FilterSection title="Category" description="Includes products in every sub category below the one you pick.">
            <CategoryPathPicker
              categories={categories}
              mainCategoryId={draft.mainCategory}
              subCategoryId={draft.subCategory}
              nestingAllowed={isCategoryNestingAllowed}
              onChange={(mainCategory, subCategory) => patch({ mainCategory, subCategory })}
            />
          </FilterSection>
        )}

        <FilterSection title="Price" description="Shows products with at least one size priced in this range.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputField
              type="number"
              className="w-full min-w-0"
              label={`Min price${priceSuffix}`}
              placeholder="0"
              value={draft.minPrice}
              onChange={(e) => patch({ minPrice: e.target.value })}
            />
            <InputField
              type="number"
              className="w-full min-w-0"
              label={`Max price${priceSuffix}`}
              placeholder="No limit"
              value={draft.maxPrice}
              onChange={(e) => patch({ maxPrice: e.target.value })}
            />
          </div>
          {priceError && <p className={`text-sm ${theme.text.error}`}>{priceError}</p>}
        </FilterSection>

        <FilterSection title="Stock" description="Based on the total stock of all sizes.">
          <div role="radiogroup" aria-label="Stock status" className="grid grid-cols-2 gap-2">
            {stockOptions.map((option) => {
              // "Any" isn't highlighted while a stock range is in use - the range is the stock filter then.
              const selected = draft.stockStatus === option.value && !(option.value === '' && isStockRangeSet);
              return (
                <button
                  key={option.value || 'any'}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => pickStockStatus(option.value)}
                  className={`text-left rounded-lg border px-3 py-2 transition-colors cursor-pointer ${
                    selected ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <span className={`block text-sm font-medium ${selected ? 'text-blue-700' : theme.text.heading}`}>{option.label}</span>
                  <span className={`block text-xs ${theme.text.muted}`}>{option.hint}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <span className="h-px flex-1 bg-gray-200" />
            <span className={`text-xs font-medium uppercase tracking-wide ${theme.text.muted}`}>or enter a stock range</span>
            <span className="h-px flex-1 bg-gray-200" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputField
              type="number"
              className="w-full min-w-0"
              label="Min stock"
              placeholder="0"
              min={0}
              step={1}
              value={draft.minStock}
              onChange={(e) => patchStockRange({ minStock: e.target.value })}
            />
            <InputField
              type="number"
              className="w-full min-w-0"
              label="Max stock"
              placeholder="No limit"
              min={0}
              step={1}
              value={draft.maxStock}
              onChange={(e) => patchStockRange({ maxStock: e.target.value })}
            />
          </div>
          {stockError ? (
            <p className={`text-sm ${theme.text.error}`}>{stockError}</p>
          ) : (
            <p className={`text-xs ${theme.text.muted}`}>Enter the same number in both for an exact stock, e.g. 10 and 10.</p>
          )}
        </FilterSection>
        {/* Lets Enter in a price or stock box apply the filters. */}
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
};

export default ProductFilterModal;
