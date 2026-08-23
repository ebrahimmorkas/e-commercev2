const TONE_CLASSES = {
  default: 'bg-blue-50 text-blue-600',
  muted: 'bg-gray-100 text-gray-500',
  success: 'bg-green-50 text-green-600',
};

/**
 * Consistent "boxed section" wrapper used to break the long product form
 * into named, visually distinct groups instead of one continuous stack of
 * fields. Every section gets the same header treatment (icon chip + title
 * + optional description/action), so the eye can scan the form by section
 * heading rather than reading every label.
 */
const SectionCard = ({ icon, title, description, tone = 'default', actions, children, className = '', bodyClassName = '' }) => (
  <section className={`rounded-2xl border border-gray-200 bg-white shadow-sm ${className}`}>
    <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-4 border-b border-gray-100">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {icon && (
          <span className={`flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl ${TONE_CLASSES[tone]}`}>
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1 pt-1">
          <h3 className="text-sm font-semibold text-gray-900 leading-tight">{title}</h3>
          {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex-shrink-0">{actions}</div>}
    </div>
    <div className={`p-4 sm:p-5 space-y-4 ${bodyClassName}`}>{children}</div>
  </section>
);

export default SectionCard;
