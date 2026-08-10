import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

const DefaultCloseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

/**
 * A highly reusable Modal / Dialog Component
 *
 * @param {Object} props - Component properties
 * @param {boolean} props.isOpen - Whether the modal is visible (modals are always controlled)
 * @param {Function} props.onClose - Called when the modal requests to close (overlay click, Esc, close button)
 * @param {string} props.title - Header title text
 * @param {React.ReactNode} props.children - Modal body content
 * @param {React.ReactNode} props.footer - Footer content, typically action buttons
 * @param {string} props.size - Modal width (sm, md, lg, xl, full)
 * @param {boolean} props.closeOnOverlayClick - Close when clicking the backdrop
 * @param {boolean} props.closeOnEsc - Close when pressing the Escape key
 * @param {boolean} props.showCloseButton - Show the (x) close button in the header
 * @param {boolean} props.hideHeader - Hide the entire header row (title + close button)
 * @param {boolean} props.centered - Vertically center the modal (false aligns it near the top)
 * @param {boolean} props.preventScroll - Lock body scroll while the modal is open
 * @param {boolean} props.returnFocusOnClose - Restore focus to the previously focused element on close
 * @param {Object} props.initialFocusRef - Ref to an element to focus when the modal opens
 * @param {string} props.className - Additional CSS classes for the modal panel
 * @param {string} props.overlayClassName - Additional CSS classes for the backdrop
 * @param {string} props.bodyClassName - Additional CSS classes for the body content wrapper
 * @param {string} props.footerClassName - Additional CSS classes for the footer wrapper
 * @param {React.ReactNode} props.closeIcon - Custom icon for the close button
 * @param {string} props.ariaLabel - Aria label for the dialog (used when there is no title)
 * @param {string} props.ariaLabelledBy - Id of an external element labelling the dialog
 * @param {string} props.ariaDescribedBy - Id of an external element describing the dialog
 * @param {string} props.id - Id applied to the dialog element (used to derive the title id)
 */
const Modal = ({
  isOpen = false,
  onClose,
  title = '',
  children,
  footer = null,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEsc = true,
  showCloseButton = true,
  hideHeader = false,
  centered = true,
  preventScroll = true,
  returnFocusOnClose = true,
  initialFocusRef = null,
  className = '',
  overlayClassName = '',
  bodyClassName = '',
  footerClassName = '',
  closeIcon = null,
  ariaLabel = '',
  ariaLabelledBy = '',
  ariaDescribedBy = '',
  id = '',
}) => {
  const modalRef = useRef(null);
  const previousActiveElement = useRef(null);

  // Size variants
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
    full: 'max-w-[95vw] h-[90vh]',
  };

  const handleClose = useCallback(() => {
    if (onClose) onClose();
  }, [onClose]);

  // Lock body scroll while the modal is open
  useEffect(() => {
    if (!isOpen || !preventScroll) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, preventScroll]);

  // Focus the modal (or a chosen element) on open, restore focus on close
  useEffect(() => {
    if (!isOpen) return;

    previousActiveElement.current = document.activeElement;
    const focusTarget = initialFocusRef?.current || modalRef.current;
    focusTarget?.focus();

    return () => {
      if (returnFocusOnClose && previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, initialFocusRef, returnFocusOnClose]);

  // Escape-to-close and a lightweight focus trap
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (closeOnEsc && e.key === 'Escape') {
        handleClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEsc, handleClose]);

  const handleOverlayMouseDown = (e) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!isOpen) return null;

  const overlayClasses = `
    fixed inset-0 z-50 flex ${centered ? 'items-center' : 'items-start pt-16'} justify-center
    bg-black/50 p-4 overflow-y-auto
    ${overlayClassName}
  `.trim().replace(/\s+/g, ' ');

  const panelClasses = `
    relative w-full ${sizeClasses[size]} bg-white rounded-xl shadow-xl
    flex flex-col max-h-[90vh]
    ${className}
  `.trim().replace(/\s+/g, ' ');

  const titleId = title && !hideHeader ? `${id || 'modal'}-title` : undefined;

  return createPortal(
    <div className={overlayClasses} onMouseDown={handleOverlayMouseDown}>
      <div
        ref={modalRef}
        id={id || undefined}
        role="dialog"
        aria-modal="true"
        aria-label={!ariaLabelledBy && !titleId ? ariaLabel || 'Dialog' : undefined}
        aria-labelledby={ariaLabelledBy || titleId}
        aria-describedby={ariaDescribedBy || undefined}
        tabIndex={-1}
        className={panelClasses}
      >
        {!hideHeader && (title || showCloseButton) && (
          <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-200">
            {title && (
              <h2 id={titleId} className="text-lg font-semibold text-gray-900">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close dialog"
                className="ml-auto text-gray-400 hover:text-gray-600 rounded-lg p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {closeIcon || <DefaultCloseIcon />}
              </button>
            )}
          </div>
        )}

        <div className={`px-6 py-4 overflow-y-auto ${bodyClassName}`}>
          {children}
        </div>

        {footer && (
          <div
            className={`flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 ${footerClassName}`}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
