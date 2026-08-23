import { useMemo } from 'react';
import Dropdown from '../../../../components/common/DropDown';
import theme from '../theme/theme';

/**
 * Drill-down category picker for arbitrarily deep category trees.
 *
 * The Product schema only stores two ids - `mainCategory` (must be a root
 * category) and `subCategory` (must be a descendant of it, at ANY depth -
 * see productValidations.js's category-hierarchy rule) - but the category
 * tree itself can nest past one level (see admin/masters/category). So this
 * renders the picked path as a breadcrumb (root -> ... -> deepest pick) and
 * always offers one more dropdown for the next level down, for as long as
 * the deepest pick still has active children. `mainCategory` is path[0];
 * `subCategory` is the deepest node in the path (or empty if the path is
 * just the root).
 *
 * Clicking a breadcrumb crumb re-opens that level for reselection, dropping
 * everything picked after it - that's the "go back" affordance.
 */
const CategoryPathPicker = ({ categories = [], mainCategoryId, subCategoryId, onChange, nestingAllowed = true }) => {
  const categoryById = useMemo(() => {
    const map = new Map();
    categories.forEach((c) => map.set(String(c._id), c));
    return map;
  }, [categories]);

  const childrenOf = (parentId) =>
    categories
      .filter((c) => c.status === 'A' && String(c.parent_category_id || '') === String(parentId || ''))
      .map((c) => ({ value: String(c._id), label: c.categoryName }));

  // Reconstruct the full root->leaf chain by walking parent_category_id up
  // from whichever id is deepest (subCategory if set, else mainCategory).
  const path = useMemo(() => {
    const leafId = subCategoryId || mainCategoryId;
    if (!leafId) return [];
    const chain = [];
    let current = categoryById.get(String(leafId));
    while (current) {
      chain.unshift(current);
      current = current.parent_category_id ? categoryById.get(String(current.parent_category_id)) : null;
    }
    return chain;
  }, [categoryById, mainCategoryId, subCategoryId]);

  const applyPath = (nextPath) => {
    const main = nextPath.length > 0 ? String(nextPath[0]._id) : '';
    const sub = nextPath.length > 1 ? String(nextPath[nextPath.length - 1]._id) : '';
    onChange(main, sub);
  };

  // Keep the path up to (but not including) the clicked crumb, re-exposing
  // the dropdown for that position so a sibling can be picked instead.
  const handleCrumbClick = (index) => applyPath(path.slice(0, index));
  const handleClear = () => onChange('', '');

  const parentForNextLevel = path.length > 0 ? path[path.length - 1] : null;
  const nextLevelOptions = childrenOf(parentForNextLevel ? parentForNextLevel._id : null);
  const canDrillDeeper = path.length === 0 || nestingAllowed;
  const showNextDropdown = canDrillDeeper && nextLevelOptions.length > 0;

  const handleNextLevelChange = (val) => {
    if (!val) return;
    const picked = categoryById.get(String(val));
    if (!picked) return;
    applyPath([...path, picked]);
  };

  return (
    <div className="space-y-2">
      {path.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {path.map((cat, index) => (
            <span key={cat._id} className="flex items-center gap-1.5">
              {index > 0 && <span className={`text-sm ${theme.text.muted}`}>/</span>}
              <button
                type="button"
                onClick={() => handleCrumbClick(index)}
                title="Click to go back and pick a different one here"
                className={`px-2.5 py-1 rounded-lg border text-sm transition-colors ${
                  index === path.length - 1
                    ? 'border-blue-200 bg-blue-50 text-blue-700 font-medium'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {cat.categoryName}
              </button>
            </span>
          ))}
          <button type="button" onClick={handleClear} className={`ml-1 text-xs underline ${theme.text.muted} hover:text-gray-700`}>
            Clear
          </button>
        </div>
      )}

      {showNextDropdown && (
        <Dropdown
          label={path.length === 0 ? 'Main Category' : undefined}
          placeholder={path.length === 0 ? 'Select main category' : `Select sub-category of ${parentForNextLevel.categoryName}`}
          options={nextLevelOptions}
          value=""
          onChange={handleNextLevelChange}
          searchable
        />
      )}

      {!showNextDropdown && path.length === 0 && <p className={`text-sm ${theme.text.muted}`}>No categories available.</p>}
    </div>
  );
};

export default CategoryPathPicker;
