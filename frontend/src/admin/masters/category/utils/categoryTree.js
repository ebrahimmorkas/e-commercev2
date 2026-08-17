/**
 * Client-side helpers for turning the flat category list the API returns
 * (each row only knows its own parent_category_id) into an ordered,
 * indentable tree for the table, and for answering "which ids sit under X"
 * questions needed to keep the parent-category picker from offering cycles.
 */

const parentKey = (category) => (category.parent_category_id ? String(category.parent_category_id) : null);

/**
 * Depth-first, ordered flat list: [{ ...category, depth }], parents always
 * immediately followed by their children so the table can indent by depth
 * without needing to actually nest <tr>s.
 */
export const flattenToTree = (categories) => {
  const byParent = new Map();
  categories.forEach((category) => {
    const key = parentKey(category);
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(category);
  });

  const result = [];
  const visit = (parentId, depth) => {
    const children = byParent.get(parentId) || [];
    children.forEach((category) => {
      result.push({ ...category, depth });
      visit(String(category._id), depth + 1);
    });
  };

  visit(null, 0);
  return result;
};

/**
 * All descendant _ids of categoryId (not including categoryId itself),
 * mirroring the backend's getDescendantIds - used to stop the UI from even
 * offering a self/descendant as a new parent (the backend still enforces
 * this; this is purely to avoid a round trip for an obviously-bad choice).
 */
export const getDescendantIds = (categories, categoryId) => {
  const idStr = String(categoryId);
  const childrenOf = new Map();
  categories.forEach((category) => {
    const key = parentKey(category);
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key).push(category);
  });

  const descendants = [];
  const walk = (id) => {
    const children = childrenOf.get(id) || [];
    children.forEach((child) => {
      descendants.push(String(child._id));
      walk(String(child._id));
    });
  };

  walk(idStr);
  return descendants;
};
