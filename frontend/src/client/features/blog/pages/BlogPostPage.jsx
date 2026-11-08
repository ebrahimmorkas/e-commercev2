import { useEffect, useState } from 'react';
import EmptyState from '../../../../components/common/EmptyState/EmptyState';
import { useToast } from '../../../../components/common/Toast';
import { useStorefrontCompanySettings } from '../../companySettings/hooks/useStorefrontCompanySettings';
import { useStorefrontBlogPost } from '../hooks/useStorefrontBlogs';
import BlogCard from '../components/BlogCard';
import BlogContent from '../components/BlogContent';
import { blogPath, formatBlogDate } from '../utils';

const shareButtonClass =
  'inline-flex items-center justify-center px-4 py-2 rounded-full border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:border-amber-400 hover:text-amber-700 transition-colors cursor-pointer';

// Sets the tab title and meta description for the open post, restoring both on leave.
const useDocumentSeo = (title, description) => {
  useEffect(() => {
    if (!title) return undefined;
    const previousTitle = document.title;
    document.title = title;

    let meta = document.querySelector('meta[name="description"]');
    const created = !meta;
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    const previousDescription = meta.getAttribute('content');
    if (description) meta.setAttribute('content', description);

    return () => {
      document.title = previousTitle;
      if (created) meta.remove();
      else if (previousDescription === null) meta.removeAttribute('content');
      else meta.setAttribute('content', previousDescription);
    };
  }, [title, description]);
};

/**
 * /blog/:slug - one article: cover, meta line, body, tags, share buttons and
 * related posts.
 *
 * @param {string} props.slug
 * @param {() => void} props.onBack - back to the blog list
 * @param {(slug: string) => void} props.onOpenPost
 */
const BlogPostPage = ({ slug, onBack, onOpenPost }) => {
  const { blog, related, loading, notFound, error } = useStorefrontBlogPost(slug);
  const { companySettings } = useStorefrontCompanySettings();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const listLabel = companySettings?.blogNavLabel || 'Blog';

  const companyName = companySettings?.companyName;
  useDocumentSeo(
    blog ? `${blog.metaTitle || blog.title}${companyName ? ` | ${companyName}` : ''}` : '',
    blog ? blog.metaDescription || blog.excerpt : ''
  );

  const url = `${window.location.origin}${blogPath(slug)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy the link.');
    }
  };

  const backButton = (
    <button
      type="button"
      onClick={onBack}
      className="text-sm font-medium text-amber-600 hover:text-amber-700 mb-6 cursor-pointer"
    >
      &larr; Back to {listLabel}
    </button>
  );

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 animate-pulse space-y-4" aria-busy="true">
        <div className="h-4 w-24 rounded bg-slate-200" />
        <div className="h-10 w-4/5 rounded bg-slate-200" />
        <div className="h-4 w-1/3 rounded bg-slate-100" />
        <div className="aspect-[16/9] rounded-2xl bg-slate-200" />
        <div className="h-4 w-full rounded bg-slate-100" />
        <div className="h-4 w-full rounded bg-slate-100" />
        <div className="h-4 w-2/3 rounded bg-slate-100" />
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {backButton}
        <EmptyState
          title={notFound ? 'Article not found' : 'Could not load this article'}
          description={notFound ? 'It may have been removed or is not published yet.' : error}
        />
      </div>
    );
  }

  const shareText = encodeURIComponent(blog.title);
  const shareUrl = encodeURIComponent(url);

  return (
    <article className="pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-10">
        {backButton}
        {blog.category && (
          <span className="block text-xs font-semibold tracking-wide uppercase text-amber-700">{blog.category}</span>
        )}
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-slate-900 leading-tight">{blog.title}</h1>
        <p className="mt-4 text-sm text-slate-500">
          {[blog.authorName && `By ${blog.authorName}`, formatBlogDate(blog.publishedAt), `${blog.readTimeMinutes} min read`]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      {blog.coverImage && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-8">
          <img src={blog.coverImage} alt={blog.title} className="w-full max-h-[480px] object-cover rounded-2xl shadow-lg" />
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 sm:px-6 mt-10">
        {blog.excerpt && <p className="mb-8 text-xl text-slate-600 leading-relaxed font-light">{blog.excerpt}</p>}
        <BlogContent html={blog.content} />

        {blog.tags?.length > 0 && (
          <div className="mt-10 flex flex-wrap gap-2">
            {blog.tags.map((tag) => (
              <span key={tag} className="px-3 py-1 rounded-full bg-slate-100 text-xs font-medium text-slate-600">
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-10 pt-6 border-t border-slate-200">
          <p className="text-sm font-semibold text-slate-900 mb-3">Share this article</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleCopy} className={shareButtonClass}>
              {copied ? 'Link copied!' : 'Copy link'}
            </button>
            <a className={shareButtonClass} href={`https://wa.me/?text=${shareText}%20${shareUrl}`} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
            <a className={shareButtonClass} href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`} target="_blank" rel="noopener noreferrer">
              Facebook
            </a>
            <a className={shareButtonClass} href={`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`} target="_blank" rel="noopener noreferrer">
              X
            </a>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 mt-16">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Keep reading</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {related.map((post) => (
              <BlogCard key={post._id} blog={post} onOpen={onOpenPost} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
};

export default BlogPostPage;
