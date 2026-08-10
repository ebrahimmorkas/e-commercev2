import React, { useEffect, useRef } from 'react';

const VARIANT_STYLES = {
  info: { bar: 'bg-blue-500', icon: 'text-blue-500' },
  success: { bar: 'bg-green-500', icon: 'text-green-500' },
  warning: { bar: 'bg-yellow-500', icon: 'text-yellow-600' },
  error: { bar: 'bg-red-500', icon: 'text-red-500' },
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
 * A single Toast notification. Normally rendered internally by ToastProvider,
 * but exported standalone for custom layouts.
 *
 * @param {Object} props - Component properties
 * @param {string} props.title - Optional bold title line
 * @param {string} props.message - Toast message body
 * @param {string} props.variant - Visual variant (info, success, warning, error)
 * @param {number} props.duration - Auto-dismiss delay in ms (0 disables auto-dismiss)
 * @param {boolean} props.pauseOnHover - Pause the auto-dismiss timer while hovered
 * @param {Function} props.onClose - Called when the toast should be removed
 */
const Toast = ({
  title = '',
  message = '',
  variant = 'info',
  duration = 4000,
  pauseOnHover = true,
  onClose,
}) => {
  const remainingRef = useRef(duration);
  const startRef = useRef(null);
  const timerRef = useRef(null);

  const clear = () => clearTimeout(timerRef.current);

  const start = (ms) => {
    if (!ms || ms <= 0) return;
    startRef.current = Date.now();
    timerRef.current = setTimeout(() => onClose?.(), ms);
  };

  useEffect(() => {
    start(remainingRef.current);
    return clear;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMouseEnter = () => {
    if (!pauseOnHover || duration <= 0) return;
    clear();
    const elapsed = Date.now() - startRef.current;
    remainingRef.current = Math.max(remainingRef.current - elapsed, 0);
  };

  const handleMouseLeave = () => {
    if (!pauseOnHover || duration <= 0) return;
    start(remainingRef.current);
  };

  const { bar, icon } = VARIANT_STYLES[variant] || VARIANT_STYLES.info;

  return (
    <div
      role="status"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative flex w-80 items-start gap-3 overflow-hidden rounded-lg bg-white p-4 shadow-lg ring-1 ring-black/5"
    >
      <span className={`absolute left-0 top-0 h-full w-1 ${bar}`} />
      <VariantIcon variant={variant} className={`w-5 h-5 flex-shrink-0 mt-0.5 ${icon}`} />

      <div className="flex-1 min-w-0">
        {title && <p className="text-sm font-semibold text-gray-900">{title}</p>}
        {message && <p className="text-sm text-gray-600">{message}</p>}
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss notification"
        className="text-gray-400 hover:text-gray-600 rounded p-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

export default Toast;
