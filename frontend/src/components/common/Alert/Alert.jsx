import React, { useState } from 'react';

const VARIANT_STYLES = {
  info: { wrapper: 'bg-blue-50 border-blue-200', icon: 'text-blue-500', title: 'text-blue-800', text: 'text-blue-700' },
  success: { wrapper: 'bg-green-50 border-green-200', icon: 'text-green-500', title: 'text-green-800', text: 'text-green-700' },
  warning: { wrapper: 'bg-yellow-50 border-yellow-200', icon: 'text-yellow-600', title: 'text-yellow-800', text: 'text-yellow-700' },
  error: { wrapper: 'bg-red-50 border-red-200', icon: 'text-red-500', title: 'text-red-800', text: 'text-red-700' },
};

const VariantIcon = ({ variant, className }) => {
  switch (variant) {
    case 'success':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'warning':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      );
    case 'error':
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    default:
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
  }
};

/**
 * A highly reusable Alert / Banner Component
 * Unlike Toast, this is a static, persistent inline message — meant to live in
 * the page layout (e.g. above a form) rather than pop in and auto-dismiss.
 *
 * @param {Object} props - Component properties
 * @param {string} props.variant - Visual variant (info, success, warning, error)
 * @param {string} props.title - Optional bold title line
 * @param {React.ReactNode} props.children - Message body
 * @param {boolean} props.dismissible - Show a close (x) button
 * @param {Function} props.onDismiss - Called when dismissed (in addition to hiding it)
 * @param {React.ReactNode} props.actions - Action buttons/links rendered below the message
 * @param {React.ReactNode} props.icon - Custom icon, overriding the variant's default
 * @param {string} props.className - Additional CSS classes
 */
const Alert = ({
  variant = 'info',
  title = '',
  children,
  dismissible = false,
  onDismiss,
  actions = null,
  icon,
  className = '',
}) => {
  const [dismissed, setDismissed] = useState(false);
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.info;

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      role="alert"
      className={`flex gap-3 rounded-lg border p-4 ${styles.wrapper} ${className}`}
    >
      <span className={`flex-shrink-0 ${styles.icon}`}>
        {icon || <VariantIcon variant={variant} className="w-5 h-5" />}
      </span>

      <div className="flex-1 min-w-0">
        {title && <p className={`font-semibold ${styles.title}`}>{title}</p>}
        {children && <div className={`text-sm ${styles.text} ${title ? 'mt-1' : ''}`}>{children}</div>}
        {actions && <div className="mt-3 flex gap-3">{actions}</div>}
      </div>

      {dismissible && (
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className={`flex-shrink-0 rounded p-0.5 hover:bg-black/5 transition-colors focus:outline-none focus:ring-2 focus:ring-current ${styles.icon}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default Alert;
