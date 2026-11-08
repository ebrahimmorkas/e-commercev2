import { blogPath, formatBlogDate } from '../utils';

// Cover fallback: a soft gradient with the post's first letter, so a post with no image still looks designed.
const CoverFallback = ({ title }) => (
  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900">
    <span className="text-5xl font-bold text-amber-400/70 select-none">{(title || '?').charAt(0).toUpperCase()}</span>
  </div>
);

const MetaLine = ({ blog, light = false }) => (
  <p className={`text-xs ${light ? 'text-slate-300' : 'text-slate-500'}`}>
    {[formatBlogDate(blog.publishedAt), `${blog.readTimeMinutes} min read`].filter(Boolean).join(' · ')}
  </p>
);

/**
 * A blog post card. `featured` is the wide hero card at the top of the list.
 *
 * @param {Object} props.blog - a post from the list API
 * @param {(slug: string) => void} props.onOpen
 * @param {boolean} props.featured
 */
const BlogCard = ({ blog, onOpen, featured = false }) => {
  // A real link (opens in a new tab, shareable) that opens in-app on a plain click.
  const handleClick = (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) return;
    event.preventDefault();
    onOpen(blog.slug);
  };

  if (featured) {
    return (
      <a
        href={blogPath(blog.slug)}
        onClick={handleClick}
        className="group grid md:grid-cols-2 rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-2xl hover:shadow-amber-900/15 transition-shadow duration-300"
      >
        <div className="relative aspect-[16/10] md:aspect-auto md:min-h-[320px] overflow-hidden bg-slate-100">
          {blog.coverImage ? (
            <img
              src={blog.coverImage}
              alt={blog.title}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0"><CoverFallback title={blog.title} /></div>
          )}
          {blog.isFeatured && (
            <span className="absolute top-4 left-4 px-3 py-1 rounded-full bg-amber-500 text-slate-900 text-[11px] font-bold uppercase tracking-wide shadow">
              Featured
            </span>
          )}
        </div>
        <div className="p-6 sm:p-10 flex flex-col justify-center">
          {blog.category && (
            <span className="text-xs font-semibold tracking-wide uppercase text-amber-700">{blog.category}</span>
          )}
          <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 leading-tight group-hover:text-amber-700 transition-colors">
            {blog.title}
          </h2>
          {blog.excerpt && <p className="mt-3 text-slate-600 leading-relaxed line-clamp-4">{blog.excerpt}</p>}
          <div className="mt-5 flex items-center justify-between gap-3">
            <MetaLine blog={blog} />
            <span className="text-sm font-semibold text-amber-600 group-hover:translate-x-1 transition-transform">Read more &rarr;</span>
          </div>
        </div>
      </a>
    );
  }

  return (
    <a
      href={blogPath(blog.slug)}
      onClick={handleClick}
      className="group flex flex-col rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-2xl hover:shadow-amber-900/15 hover:-translate-y-1 transition-[box-shadow,transform] duration-300"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-slate-100">
        {blog.coverImage ? (
          <img
            src={blog.coverImage}
            alt={blog.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <CoverFallback title={blog.title} />
        )}
      </div>
      <div className="p-5 flex flex-col flex-1">
        {blog.category && (
          <span className="text-[11px] font-semibold tracking-wide uppercase text-amber-700">{blog.category}</span>
        )}
        <h3 className="mt-1 text-lg font-semibold text-slate-900 leading-snug line-clamp-2 group-hover:text-amber-700 transition-colors">
          {blog.title}
        </h3>
        {blog.excerpt && <p className="mt-2 text-sm text-slate-600 leading-relaxed line-clamp-3">{blog.excerpt}</p>}
        <div className="mt-auto pt-4">
          <MetaLine blog={blog} />
        </div>
      </div>
    </a>
  );
};

export const BlogCardSkeleton = () => (
  <div className="rounded-xl overflow-hidden border border-slate-200 bg-white animate-pulse">
    <div className="aspect-[16/9] bg-slate-200" />
    <div className="p-5 space-y-3">
      <div className="h-3 w-20 rounded bg-slate-200" />
      <div className="h-5 w-4/5 rounded bg-slate-200" />
      <div className="h-3 w-full rounded bg-slate-100" />
      <div className="h-3 w-2/3 rounded bg-slate-100" />
    </div>
  </div>
);

export default BlogCard;
