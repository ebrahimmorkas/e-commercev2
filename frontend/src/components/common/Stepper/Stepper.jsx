import React from 'react';

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
  </svg>
);

const CIRCLE_CLASSES = {
  completed: 'bg-blue-600 border-blue-600 text-white',
  active: 'bg-white border-blue-600 text-blue-600',
  upcoming: 'bg-white border-gray-300 text-gray-400',
};

const StepCircle = ({ status, index }) => (
  <span
    className={`flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-full border-2 font-semibold text-sm transition-colors ${CIRCLE_CLASSES[status]}`}
  >
    {status === 'completed' ? <CheckIcon /> : index + 1}
  </span>
);

/**
 * A highly reusable Stepper Component (multi-step flow indicator)
 *
 * @param {Object} props - Component properties
 * @param {Array} props.steps - Step definitions [{ key, label, description? }]
 * @param {number} props.currentStep - Index of the active step (0-indexed)
 * @param {Array} props.completedSteps - Explicit indices to mark completed, overriding the
 *   default "everything before currentStep is complete" behavior
 * @param {string} props.variant - Layout (horizontal, vertical)
 * @param {Function} props.onStepClick - (index) => void — if provided, steps become clickable
 * @param {string} props.className - Additional CSS classes for the outer wrapper
 */
const Stepper = ({
  steps = [],
  currentStep = 0,
  completedSteps,
  variant = 'horizontal',
  onStepClick,
  className = '',
}) => {
  const isCompleted = (index) =>
    completedSteps ? completedSteps.includes(index) : index < currentStep;

  const getStatus = (index) => {
    if (isCompleted(index)) return 'completed';
    if (index === currentStep) return 'active';
    return 'upcoming';
  };

  const lineClasses = (index) => (isCompleted(index) ? 'bg-blue-600' : 'bg-gray-200');

  if (variant === 'vertical') {
    return (
      <ol className={className}>
        {steps.map((step, index) => {
          const status = getStatus(index);
          const isLast = index === steps.length - 1;
          const clickable = !!onStepClick;

          return (
            <li key={step.key} className="relative flex gap-4 pb-8 last:pb-0">
              {!isLast && (
                <span className={`absolute left-4 top-8 -ml-px w-0.5 h-full ${lineClasses(index)}`} />
              )}
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onStepClick?.(index)}
                className={`relative z-10 ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                aria-current={status === 'active' ? 'step' : undefined}
              >
                <StepCircle status={status} index={index} />
              </button>
              <div className="pt-1">
                <p className={`text-sm font-medium ${status === 'upcoming' ? 'text-gray-400' : 'text-gray-900'}`}>
                  {step.label}
                </p>
                {step.description && <p className="text-sm text-gray-500 mt-0.5">{step.description}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <ol className={`flex items-start ${className}`}>
      {steps.map((step, index) => {
        const status = getStatus(index);
        const isLast = index === steps.length - 1;
        const clickable = !!onStepClick;

        return (
          <li key={step.key} className={`flex items-center ${isLast ? '' : 'flex-1'}`}>
            <div className="flex flex-col items-center text-center">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onStepClick?.(index)}
                className={clickable ? 'cursor-pointer' : 'cursor-default'}
                aria-current={status === 'active' ? 'step' : undefined}
              >
                <StepCircle status={status} index={index} />
              </button>
              <p className={`mt-2 text-xs font-medium max-w-[6rem] ${status === 'upcoming' ? 'text-gray-400' : 'text-gray-900'}`}>
                {step.label}
              </p>
            </div>
            {!isLast && <span className={`flex-1 h-0.5 mx-2 mt-[-1.25rem] ${lineClasses(index)}`} />}
          </li>
        );
      })}
    </ol>
  );
};

export default Stepper;
