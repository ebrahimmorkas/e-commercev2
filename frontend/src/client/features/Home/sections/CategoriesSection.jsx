import { useStorefrontCategories } from '../../categories/hooks/useStorefrontCategories';

/** Strip of top-level categories linking to their listing pages. Renders nothing when there are none. */
const CategoriesSection = () => {
  const { categoryTree, loading } = useStorefrontCategories();
  if (loading || !categoryTree.length) return null;

  return (
    <section aria-label="Shop by category" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h2 className="text-2xl font-bold text-slate-900">Shop by category</h2>
      <ul className="mt-5 flex flex-wrap gap-3">
        {categoryTree.map((category) => (
          <li key={category._id}>
            <a
              href={`/category/${category._id}`}
              className="inline-block rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-brand-500 hover:text-brand-700"
            >
              {category.categoryName}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default CategoriesSection;
