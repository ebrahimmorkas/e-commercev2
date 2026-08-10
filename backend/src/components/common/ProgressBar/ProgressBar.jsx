import React from 'react';

const COLOR_CLASSES = {
  blue: 'bg-blue-600',
  green: 'bg-green-600',
  red: 'bg-red-600',
  yellow: 'bg-yellow-500',
  purple: 'bg-purple-600',
};

const STROKE_COLORS = {
  blue: '#2563eb',
  green: '#16a34a',
  red: '#dc2626',
  yellow: '#eab308',
  purple: '#9333ea',
};

/**
 * A highly reusable determinate Progress Bar Component (linear or circular)
 *
 * @param {Object} props - Component properties
 * @param {number} props.value - Current progress value
 * @param {number} props.max - Value representing 100%
 * @param {string} props.variant - Display style (linear, circular)
 * @param {string} props.size - Thickness (linear) or diameter (circular): sm, md, lg
 * @param {string} props.color - Fill color (blue, green, red, yellow, purple)
 * @param {boolean} props.showLabel - Show the percentage as text
 * @param {string} props.label - Custom label text, overriding the default "N%"
 * @param {boolean} props.striped - Diagonal stripe texture (linear only)
 * @param {string} props.className - Additional CSS classes for the outer wrapper
 */
const ProgressBar = ({
  value = 0,
  max = 100,
  variant = 'linear',
  size = 'md',
  color = 'blue',
  showLabel = false,
  label,
  striped = false,
  className = '',
}) => {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  const displayLabel = label ?? `${Math.round(percent)}%`;

  if (variant === 'circular') {
    const diameterMap = { sm: 40, md: 64, lg: 96 };
    const strokeMap = { sm: 4, md: 6, lg: 8 };
    const diameter = diameterMap[size];
    const stroke = strokeMap[size];
    const radius = (diameter - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - percent / 100);

    return (
      <div
        className={`relative inline-flex items-center justify-center ${className}`}
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <svg width={diameter} height={diameter} className="-rotate-90">
          <circle cx={diameter / 2} cy={diameter / 2} r={radius} stroke="#e5e7eb" strokeWidth={stroke} fill="none" />
          <circle
            cx={diameter / 2}
            cy={diameter / 2}
            r={radius}
            stroke={STROKE_COLORS[color]}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-300 ease-out"
          />
        </svg>
        {showLabel && (
          <span className="absolute text-xs font-semibold text-gray-700">{displayLabel}</span>
        )}
      </div>
    );
  }

  const heightClasses = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-4' };

  return (
    <div className={className}>
      {showLabel && (
        <div className="flex justify-end mb-1">
          <span className="text-xs font-medium text-gray-600">{displayLabel}</span>
        </div>
      )}
      <div
        className={`w-full ${heightClasses[size]} bg-gray-200 rounded-full overflow-hidden`}
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`
            h-full rounded-full transition-all duration-300 ease-out
            ${COLOR_CLASSES[color]}
            ${striped ? 'bg-[length:1rem_1rem] bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.15)_50%,rgba(255,255,255,0.15)_75%,transparent_75%,transparent)]' : ''}
          `.trim().replace(/\s+/g, ' ')}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
