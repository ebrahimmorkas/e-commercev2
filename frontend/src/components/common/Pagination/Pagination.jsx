import React from 'react';

const ChevronLeft = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);
const ChevronRight = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);
const ChevronDoubleLeft = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 19l-7-7 7-7M11 19l-7-7 7-7" />
  </svg>
);
const ChevronDoubleRight = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 5l7 7-7 7M13 5l7 7-7 7" />
  </svg>
);

const range = (start, end) => {
  const length = Math.max(end - start + 1, 0);
  return Array.from({ length }, (_, i) => start + i);
};

/**
 * Builds the numbered-page range with ellipses, e.g. [1, '...', 4, 5, 6, '...', 20]
 */
const buildPageRange = (current, total, siblingCount, boundaryCount) => {
  const totalSlots = siblingCount * 2 + boundaryCount * 2 + 3;
  if (totalSlots >= total) return range(1, total);

  const leftSibling = Math.max(current - siblingCount, boundaryCount + 1);
  const rightSibling = Math.min(current + siblingCount, total - boundaryCount);

  const showLeftEllipsis = leftSibling > boundaryCount + 2;
  const showRightEllipsis = rightSibling < total - boundaryCount - 1;

  const startPages = range(1, boundaryCount);
  const endPages = range(total - boundaryCount + 1, total);

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftItemCount = boundaryCount + siblingCount * 2 + 1;
    return [...range(1, leftItemCount), '...', ...endPages];
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    const rightItemCount = boundaryCount + siblingCount * 2 + 1;
    return [...startPages, '...', ...range(total - rightItemCount + 1, total)];
  }

  return [...startPages, '...', ...range(leftSibling, rightSibling), '...', ...endPages];
};

/**
 * A highly reusable Pagination Component
 *
 * @param {Object} props - Component properties
 * @param {number} props.currentPage - Current page (1-indexed, controlled)
 * @param {number} props.totalPages - Total number of pages (or derive from totalItems/pageSize)
 * @param {number} props.totalItems - Total item count, used with pageSize instead of totalPages
 * @param {number} props.pageSize - Items per page, used with totalItems instead of totalPages
 * @param {Function} props.onPageChange - (page) => void
 * @param {string} props.variant - 'numbered' (page buttons) or 'simple' (Prev/Next + "Page X of Y")
 * @param {number} props.siblingCount - Pages shown on each side of the current page
 * @param {number} props.boundaryCount - Pages always shown at the start/end
 * @param {boolean} props.showFirstLast - Show jump-to-first/last buttons
 * @param {string} props.size - Control size (sm, md, lg)
 * @param {boolean} props.disabled - Disable all controls
 * @param {string} props.className - Additional CSS classes for the outer wrapper
 */
const Pagination = ({
  currentPage = 1,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  variant = 'numbered',
  siblingCount = 1,
  boundaryCount = 1,
  showFirstLast = false,
  size = 'md',
  disabled = false,
  className = '',
}) => {
  const computedTotalPages =
    totalPages ?? (totalItems && pageSize ? Math.max(1, Math.ceil(totalItems / pageSize)) : 1);

  const goTo = (page) => {
    if (disabled || page < 1 || page > computedTotalPages || page === currentPage) return;
    onPageChange?.(page);
  };

  const sizeClasses = {
    sm: 'h-7 min-w-7 text-xs',
    md: 'h-9 min-w-9 text-sm',
    lg: 'h-11 min-w-11 text-base',
  };

  const baseButtonClasses = `
    inline-flex items-center justify-center rounded-lg px-2 font-medium transition-all duration-200
    focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
    disabled:opacity-50 disabled:cursor-not-allowed
    ${sizeClasses[size]}
  `.trim().replace(/\s+/g, ' ');

  const navButton = (onClick, disabledState, ariaLabel, icon) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || disabledState}
      aria-label={ariaLabel}
      className={`${baseButtonClasses} text-gray-600 hover:bg-gray-100 border border-gray-300 bg-white`}
    >
      {icon}
    </button>
  );

  if (variant === 'simple') {
    return (
      <nav aria-label="Pagination" className={`flex items-center justify-between gap-4 ${className}`}>
        {navButton(() => goTo(currentPage - 1), currentPage <= 1, 'Previous page', (
          <span className="flex items-center gap-1"><ChevronLeft /> Previous</span>
        ))}
        <span className="text-sm text-gray-600">
          Page {currentPage} of {computedTotalPages}
        </span>
        {navButton(() => goTo(currentPage + 1), currentPage >= computedTotalPages, 'Next page', (
          <span className="flex items-center gap-1">Next <ChevronRight /></span>
        ))}
      </nav>
    );
  }

  const pages = buildPageRange(currentPage, computedTotalPages, siblingCount, boundaryCount);

  return (
    <nav aria-label="Pagination" className={`flex items-center gap-1 ${className}`}>
      {showFirstLast && navButton(() => goTo(1), currentPage <= 1, 'First page', <ChevronDoubleLeft />)}
      {navButton(() => goTo(currentPage - 1), currentPage <= 1, 'Previous page', <ChevronLeft />)}

      {pages.map((page, index) =>
        page === '...' ? (
          <span key={`ellipsis-${index}`} className={`${baseButtonClasses} text-gray-400`}>
            &hellip;
          </span>
        ) : (
          <button
            key={page}
            type="button"
            onClick={() => goTo(page)}
            disabled={disabled}
            aria-current={page === currentPage ? 'page' : undefined}
            className={`${baseButtonClasses} ${
              page === currentPage
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-100 border border-gray-300 bg-white'
            }`}
          >
            {page}
          </button>
        )
      )}

      {navButton(() => goTo(currentPage + 1), currentPage >= computedTotalPages, 'Next page', <ChevronRight />)}
      {showFirstLast &&
        navButton(() => goTo(computedTotalPages), currentPage >= computedTotalPages, 'Last page', <ChevronDoubleRight />)}
    </nav>
  );
};

export default Pagination;
