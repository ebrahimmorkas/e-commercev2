/**
 * Turns the flat, active-only category list from GET /category/get-categories
 * into a nested tree, keyed off each category's parent_category_id. Depth is
 * unbounded - a category can have children, grandchildren, and so on - since
 * the backend schema itself places no limit on nesting.
 *
 * Categories already arrive sorted by createdAt ascending; both the Map and
 * the per-parent `children` arrays preserve that order.
 *
 * @param {Array<Object>} categories - raw Category documents
 * @returns {Array<Object>} top-level categories, each with a `children` array
 */
export const buildCategoryTree = (categories = []) => {
  const byId = new Map();
  categories.forEach((category) => {
    byId.set(String(category._id), { ...category, children: [] });
  });

  const roots = [];
  byId.forEach((node) => {
    const parentId = node.parent_category_id ? String(node.parent_category_id) : null;
    const parent = parentId ? byId.get(parentId) : null;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
};

export default buildCategoryTree;
