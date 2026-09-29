/**
 * Renders one CompanySettings HTML field (privacyPolicy, aboutUs, ...) as
 * page content. The HTML is the vendor's own trusted content, entered
 * through the admin's HtmlEditor - same trust level as any other
 * vendor-authored storefront text, not user-generated content, so it's
 * rendered directly rather than sandboxed.
 *
 * The bracketed selectors give the vendor's raw <h1>/<p>/<ul> etc a sensible
 * look with no typography plugin installed.
 *
 * @param {string} props.html
 */
const PolicyContent = ({ html }) => {
  if (!html || !html.trim()) {
    return <p className="text-sm text-slate-500">This page hasn't been filled in yet.</p>;
  }

  return (
    <div
      className="text-slate-700 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:mt-6
        [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-3 [&_h2]:mt-5
        [&_p]:mb-4 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4
        [&_li]:mb-1 [&_a]:text-amber-600 [&_a]:underline [&_strong]:font-semibold"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default PolicyContent;
