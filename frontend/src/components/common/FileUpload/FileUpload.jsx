import React, { useEffect, useRef, useState } from 'react';

const UploadIcon = () => (
  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
);

const FileIcon = () => (
  <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const RemoveIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

let idCounter = 0;
const nextId = () => `file-${Date.now()}-${idCounter++}`;

/**
 * A highly reusable File Upload / Dropzone Component
 *
 * @param {Object} props - Component properties
 * @param {Function} props.onFilesSelected - (files: File[]) => void, called with the current valid file list
 * @param {string} props.accept - Native `accept` attribute (e.g. 'image/*,.pdf')
 * @param {boolean} props.multiple - Allow selecting more than one file
 * @param {number} props.maxSize - Maximum file size in bytes; larger files are rejected with an inline error
 * @param {number} props.maxFiles - Maximum number of files allowed
 * @param {boolean} props.disabled - Disable the dropzone
 * @param {string} props.label - Label above the dropzone
 * @param {string} props.helperText - Helper text below the dropzone
 * @param {string} props.error - External error message to display
 * @param {string} props.className - Additional CSS classes for the outer wrapper
 */
const FileUpload = ({
  onFilesSelected,
  accept,
  multiple = false,
  maxSize,
  maxFiles,
  disabled = false,
  label = '',
  helperText = '',
  error = '',
  className = '',
}) => {
  const [items, setItems] = useState([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    onFilesSelected?.(items.filter((item) => !item.error).map((item) => item.file));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const addFiles = (fileList) => {
    if (disabled) return;

    const incoming = Array.from(fileList).map((file) => {
      const tooLarge = maxSize && file.size > maxSize;
      return {
        id: nextId(),
        file,
        error: tooLarge ? `File exceeds ${formatBytes(maxSize)} limit` : null,
      };
    });

    setItems((prev) => {
      const combined = multiple ? [...prev, ...incoming] : incoming;
      return maxFiles ? combined.slice(0, maxFiles) : combined;
    });
  };

  const removeItem = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    if (disabled) return;
    addFiles(e.dataTransfer.files);
  };

  const handleInputChange = (e) => {
    if (e.target.files.length > 0) addFiles(e.target.files);
    e.target.value = '';
  };

  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}

      <div
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragActive(true);
        }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={handleDrop}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) inputRef.current?.click();
        }}
        className={`
          flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed
          px-6 py-10 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
          ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'cursor-pointer hover:border-blue-400 hover:bg-blue-50/50'}
          ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
          ${error ? 'border-red-400' : ''}
        `.trim().replace(/\s+/g, ' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={handleInputChange}
          className="hidden"
        />
        <UploadIcon />
        <p className="text-sm text-gray-600">
          <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
        </p>
        {(accept || maxSize) && (
          <p className="text-xs text-gray-400">
            {accept && `${accept} `}
            {maxSize && `up to ${formatBytes(maxSize)}`}
          </p>
        )}
      </div>

      {(error || helperText) && (
        <p className={`mt-1 text-sm ${error ? 'text-red-600' : 'text-gray-500'}`}>{error || helperText}</p>
      )}

      {items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${item.error ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}
            >
              <FileIcon />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 truncate">{item.file.name}</p>
                <p className={`text-xs ${item.error ? 'text-red-600' : 'text-gray-400'}`}>
                  {item.error || formatBytes(item.file.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                aria-label={`Remove ${item.file.name}`}
                className="flex-shrink-0 text-gray-400 hover:text-gray-600 rounded p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <RemoveIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default FileUpload;
