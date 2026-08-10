import React from 'react';

/**
 * A highly reusable Card Component
 *
 * @param {Object} props - Component properties
 * @param {React.ReactNode} props.children - Card body content
 * @param {string} props.title - Header title
 * @param {string} props.subtitle - Header subtitle, shown under the title
 * @param {React.ReactNode} props.headerActions - Content aligned to the right of the header (e.g. a Button or Dropdown)
 * @param {string} props.image - Image URL rendered at the top of the card
 * @param {string} props.imageAlt - Alt text for the image
 * @param {string} props.imageHeight - Tailwind height class for the image (default 'h-48')
 * @param {React.ReactNode} props.footer - Footer content, visually separated from the body
 * @param {string} props.variant - Visual style (elevated, outlined, flat)
 * @param {string} props.padding - Body padding (none, sm, md, lg)
 * @param {boolean} props.hoverable - Lift the card and increase shadow on hover
 * @param {Function} props.onClick - Makes the whole card clickable/keyboard-focusable
 * @param {boolean} props.loading - Render a skeleton placeholder instead of content
 * @param {string} props.className - Additional CSS classes for the outer card
 * @param {string} props.bodyClassName - Additional CSS classes for the body wrapper
 */
const Card = ({
  children,
  title = '',
  subtitle = '',
  headerActions = null,
  image = '',
  imageAlt = '',
  imageHeight = 'h-48',
  footer = null,
  variant = 'elevated',
  padding = 'md',
  hoverable = false,
  onClick,
  loading = false,
  className = '',
  bodyClassName = '',
}) => {
  const variantClasses = {
    elevated: 'bg-white shadow-md',
    outlined: 'bg-white border border-gray-200',
    flat: 'bg-gray-50',
  };

  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-6',
    lg: 'p-8',
  };

  const interactiveClasses = onClick
    ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500'
    : '';
  const hoverClasses = hoverable ? 'transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5' : '';

  const cardClasses = `
    rounded-xl overflow-hidden
    ${variantClasses[variant]} ${hoverClasses} ${interactiveClasses}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  const hasHeader = title || subtitle || headerActions;

  const content = loading ? (
    <div className={`animate-pulse space-y-3 ${paddingClasses[padding]}`}>
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      <div className="h-4 bg-gray-200 rounded w-full" />
      <div className="h-4 bg-gray-200 rounded w-5/6" />
    </div>
  ) : (
    <>
      {image && (
        <img src={image} alt={imageAlt} className={`w-full ${imageHeight} object-cover`} />
      )}

      {hasHeader && (
        <div className={`flex items-start justify-between gap-4 ${paddingClasses[padding]} ${padding !== 'none' ? 'pb-0' : ''}`}>
          <div className="min-w-0">
            {title && <h3 className="text-lg font-semibold text-gray-900 truncate">{title}</h3>}
            {subtitle && <p className="text-sm text-gray-500 truncate">{subtitle}</p>}
          </div>
          {headerActions && <div className="flex-shrink-0">{headerActions}</div>}
        </div>
      )}

      {children && <div className={`${paddingClasses[padding]} ${bodyClassName}`}>{children}</div>}

      {footer && (
        <div className={`border-t border-gray-100 bg-gray-50 ${paddingClasses[padding]}`}>{footer}</div>
      )}
    </>
  );

  return (
    <div
      className={cardClasses}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick(e);
              }
            }
          : undefined
      }
    >
      {content}
    </div>
  );
};

export default Card;
