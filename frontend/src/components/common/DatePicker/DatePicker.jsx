import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const CalendarIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);
const ChevronLeftIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);
const ChevronRightIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);
const ClearIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const pad = (n) => String(n).padStart(2, '0');
const formatDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const isSameDay = (a, b) => !!a && !!b && formatDate(a) === formatDate(b);
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const parseDateValue = (value) => {
  if (!value) return null;
  if (value instanceof Date) return startOfDay(value);
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/** Flat array of 42 Date objects covering the full weeks overlapping the given month */
const getMonthGrid = (year, month) => {
  const firstOfMonth = new Date(year, month, 1);
  const startDate = new Date(year, month, 1 - firstOfMonth.getDay());
  return Array.from({ length: 42 }, (_, i) => new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i));
};

/**
 * A highly reusable Date Picker Component (single date, Gregorian, no time component)
 *
 * @param {Object} props - Component properties
 * @param {Date|string} props.value - Controlled selected date (Date object or 'YYYY-MM-DD' string)
 * @param {Date|string} props.defaultValue - Default selected date (uncontrolled)
 * @param {Function} props.onChange - (date: Date|null) => void
 * @param {Date} props.minDate - Earliest selectable date
 * @param {Date} props.maxDate - Latest selectable date
 * @param {Function} props.disabledDates - (date) => boolean, for custom disabled days (e.g. weekends)
 * @param {string} props.label - Label text above the input
 * @param {string} props.placeholder - Input placeholder when no date is selected
 * @param {boolean} props.required - Whether the field is required
 * @param {boolean} props.clearable - Show a clear (x) button when a date is selected
 * @param {boolean} props.disabled - Disable the whole field
 * @param {string} props.error - Error message to display
 * @param {string} props.helperText - Helper text to display below the input
 * @param {string} props.name - Input name attribute
 * @param {string} props.id - Input id attribute
 * @param {string} props.className - Additional CSS classes for the outer wrapper
 *
 * The calendar popover is portaled to document.body and positioned via
 * getBoundingClientRect, so it isn't clipped by a scrollable/overflow-hidden
 * ancestor (e.g. a Modal body) - same approach as Dropdown.
 */
const DatePicker = ({
  value,
  defaultValue,
  onChange,
  minDate,
  maxDate,
  disabledDates,
  label = '',
  placeholder = 'YYYY-MM-DD',
  required = false,
  clearable = true,
  disabled = false,
  error = '',
  helperText = '',
  name = '',
  id = '',
  className = '',
}) => {
  const [internalValue, setInternalValue] = useState(() => parseDateValue(defaultValue));
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => parseDateValue(value ?? defaultValue) || startOfDay(new Date()));
  const [popoverStyle, setPopoverStyle] = useState(null);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const calendarRef = useRef(null);

  const isControlled = value !== undefined;
  const selectedDate = isControlled ? parseDateValue(value) : internalValue;

  const updatePopoverPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 288; // w-72
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - popoverWidth - 8));
    setPopoverStyle({ position: 'fixed', top: rect.bottom + 4, left });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen) {
      setPopoverStyle(null);
      return;
    }
    updatePopoverPosition();
    const handleReposition = () => updatePopoverPosition();
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    return () => {
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [isOpen, updatePopoverPosition]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      const clickedTrigger = containerRef.current && containerRef.current.contains(e.target);
      const clickedCalendar = calendarRef.current && calendarRef.current.contains(e.target);
      if (!clickedTrigger && !clickedCalendar) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isOpen && e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const commit = (date) => {
    if (!isControlled) setInternalValue(date);
    onChange?.(date);
  };

  const isDisabledDate = (date) => {
    if (minDate && date < startOfDay(minDate)) return true;
    if (maxDate && date > startOfDay(maxDate)) return true;
    if (disabledDates?.(date)) return true;
    return false;
  };

  const handleSelectDay = (date) => {
    if (isDisabledDate(date)) return;
    commit(date);
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    commit(null);
  };

  const changeMonth = (delta) => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const today = startOfDay(new Date());
  const grid = getMonthGrid(viewDate.getFullYear(), viewDate.getMonth());

  return (
    <div className={`w-full ${className}`} ref={containerRef}>
      {label && (
        <label htmlFor={id || name} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative" ref={triggerRef}>
        <button
          type="button"
          id={id || name}
          disabled={disabled}
          onClick={() => !disabled && setIsOpen((o) => !o)}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          className={`
            w-full flex items-center justify-between gap-2 px-4 py-2 border rounded-lg text-left
            focus:outline-none focus:ring-2 transition-all duration-200
            ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}
            ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'bg-white cursor-pointer'}
          `.trim().replace(/\s+/g, ' ')}
        >
          <span className={selectedDate ? 'text-gray-900' : 'text-gray-400'}>
            {selectedDate ? formatDate(selectedDate) : placeholder}
          </span>
          <span className="flex items-center gap-1 text-gray-400 flex-shrink-0">
            {clearable && selectedDate && !disabled && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear date"
                onClick={handleClear}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleClear(e)}
                className="hover:text-gray-600"
              >
                <ClearIcon />
              </span>
            )}
            <CalendarIcon />
          </span>
        </button>

        {isOpen && popoverStyle && createPortal(
          <div
            ref={calendarRef}
            role="dialog"
            aria-label="Choose a date"
            style={popoverStyle}
            className="z-[9999] w-72 bg-white border border-gray-200 rounded-lg shadow-lg p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                aria-label="Previous month"
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <ChevronLeftIcon />
              </button>
              <span className="text-sm font-semibold text-gray-900">
                {MONTH_NAMES[viewDate.getMonth()]} {viewDate.getFullYear()}
              </span>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                aria-label="Next month"
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <ChevronRightIcon />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAY_LABELS.map((d) => (
                <span key={d} className="text-center text-xs font-medium text-gray-400 py-1">
                  {d}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {grid.map((date) => {
                const inCurrentMonth = date.getMonth() === viewDate.getMonth();
                const isSelected = isSameDay(date, selectedDate);
                const isToday = isSameDay(date, today);
                const dayDisabled = isDisabledDate(date);

                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    disabled={dayDisabled}
                    onClick={() => handleSelectDay(date)}
                    aria-current={isToday ? 'date' : undefined}
                    aria-pressed={isSelected}
                    className={`
                      h-8 w-8 text-sm rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
                      ${!inCurrentMonth ? 'text-gray-300' : 'text-gray-700'}
                      ${isSelected ? 'bg-blue-600 text-white font-semibold' : ''}
                      ${!isSelected && isToday ? 'ring-1 ring-blue-400' : ''}
                      ${!isSelected && !dayDisabled ? 'hover:bg-gray-100' : ''}
                      ${dayDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                    `.trim().replace(/\s+/g, ' ')}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                if (!isDisabledDate(today)) handleSelectDay(today);
                setViewDate(today);
              }}
              className="mt-2 w-full text-center text-sm text-blue-600 hover:text-blue-700 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Today
            </button>
          </div>,
          document.body
        )}
      </div>

      {(error || helperText) && (
        <p className={`mt-1 text-sm ${error ? 'text-red-600' : 'text-gray-500'}`}>{error || helperText}</p>
      )}
    </div>
  );
};

export default DatePicker;
