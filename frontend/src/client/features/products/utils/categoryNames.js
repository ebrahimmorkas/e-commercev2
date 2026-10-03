import { getStorefrontCategories } from '../api/productApi';

// Category id -> name, used to label product cards. Fetched once per page
// load and shared by every product list (home, all products, category,
// recommendations) instead of each list refetching it. Best-effort: if the
// category feature is off or the call fails, cards fall back to a colour
// label, and the next caller retries.
let categoryNamesPromise = null;

export const loadCategoryNameMap = () => {
  if (!categoryNamesPromise) {
    categoryNamesPromise = getStorefrontCategories()
      .then((categories) => new Map((categories || []).map((c) => [String(c._id), c.categoryName])))
      .catch(() => {
        categoryNamesPromise = null;
        return new Map();
      });
  }
  return categoryNamesPromise;
};

export default loadCategoryNameMap;
