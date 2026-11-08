export const formatBlogDate = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

export const blogPath = (slug) => `/blog/${slug}`;
