import { useEffect, useState } from 'react';
import EmptyState from '../../../../components/common/EmptyState/EmptyState';
import { useStorefrontCompanySettings } from '../../companySettings/hooks/useStorefrontCompanySettings';
import { useStorefrontBlogs } from '../hooks/useStorefrontBlogs';
import BlogCard, { BlogCardSkeleton } from '../components/BlogCard';

const SEARCH_DEBOUNCE_MS = 350;

const SearchIcon = () => (
  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
  </svg>
);

const pillClass = (active) =>
  `px-4 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer ${
    active
      ? 'bg-slate-900 border-slate-900 text-white'
      : 'bg-white border-slate-200 text-slate-600 hover:border-brand-400 hover:text-brand-700'
  }`;

/**
 * /blog - a header band, search and category filters, a featured post and a
 * grid of the rest with "Load more".
 *
 * @param {(slug: string) => void} props.onOpenPost
 */
const BlogListPage = ({ onOpenPost }) => {
  const { companySettings } = useStorefrontCompanySettings();
  const title = companySettings?.blogNavLabel || 'Blog';

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  // Search as you type, but only hit the server once typing pauses.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const previous = document.title;
    document.title = companySettings?.companyName ? `${title} | ${companySettings.companyName}` : title;
    return () => {
      document.title = previous;
    };
  }, [title, companySettings?.companyName]);

  const { blogs, total, hasMore, categories, error, loading, loadingMore, loadMore } = useStorefrontBlogs({ search, category });

  const isFiltering = Boolean(search || category);
  // Unfiltered, the first post is shown large; any search/filter shows a plain grid.
  const featured = !isFiltering && blogs.length > 0 ? blogs[0] : null;
  const gridPosts = featured ? blogs.slice(1) : blogs;

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setCategory('');
  };

  return (
    <div className="bg-slate-50 min-h-[60vh]">
      <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-4 sm:px-6 py-14 sm:py-20">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm font-semibold tracking-wide uppercase text-brand-400">Stories &amp; Updates</p>
          <h1 className="mt-3 text-3xl sm:text-5xl font-bold text-white">{title}</h1>
          <p className="mt-4 max-w-xl mx-auto text-slate-300">
            Guides, news and ideas from {companySettings?.companyName || 'our team'}.
          </p>
          <div className="mt-8 max-w-md mx-auto relative">
            <span className="absolute inset-y-0 left-4 flex items-center pointer-events-none"><SearchIcon /></span>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search articles"
              aria-label="Search articles"
              className="w-full rounded-full bg-white pl-11 pr-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        {categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-8" role="group" aria-label="Filter by category">
            <button type="button" className={pillClass(category === '')} onClick={() => setCategory('')}>
              All
            </button>
            {categories.map((item) => (
              <button
                key={item.name}
                type="button"
                className={pillClass(category === item.name)}
                onClick={() => setCategory(category === item.name ? '' : item.name)}
              >
                {item.name} <span className="opacity-60">({item.count})</span>
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="space-y-8">
            <div className="h-80 rounded-2xl bg-slate-200 animate-pulse" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[0, 1, 2].map((n) => <BlogCardSkeleton key={n} />)}
            </div>
          </div>
        ) : error ? (
          <EmptyState title="Could not load the blog" description={error} />
        ) : blogs.length === 0 ? (
          <EmptyState
            title={isFiltering ? 'No articles match' : 'No articles yet'}
            description={isFiltering ? 'Try a different word or category.' : 'Check back soon for new stories.'}
            action={
              isFiltering ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="px-4 py-2 rounded-full text-sm font-semibold bg-brand-500 hover:bg-brand-400 text-slate-900 cursor-pointer"
                >
                  Clear filters
                </button>
              ) : null
            }
          />
        ) : (
          <>
            {isFiltering && (
              <p className="mb-5 text-sm text-slate-500">
                {total} article{total === 1 ? '' : 's'} found
              </p>
            )}
            {featured && (
              <div className="mb-8">
                <BlogCard blog={featured} onOpen={onOpenPost} featured />
              </div>
            )}
            {gridPosts.length > 0 && (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {gridPosts.map((post) => (
                  <BlogCard key={post._id} blog={post} onOpen={onOpenPost} />
                ))}
              </div>
            )}
            {hasMore && (
              <div className="mt-10 flex justify-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-6 py-3 rounded-full text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-60 cursor-pointer"
                >
                  {loadingMore ? 'Loading…' : 'Load more articles'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default BlogListPage;
