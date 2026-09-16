/**
 * Generic full-page error state for the client storefront. Deliberately not
 * tied to any one feature's theme.js (unlike most client components) since
 * it's shared across the router's 404 and any page-level API failure - see
 * StatusErrorPage. Colors are hardcoded to match the site's existing
 * amber/slate palette (see e.g. ClientApp.jsx's SignInGate).
 *
 * @param {Object} props
 * @param {React.ReactNode} [props.icon] - Icon rendered above the code.
 * @param {string|number} [props.code] - Short status label, e.g. "404".
 * @param {string} props.title - Main heading.
 * @param {string} [props.description] - Supporting text below the title.
 * @param {{ label: string, onClick: () => void }} [props.primaryAction]
 * @param {{ label: string, onClick: () => void }} [props.secondaryAction]
 */
const ErrorPage = ({ icon, code, title, description, primaryAction, secondaryAction }) => (
  <div className="min-h-[60vh] flex items-center justify-center px-4 sm:px-6 py-16">
    <div className="max-w-md w-full text-center">
      {icon && <div className="mx-auto mb-4 w-16 h-16 text-amber-500">{icon}</div>}
      {code && (
        <p className="text-sm font-bold tracking-widest uppercase text-amber-600 mb-2">{code}</p>
      )}
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{title}</h1>
      {description && <p className="mt-3 text-sm sm:text-base text-slate-500">{description}</p>}
      {(primaryAction || secondaryAction) && (
        <div className="mt-8 flex flex-wrap gap-3 justify-center">
          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="px-5 py-2.5 rounded-full text-sm font-semibold cursor-pointer bg-amber-500 hover:bg-amber-400 text-slate-900 transition-colors"
            >
              {primaryAction.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="px-5 py-2.5 rounded-full text-sm font-semibold cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  </div>
);

export default ErrorPage;
