import { useEffect, useState } from 'react';
import { getStorefrontBlogs, getStorefrontBlogPost } from '../api/blogApi';

const PAGE_SIZE = 9;

/**
 * The blog list for the current search/category, a page at a time. `loading`
 * is true from the moment the search/category changes until its first page
 * arrives (derived from the request key, so no stale list ever shows under a
 * new filter).
 *
 * @param {{ search: string, category: string }} filters
 */
export const useStorefrontBlogs = ({ search, category }) => {
  const key = `${search}|${category}`;
  const [state, setState] = useState({ key: null, blogs: [], total: 0, hasMore: false, categories: [], error: '', page: 1 });
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getStorefrontBlogs({ page: 1, limit: PAGE_SIZE, search, category })
      .then((data) => {
        if (cancelled) return;
        setState({
          key,
          blogs: data?.blogs || [],
          total: data?.total ?? 0,
          hasMore: !!data?.hasMore,
          categories: data?.categories || [],
          error: '',
          page: 1,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ key, blogs: [], total: 0, hasMore: false, categories: [], error: err.message || 'Could not load the blog.', page: 1 });
      });
    return () => {
      cancelled = true;
    };
  }, [key, search, category]);

  const loadMore = async () => {
    if (loadingMore || !state.hasMore) return;
    setLoadingMore(true);
    try {
      const data = await getStorefrontBlogs({ page: state.page + 1, limit: PAGE_SIZE, search, category });
      setState((prev) => ({ ...prev, blogs: [...prev.blogs, ...(data?.blogs || [])], hasMore: !!data?.hasMore, page: prev.page + 1 }));
    } catch {
      // Keep what is already on screen; the button stays so the shopper can retry.
    } finally {
      setLoadingMore(false);
    }
  };

  return { ...state, loading: state.key !== key, loadingMore, loadMore };
};

/**
 * One published post (with related posts) by slug.
 * `notFound` is true when the post doesn't exist or isn't published.
 */
export const useStorefrontBlogPost = (slug) => {
  const [state, setState] = useState({ slug: null, blog: null, related: [], notFound: false, error: '' });

  useEffect(() => {
    let cancelled = false;
    getStorefrontBlogPost(slug)
      .then((data) => {
        if (!cancelled) setState({ slug, blog: data?.blog || null, related: data?.related || [], notFound: !data?.blog, error: '' });
      })
      .catch((err) => {
        if (cancelled) return;
        const missing = err.statusCode === 404;
        setState({ slug, blog: null, related: [], notFound: missing, error: missing ? '' : err.message || 'Could not load this post.' });
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { ...state, loading: state.slug !== slug };
};
