/**
 * Renders a blog post's HTML body. Like the policy pages, the HTML is the
 * vendor's own content entered through the admin's editor (and cleaned of
 * scripts server-side), so it is rendered directly. The bracketed selectors
 * give raw tags a readable article look with no typography plugin installed.
 *
 * @param {string} props.html
 */
const BlogContent = ({ html }) => (
  <div
    className="text-slate-700 text-[17px] leading-8 break-words
      [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:text-slate-900 [&_h1]:mt-10 [&_h1]:mb-4
      [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-slate-900 [&_h2]:mt-9 [&_h2]:mb-3
      [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-slate-900 [&_h3]:mt-7 [&_h3]:mb-2
      [&_p]:mb-5
      [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-5 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-5 [&_li]:mb-1.5
      [&_a]:text-amber-600 [&_a]:underline [&_a:hover]:text-amber-700
      [&_strong]:font-semibold [&_strong]:text-slate-900
      [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-xl [&_img]:my-6
      [&_blockquote]:border-l-4 [&_blockquote]:border-amber-400 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-slate-600 [&_blockquote]:my-6
      [&_table]:w-full [&_table]:my-6 [&_th]:border [&_th]:border-slate-200 [&_th]:p-2 [&_th]:bg-slate-50 [&_td]:border [&_td]:border-slate-200 [&_td]:p-2"
    dangerouslySetInnerHTML={{ __html: html }}
  />
);

export default BlogContent;
