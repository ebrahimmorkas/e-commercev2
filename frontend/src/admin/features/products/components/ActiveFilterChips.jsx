import { useMemo } from 'react';
import Badge from '../../../../components/common/Badge';
import { getStockStatusOptions } from '../utils/productListFilters';
import theme from '../theme/theme';

// "Mobiles / Vivo / V11" for the picked category, walking up parent_category_id.
const categoryPathLabel = (categories, categoryId) => {
  const byId = new Map(categories.map((c) => [String(c._id), c]));
  const names = [];
  let current = byId.get(String(categoryId));
  while (current) {
    names.unshift(current.categoryName);
    current = current.parent_category_id ? byId.get(String(current.parent_category_id)) : null;
  }
  return names.join(' / ');
};

/**
 * One removable chip per applied filter, plus "Clear all", shown under the
 * product list toolbar so the admin always sees why rows are missing.
 *
 * @param {Object} props
 * @param {Object} props.filters - applied filters (see EMPTY_PRODUCT_FILTERS)
 * @param {Function} props.onChange - (nextFilters) => void, with one filter removed
 * @param {Function} props.onClearAll
 * @param {Array} props.categories - flat category list, for the category path label
 * @param {Function} props.formatMoney
 * @param {number|null} props.lowStockThreshold
 */
const ActiveFilterChips = ({ filters, onChange, onClearAll, categories = [], formatMoney, lowStockThreshold }) => {
  const chips = useMemo(() => {
    const list = [];
    const categoryId = filters.subCategory || filters.mainCategory;
    if (categoryId) {
      list.push({
        key: 'category',
        label: `Category: ${categoryPathLabel(categories, categoryId) || 'Selected'}`,
        remove: { mainCategory: '', subCategory: '' },
      });
    }

    const hasMin = filters.minPrice !== '';
    const hasMax = filters.maxPrice !== '';
    if (hasMin || hasMax) {
      let range = `${formatMoney(Number(filters.minPrice))} – ${formatMoney(Number(filters.maxPrice))}`;
      if (!hasMax) range = `${formatMoney(Number(filters.minPrice))} and above`;
      if (!hasMin) range = `Up to ${formatMoney(Number(filters.maxPrice))}`;
      list.push({ key: 'price', label: `Price: ${range}`, remove: { minPrice: '', maxPrice: '' } });
    }

    if (filters.stockStatus) {
      const option = getStockStatusOptions(lowStockThreshold).find((o) => o.value === filters.stockStatus);
      list.push({ key: 'stock', label: `Stock: ${option?.label || filters.stockStatus}`, remove: { stockStatus: '' } });
    }

    const hasMinStock = filters.minStock !== '';
    const hasMaxStock = filters.maxStock !== '';
    if (hasMinStock || hasMaxStock) {
      let stockRange = `${filters.minStock} – ${filters.maxStock}`;
      if (hasMinStock && hasMaxStock && Number(filters.minStock) === Number(filters.maxStock)) stockRange = `Exactly ${filters.minStock}`;
      else if (!hasMaxStock) stockRange = `${filters.minStock} and above`;
      else if (!hasMinStock) stockRange = `Up to ${filters.maxStock}`;
      list.push({ key: 'stock range', label: `Stock: ${stockRange}`, remove: { minStock: '', maxStock: '' } });
    }
    return list;
  }, [filters, categories, formatMoney, lowStockThreshold]);

  if (chips.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant="blue"
          size="lg"
          shape="pill"
          onRemove={() => onChange({ ...filters, ...chip.remove })}
          removeLabel={`Remove ${chip.key} filter`}
        >
          {chip.label}
        </Badge>
      ))}
      {chips.length > 1 && (
        <button type="button" onClick={onClearAll} className={`text-sm underline cursor-pointer ${theme.text.body} hover:text-gray-900`}>
          Clear all
        </button>
      )}
    </div>
  );
};

export default ActiveFilterChips;
