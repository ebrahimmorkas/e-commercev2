import { useMemo, useState } from 'react';
import CategoryPathPicker from '../../../../components/common/CategoryPathPicker';
import Badge from '../../../../components/common/Badge';
import Button from '../../../../components/common/Buttons';

// Walks parent_category_id up from `id` to build a "Root / Child / Grandchild"
// breadcrumb label for a chip - mirrors CategoryPathPicker's own path builder.
const buildBreadcrumbLabel = (categoryById, id) => {
  const chain = [];
  let current = categoryById.get(String(id));
  while (current) {
    chain.unshift(current.categoryName);
    current = current.parent_category_id ? categoryById.get(String(current.parent_category_id)) : null;
  }
  return chain.length > 0 ? chain.join(' / ') : id;
};

/**
 * Members field for CATEGORY groups - picks one category path at a time via
 * CategoryPathPicker (the same drill-down component Add Product uses), adds
 * it as a chip, and repeats. When `nestingAllowed` is false,
 * CategoryPathPicker itself stops offering a second-level dropdown, so only
 * root (main) categories can ever be added here.
 *
 * @param {Array} categories - flat list of every category (any depth)
 * @param {string[]} value - selected category ids
 * @param {(ids: string[]) => void} onChange
 * @param {boolean} nestingAllowed
 * @param {string} [error]
 */
const CategoryMembersPicker = ({ categories = [], value = [], onChange, nestingAllowed = true, error = '' }) => {
  const [draftMain, setDraftMain] = useState('');
  const [draftSub, setDraftSub] = useState('');

  const categoryById = useMemo(() => {
    const map = new Map();
    categories.forEach((c) => map.set(String(c._id), c));
    return map;
  }, [categories]);

  const draftLeafId = draftSub || draftMain;
  const alreadyAdded = draftLeafId && value.includes(draftLeafId);

  const handleAdd = () => {
    if (!draftLeafId || alreadyAdded) return;
    onChange([...value, draftLeafId]);
    setDraftMain('');
    setDraftSub('');
  };

  const removeMember = (id) => onChange(value.filter((memberId) => memberId !== id));

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Members <span className="text-red-500 ml-1">*</span>
      </label>

      <div className="flex items-start gap-2">
        <div className="flex-1">
          <CategoryPathPicker
            categories={categories}
            mainCategoryId={draftMain}
            subCategoryId={draftSub}
            nestingAllowed={nestingAllowed}
            onChange={(main, sub) => {
              setDraftMain(main);
              setDraftSub(sub);
            }}
          />
        </div>
        <Button type="button" variant="secondary" onClick={handleAdd} disabled={!draftLeafId || alreadyAdded}>
          Add
        </Button>
      </div>

      {alreadyAdded && <p className="mt-1 text-sm text-gray-500">That category is already added.</p>}
      {error && (
        <p className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {value.map((id) => (
            <Badge key={id} variant="purple" onRemove={() => removeMember(id)} removeLabel={`Remove ${buildBreadcrumbLabel(categoryById, id)}`}>
              {buildBreadcrumbLabel(categoryById, id)}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoryMembersPicker;
