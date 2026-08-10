import React, { useEffect, useRef, useState } from 'react';

const defaultFilter = (option, query) => option.label.toLowerCase().includes(query.toLowerCase());

const normalizeOptions = (options) =>
  options.map((opt) => (typeof opt === 'string' ? { value: opt, label: opt } : opt));

/**
 * A highly reusable Autocomplete / Combobox Component
 * Unlike Dropdown (a closed select you click to open), this is a free-text input
 * that filters and reveals suggestions as you type — the user isn't forced to pick one.
 *
 * @param {Object} props - Component properties
 * @param {Array} props.options - Suggestions: array of strings, or [{ value, label }]
 * @param {string} props.value - Controlled input text
 * @param {string} props.defaultValue - Default input text (uncontrolled)
 * @param {Function} props.onChange - (text) => void, called as the input text changes
 * @param {Function} props.onSelect - (option) => void, called when a suggestion is picked
 * @param {string} props.placeholder - Input placeholder
 * @param {string} props.label - Label text above the input
 * @param {Function} props.filterFn - (option, query) => boolean, defaults to case-insensitive label match
 * @param {number} props.minChars - Minimum characters typed before suggestions appear
 * @param {string} props.noOptionsText - Text shown when nothing matches
 * @param {boolean} props.loading - Show a loading row instead of the option list (for async sources)
 * @param {boolean} props.disabled - Disable the input
 * @param {boolean} props.required - Whether the field is required
 * @param {string} props.error - Error message to display
 * @param {string} props.helperText - Helper text to display below the input
 * @param {string} props.name - Input name attribute
 * @param {string} props.id - Input id attribute
 * @param {string} props.className - Additional CSS classes for the outer wrapper
 */
const Autocomplete = ({
  options = [],
  value,
  defaultValue = '',
  onChange,
  onSelect,
  placeholder = '',
  label = '',
  filterFn = defaultFilter,
  minChars = 0,
  noOptionsText = 'No options found',
  loading = false,
  disabled = false,
  required = false,
  error = '',
  helperText = '',
  name = '',
  id = '',
  className = '',
}) => {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);

  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  const normalizedOptions = normalizeOptions(options);
  const filteredOptions =
    currentValue.length >= minChars
      ? normalizedOptions.filter((opt) => filterFn(opt, currentValue))
      : [];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const commit = (text) => {
    if (!isControlled) setInternalValue(text);
    onChange?.(text);
  };

  const handleInputChange = (e) => {
    commit(e.target.value);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleSelect = (option) => {
    commit(option.label);
    onSelect?.(option);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true);
      return;
    }
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          e.preventDefault();
          handleSelect(filteredOptions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
      default:
        break;
    }
  };

  const showMenu = isOpen && currentValue.length >= minChars;

  return (
    <div className={`w-full ${className}`} ref={containerRef}>
      {label && (
        <label htmlFor={id || name} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          type="text"
          id={id || name}
          name={name}
          role="combobox"
          aria-expanded={showMenu}
          aria-autocomplete="list"
          aria-controls={`${id || name}-listbox`}
          autoComplete="off"
          value={currentValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`
            w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-all duration-200
            ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'}
            ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'bg-white'}
          `.trim().replace(/\s+/g, ' ')}
        />

        {showMenu && (
          <div
            id={`${id || name}-listbox`}
            role="listbox"
            className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto"
          >
            {loading ? (
              <div className="px-4 py-3 text-sm text-gray-500">Loading...</div>
            ) : filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => (
                <div
                  key={option.value}
                  role="option"
                  aria-selected={index === highlightedIndex}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(option);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`px-4 py-2 text-sm cursor-pointer ${
                    index === highlightedIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {option.label}
                </div>
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-gray-500">{noOptionsText}</div>
            )}
          </div>
        )}
      </div>

      {(error || helperText) && (
        <p className={`mt-1 text-sm ${error ? 'text-red-600' : 'text-gray-500'}`}>{error || helperText}</p>
      )}
    </div>
  );
};

export default Autocomplete;
