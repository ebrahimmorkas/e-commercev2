import React from 'react';

const DefaultSeparator = () => (
  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const collapseItems = (items, maxItems) => {
  if (!maxItems || items.length <= maxItems) return items;
  const tailCount = Math.max(maxItems - 1, 1);
  return [items[0], { collapsed: true }, ...items.slice(items.length - tailCount)];
};

/**
 * A highly reusable Breadcrumbs Component
 *
 * @param {Object} props - Component properties
 * @param {Array} props.items - Trail definitions [{ label, href?, onClick?, icon? }]. The last
 *   item is treated as the current page (rendered as plain text with aria-current="page").
 * @param {React.ReactNode} props.separator - Custom separator between items (defaults to a chevron)
 * @param {number} props.maxItems - Collapse the middle of a long trail into an ellipsis once exceeded
 * @param {string} props.className - Additional CSS classes for the outer <nav>
 */
const Breadcrumbs = ({ items = [], separator, maxItems, className = '' }) => {
  const visibleItems = collapseItems(items, maxItems);

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-2 text-sm">
        {visibleItems.map((item, index) => {
          const isLast = index === visibleItems.length - 1;

          return (
            <li key={item.collapsed ? `ellipsis-${index}` : item.label} className="flex items-center gap-2">
              {index > 0 && <span aria-hidden="true">{separator || <DefaultSeparator />}</span>}

              {item.collapsed ? (
                <span className="text-gray-400 select-none">&hellip;</span>
              ) : isLast ? (
                <span aria-current="page" className="flex items-center gap-1.5 font-medium text-gray-900">
                  {item.icon}
                  {item.label}
                </span>
              ) : item.href ? (
                <a
                  href={item.href}
                  onClick={item.onClick}
                  className="flex items-center gap-1.5 text-gray-500 hover:text-blue-600 transition-colors"
                >
                  {item.icon}
                  {item.label}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={item.onClick}
                  className="flex items-center gap-1.5 text-gray-500 hover:text-blue-600 transition-colors"
                >
                  {item.icon}
                  {item.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
