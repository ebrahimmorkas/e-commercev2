import React, { useState } from 'react';

/**
 * A highly reusable Switch (toggle) Component
 *
 * @param {Object} props - Component properties
 * @param {boolean} props.checked - Controlled checked state
 * @param {boolean} props.defaultChecked - Default checked state (uncontrolled)
 * @param {Function} props.onChange - Change handler function (event) => void
 * @param {boolean} props.disabled - Enable/disable the switch
 * @param {string} props.label - Label text shown next to the switch
 * @param {string} props.description - Secondary helper text shown under the label
 * @param {string} props.labelPosition - Where the label renders relative to the switch (left, right)
 * @param {string} props.name - Input name attribute
 * @param {string} props.id - Input id attribute
 * @param {string} props.size - Switch size (sm, md, lg)
 * @param {string} props.color - Active track color (blue, green, red, purple)
 * @param {string} props.className - Additional CSS classes for the track
 */
const Switch = ({
  checked,
  defaultChecked = false,
  onChange,
  disabled = false,
  label = '',
  description = '',
  labelPosition = 'right',
  name = '',
  id = '',
  size = 'md',
  color = 'blue',
  className = '',
  ...restProps
}) => {
  const [internalChecked, setInternalChecked] = useState(defaultChecked);

  const isControlled = checked !== undefined;
  const currentChecked = isControlled ? checked : internalChecked;

  const handleToggle = () => {
    if (disabled) return;

    const nextChecked = !currentChecked;
    if (!isControlled) {
      setInternalChecked(nextChecked);
    }
    if (onChange) {
      onChange({ target: { checked: nextChecked, name } });
    }
  };

  const sizeClasses = {
    sm: { track: 'w-8 h-4.5', thumb: 'h-3.5 w-3.5', translate: 'translate-x-3.5' },
    md: { track: 'w-11 h-6', thumb: 'h-5 w-5', translate: 'translate-x-5' },
    lg: { track: 'w-14 h-7', thumb: 'h-6 w-6', translate: 'translate-x-7' },
  };

  const colorClasses = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    red: 'bg-red-600',
    purple: 'bg-purple-600',
  };

  const { track, thumb, translate } = sizeClasses[size];

  const trackClasses = `
    ${track} relative inline-flex flex-shrink-0 items-center rounded-full
    transition-colors duration-200 ease-in-out
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
    ${currentChecked ? colorClasses[color] : 'bg-gray-300'}
    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
    ${className}
  `.trim().replace(/\s+/g, ' ');

  const switchButton = (
    <button
      type="button"
      role="switch"
      id={id || name}
      aria-checked={currentChecked}
      aria-label={!label ? 'Toggle' : undefined}
      disabled={disabled}
      onClick={handleToggle}
      className={trackClasses}
      {...restProps}
    >
      <span
        className={`
          ${thumb} inline-block transform rounded-full bg-white shadow ring-0
          transition-transform duration-200 ease-in-out
          ${currentChecked ? translate : 'translate-x-0.5'}
        `.trim().replace(/\s+/g, ' ')}
      />
    </button>
  );

  if (!label && !description) {
    return switchButton;
  }

  const textBlock = (
    <div className={labelPosition === 'left' ? 'mr-3' : 'ml-3'}>
      {label && (
        <label
          htmlFor={id || name}
          onClick={handleToggle}
          className={`block text-sm font-medium text-gray-700 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {label}
        </label>
      )}
      {description && <p className="text-sm text-gray-500">{description}</p>}
    </div>
  );

  return (
    <div className="flex items-center">
      {labelPosition === 'left' && textBlock}
      {switchButton}
      {labelPosition === 'right' && textBlock}
    </div>
  );
};

export default Switch;
