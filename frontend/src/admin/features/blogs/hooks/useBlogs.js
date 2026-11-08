import { useCallback, useEffect, useState } from 'react';
import * as blogApi from '../api/blogApi';
import { useToast } from '../../../../components/common/Toast';

const PAGE_SIZE = 50;

/**
 * Owns the blog list for the admin page: the first page loads on mount, more
 * can be appended with loadMore(), and every mutation surfaces errors via toast
 * and returns a boolean rather than throwing.
 */
export const useBlogs = () => {
  const [blogs, setBlogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [mutating, setMutating] = useState(false);
  const toast = useToast();

  // Reloads from the first page (after a mutation the list may have shifted).
  const fetchBlogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await blogApi.getAllBlogsAdmin({ page: 1, limit: PAGE_SIZE });
      setBlogs(Array.isArray(data?.blogs) ? data.blogs : []);
      setTotal(data?.total ?? 0);
      setHasMore(!!data?.hasMore);
    } catch (err) {
      setError(err.message || 'Failed to load blog posts');
      setBlogs([]);
      setTotal(0);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBlogs();
  }, [fetchBlogs]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = Math.floor(blogs.length / PAGE_SIZE) + 1;
      const data = await blogApi.getAllBlogsAdmin({ page: nextPage, limit: PAGE_SIZE });
      setBlogs((prev) => [...prev, ...(data?.blogs || [])]);
      setHasMore(!!data?.hasMore);
    } catch (err) {
      toast.error(err.message || 'Failed to load more posts');
    } finally {
      setLoadingMore(false);
    }
  };

  const run = async (action, successMessage, failureMessage) => {
    setMutating(true);
    try {
      const result = await action();
      if (successMessage) toast.success(successMessage);
      await fetchBlogs();
      return result ?? true;
    } catch (err) {
      toast.error(err.message || failureMessage);
      return false;
    } finally {
      setMutating(false);
    }
  };

  const createBlog = (fields, coverImage) =>
    run(() => blogApi.addBlog(fields, coverImage), 'Blog post added successfully', 'Failed to add blog post');

  const editBlog = (blogId, fields, coverImage) =>
    run(() => blogApi.updateBlog(blogId, fields, coverImage), 'Blog post updated successfully', 'Failed to update blog post');

  const removeBlog = (blogId) =>
    run(() => blogApi.deleteBlog(blogId), 'Blog post deleted successfully', 'Failed to delete blog post');

  const toggleStatus = (blog) =>
    run(
      () => blogApi.updateBlog(blog._id, { status: blog.status === 'A' ? 'I' : 'A' }),
      blog.status === 'A' ? 'Moved to drafts' : 'Published',
      'Failed to update blog post'
    );

  const describeBulkOutcome = (data, pastTenseVerb) => {
    const successCount = data?.successCount ?? 0;
    const failureCount = data?.failureCount ?? 0;
    if (failureCount === 0) toast.success(`${successCount} post(s) ${pastTenseVerb}`);
    else if (successCount === 0) toast.error('Could not update the selected post(s)');
    else toast.warning(`${successCount} post(s) ${pastTenseVerb}, ${failureCount} could not be processed`);
  };

  const bulkToggleStatus = async (blogIds, status) => {
    if (!blogIds?.length) return null;
    setMutating(true);
    try {
      const data = await blogApi.bulkSetBlogStatus(blogIds, status);
      describeBulkOutcome(data, status === 'A' ? 'published' : 'moved to drafts');
      await fetchBlogs();
      return data;
    } catch (err) {
      toast.error(err.message || 'Failed to update posts');
      return null;
    } finally {
      setMutating(false);
    }
  };

  const bulkRemoveBlogs = async (blogIds) => {
    if (!blogIds?.length) return null;
    setMutating(true);
    try {
      const data = await blogApi.bulkDeleteBlogs(blogIds);
      describeBulkOutcome(data, 'deleted');
      await fetchBlogs();
      return data;
    } catch (err) {
      toast.error(err.message || 'Failed to delete posts');
      return null;
    } finally {
      setMutating(false);
    }
  };

  return {
    blogs, total, hasMore, loading, loadingMore, error, mutating,
    refetch: fetchBlogs, loadMore,
    createBlog, editBlog, removeBlog, toggleStatus, bulkToggleStatus, bulkRemoveBlogs,
  };
};

export default useBlogs;
