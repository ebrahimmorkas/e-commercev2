import React, { useState } from 'react';

const SIZE_CLASSES = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-12 w-12 text-lg',
  xl: 'h-16 w-16 text-xl',
  '2xl': 'h-20 w-20 text-2xl',
};

const STATUS_COLORS = {
  online: 'bg-green-500',
  offline: 'bg-gray-400',
  away: 'bg-yellow-500',
  busy: 'bg-red-500',
};

const INITIALS_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-red-500',
  'bg-orange-500', 'bg-amber-500', 'bg-green-500', 'bg-teal-500',
  'bg-cyan-500', 'bg-indigo-500',
];

const getInitials = (name) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

const colorForName = (name) => {
  const hash = Array.from(name).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return INITIALS_COLORS[hash % INITIALS_COLORS.length];
};

/**
 * A highly reusable Avatar Component
 * Falls back from image -> initials -> generic icon, in that order.
 *
 * @param {Object} props - Component properties
 * @param {string} props.src - Image URL
 * @param {string} props.alt - Image alt text
 * @param {string} props.name - Full name, used for initials fallback and alt text
 * @param {React.ReactNode} props.icon - Fallback icon when there's no src or name
 * @param {string} props.size - Avatar size (xs, sm, md, lg, xl, 2xl)
 * @param {string} props.shape - Avatar shape (circle, square)
 * @param {string} props.status - Status dot (online, offline, away, busy)
 * @param {Function} props.onClick - Makes the avatar clickable/keyboard-focusable
 * @param {string} props.className - Additional CSS classes
 */
const Avatar = ({
  src,
  alt = '',
  name = '',
  icon = null,
  size = 'md',
  shape = 'circle',
  status,
  onClick,
  className = '',
}) => {
  const [imageError, setImageError] = useState(false);

  const shapeClasses = shape === 'circle' ? 'rounded-full' : 'rounded-lg';
  const baseClasses = `relative inline-flex items-center justify-center flex-shrink-0 overflow-hidden ${SIZE_CLASSES[size]} ${shapeClasses}`;
  const interactiveClasses = onClick
    ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'
    : '';

  let content;
  if (src && !imageError) {
    content = (
      <img
        src={src}
        alt={alt || name}
        onError={() => setImageError(true)}
        className={`h-full w-full object-cover ${shapeClasses}`}
      />
    );
  } else if (name) {
    content = (
      <span className={`h-full w-full flex items-center justify-center font-medium text-white ${colorForName(name)}`}>
        {getInitials(name)}
      </span>
    );
  } else {
    content = (
      <span className="h-full w-full flex items-center justify-center bg-gray-200 text-gray-500">
        {icon || (
          <svg className="w-3/5 h-3/5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-3.866 0-7 2.239-7 5v2h14v-2c0-2.761-3.134-5-7-5z" />
          </svg>
        )}
      </span>
    );
  }

  return (
    <span
      className={`${baseClasses} ${interactiveClasses} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      title={name || alt}
    >
      {content}
      {status && (
        <span
          className={`absolute bottom-0 right-0 block rounded-full ring-2 ring-white ${STATUS_COLORS[status]}`}
          style={{ width: '28%', height: '28%' }}
          aria-label={`Status: ${status}`}
        />
      )}
    </span>
  );
};

/**
 * Renders a stack of Avatars with slight overlap, collapsing extras into a "+N" bubble.
 *
 * @param {Object} props - Component properties
 * @param {React.ReactNode} props.children - Avatar elements
 * @param {number} props.max - Maximum avatars shown before collapsing into "+N"
 * @param {string} props.size - Applied to every child Avatar and the overflow bubble
 * @param {string} props.className - Additional CSS classes for the wrapper
 */
export const AvatarGroup = ({ children, max = 4, size = 'md', className = '' }) => {
  const items = React.Children.toArray(children);
  const visible = items.slice(0, max);
  const overflowCount = items.length - visible.length;

  return (
    <div className={`flex items-center -space-x-3 ${className}`}>
      {visible.map((child, index) =>
        React.cloneElement(child, {
          key: child.key ?? index,
          size,
          className: `${child.props.className || ''} ring-2 ring-white`.trim(),
        })
      )}
      {overflowCount > 0 && (
        <span
          className={`relative inline-flex items-center justify-center flex-shrink-0 rounded-full bg-gray-200 text-gray-600 font-medium ring-2 ring-white ${SIZE_CLASSES[size]}`}
        >
          +{overflowCount}
        </span>
      )}
    </div>
  );
};

export default Avatar;
