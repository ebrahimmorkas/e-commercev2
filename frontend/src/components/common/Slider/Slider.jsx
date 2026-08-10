import React, { useState } from 'react';

const ACCENT_CLASSES = {
  blue: 'accent-blue-600',
  green: 'accent-green-600',
  red: 'accent-red-600',
  purple: 'accent-purple-600',
};

const FILL_CLASSES = {
  blue: 'bg-blue-600',
  green: 'bg-green-600',
  red: 'bg-red-600',
  purple: 'bg-purple-600',
};

const THUMB_POINTER_EVENTS =
  '[&::-webkit-slider-thumb]:pointer-events-auto [&::-moz-range-thumb]:pointer-events-auto';

/**
 * A highly reusable Slider (range input) Component
 * Supports a single value, or a dual-thumb range via `range`.
 *
 * @param {Object} props - Component properties
 * @param {number|number[]} props.value - Controlled value: a number, or [min, max] when `range` is true
 * @param {number|number[]} props.defaultValue - Default value (uncontrolled)
 * @param {number} props.min - Minimum value
 * @param {number} props.max - Maximum value
 * @param {number} props.step - Step increment
 * @param {Function} props.onChange - (value) => void
 * @param {boolean} props.range - Enable dual-thumb range mode
 * @param {boolean} props.disabled - Disable the slider
 * @param {string} props.label - Label text above the slider
 * @param {boolean} props.showValue - Show the current value(s) next to the label
 * @param {Array} props.marks - Tick marks [{ value, label }]
 * @param {string} props.color - Accent color (blue, green, red, purple)
 * @param {string} props.className - Additional CSS classes for the outer wrapper
 */
const Slider = ({
  value,
  defaultValue,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  range = false,
  disabled = false,
  label = '',
  showValue = false,
  marks = [],
  color = 'blue',
  className = '',
}) => {
  const [internalValue, setInternalValue] = useState(
    defaultValue ?? (range ? [min, max] : min)
  );

  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  const update = (next) => {
    if (!isControlled) setInternalValue(next);
    onChange?.(next);
  };

  const percentOf = (v) => ((v - min) / (max - min)) * 100;

  if (range) {
    const [lo, hi] = currentValue;

    const handleLoChange = (e) => {
      const next = Math.min(Number(e.target.value), hi);
      update([next, hi]);
    };
    const handleHiChange = (e) => {
      const next = Math.max(Number(e.target.value), lo);
      update([lo, next]);
    };

    return (
      <div className={className}>
        {(label || showValue) && (
          <div className="flex justify-between mb-2">
            {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
            {showValue && (
              <span className="text-sm text-gray-500">
                {lo} &ndash; {hi}
              </span>
            )}
          </div>
        )}

        <div className="relative h-5 flex items-center">
          <div className="absolute inset-x-0 h-1.5 rounded-full bg-gray-200" />
          <div
            className={`absolute h-1.5 rounded-full ${FILL_CLASSES[color]}`}
            style={{ left: `${percentOf(lo)}%`, right: `${100 - percentOf(hi)}%` }}
          />
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={lo}
            disabled={disabled}
            onChange={handleLoChange}
            aria-label={label ? `${label} minimum` : 'Minimum value'}
            className={`absolute inset-0 w-full appearance-none bg-transparent pointer-events-none ${THUMB_POINTER_EVENTS} ${ACCENT_CLASSES[color]} disabled:opacity-50`}
          />
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={hi}
            disabled={disabled}
            onChange={handleHiChange}
            aria-label={label ? `${label} maximum` : 'Maximum value'}
            className={`absolute inset-0 w-full appearance-none bg-transparent pointer-events-none ${THUMB_POINTER_EVENTS} ${ACCENT_CLASSES[color]} disabled:opacity-50`}
          />
        </div>

        {marks.length > 0 && (
          <div className="relative h-5 mt-1">
            {marks.map((mark) => (
              <span
                key={mark.value}
                className="absolute text-xs text-gray-400 -translate-x-1/2"
                style={{ left: `${percentOf(mark.value)}%` }}
              >
                {mark.label ?? mark.value}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  const handleChange = (e) => update(Number(e.target.value));

  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="flex justify-between mb-2">
          {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
          {showValue && <span className="text-sm text-gray-500">{currentValue}</span>}
        </div>
      )}

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={currentValue}
        disabled={disabled}
        onChange={handleChange}
        aria-label={label || 'Slider'}
        className={`w-full h-1.5 rounded-full appearance-none bg-gray-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${ACCENT_CLASSES[color]}`}
      />

      {marks.length > 0 && (
        <div className="relative h-5 mt-1">
          {marks.map((mark) => (
            <span
              key={mark.value}
              className="absolute text-xs text-gray-400 -translate-x-1/2"
              style={{ left: `${percentOf(mark.value)}%` }}
            >
              {mark.label ?? mark.value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default Slider;
