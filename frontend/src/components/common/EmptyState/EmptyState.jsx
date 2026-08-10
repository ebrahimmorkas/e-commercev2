import React from 'react';

const DefaultIcon = () => (
  <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0l-3.5-3.5a2 2 0 00-2.828 0L11 12l-1.672-1.672a2 2 0 00-2.828 0L4 13"
    />
  </svg>
);

/**
 * A highly reusable Empty State Component
 * Generalizes the "no data" placeholder pattern used by Table's emptyMessage prop
 * for use anywhere a list, search, or grid can come back empty.
 *
 * @param {Object} props - Component properties
 * @param {React.ReactNode} props.icon - Icon rendered above the title (defaults to a generic "empty box" icon)
 * @param {string} props.title - Main heading
 * @param {string} props.description - Supporting text below the title
 * @param {React.ReactNode} props.action - Action button(s) rendered below the description
 * @param {string} props.size - Overall size (sm, md, lg)
 * @param {string} props.className - Additional CSS classes for the outer wrapper
 */
const EmptyState = ({
  icon,
  title = 'Nothing here yet',
  description = '',
  action = null,
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: { wrapper: 'py-8 px-4', icon: 'w-10 h-10', title: 'text-base', description: 'text-sm' },
    md: { wrapper: 'py-12 px-6', icon: 'w-14 h-14', title: 'text-lg', description: 'text-sm' },
    lg: { wrapper: 'py-16 px-8', icon: 'w-20 h-20', title: 'text-xl', description: 'text-base' },
  };

  const s = sizeClasses[size];

  return (
    <div className={`flex flex-col items-center justify-center text-center ${s.wrapper} ${className}`}>
      <div className={`text-gray-300 mb-4 ${s.icon}`}>{icon || <DefaultIcon />}</div>
      <h3 className={`font-semibold text-gray-900 ${s.title}`}>{title}</h3>
      {description && <p className={`text-gray-500 mt-1 max-w-sm ${s.description}`}>{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
};

export default EmptyState;
