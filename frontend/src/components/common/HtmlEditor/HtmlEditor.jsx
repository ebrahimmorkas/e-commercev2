import { useRef, useState } from 'react';
import TextArea from '../TextArea';
import Tabs from '../Tabs';
import Button from '../Buttons';

// Each entry wraps the current selection in `before`/`after` (or drops the
// placeholder in when nothing is selected).
const TOOLBAR_ACTIONS = [
  { key: 'bold', label: 'B', title: 'Bold', before: '<strong>', after: '</strong>', placeholder: 'bold text', className: 'font-bold' },
  { key: 'italic', label: 'I', title: 'Italic', before: '<em>', after: '</em>', placeholder: 'italic text', className: 'italic' },
  { key: 'underline', label: 'U', title: 'Underline', before: '<u>', after: '</u>', placeholder: 'underlined text', className: 'underline' },
  { key: 'h1', label: 'H1', title: 'Heading', before: '<h1>', after: '</h1>\n', placeholder: 'Heading' },
  { key: 'h2', label: 'H2', title: 'Sub heading', before: '<h2>', after: '</h2>\n', placeholder: 'Sub heading' },
  { key: 'p', label: 'P', title: 'Paragraph', before: '<p>', after: '</p>\n', placeholder: 'Paragraph text' },
  { key: 'ul', label: 'List', title: 'Bulleted list', before: '<ul>\n  <li>', after: '</li>\n</ul>\n', placeholder: 'Item' },
  { key: 'br', label: 'BR', title: 'Line break', before: '<br />\n', after: '', placeholder: '' },
  { key: 'link', label: 'Link', title: 'Link', before: '<a href="https://">', after: '</a>', placeholder: 'link text' },
];

const TAB_ITEMS = [
  { key: 'code', label: 'HTML' },
  { key: 'preview', label: 'Preview' },
];

/**
 * A reusable HTML source editor with a formatting toolbar, optional
 * "insert variable" chips, and a sandboxed live preview.
 *
 * The preview renders inside an iframe with an empty `sandbox` attribute, so
 * scripts, forms and navigation inside the previewed HTML can never run.
 *
 * @param {Object} props - Component properties
 * @param {string} props.value - Current HTML string (controlled)
 * @param {(value: string) => void} props.onChange - Called with the new HTML string
 * @param {Function} props.onBlur - Blur handler for the underlying textarea
 * @param {string} props.label - Label text
 * @param {string} props.name - Field name / id
 * @param {boolean} props.required - Whether the field is required
 * @param {string} props.error - Error message to display
 * @param {string} props.helperText - Helper text below the editor
 * @param {string} props.placeholder - Placeholder for the HTML source
 * @param {number} props.rows - Visible rows of the source textarea
 * @param {boolean} props.disabled - Disable editing
 * @param {Array} props.variables - [{ key, description }] merge tokens offered as insertable chips ({{key}})
 * @param {string} props.previewHeight - CSS height of the preview pane
 * @param {string} props.className - Additional CSS classes for the wrapper
 */
const HtmlEditor = ({
  value = '',
  onChange,
  onBlur,
  label = '',
  name = 'htmlEditor',
  required = false,
  error = '',
  helperText = '',
  placeholder = '',
  rows = 12,
  disabled = false,
  variables = [],
  previewHeight = '320px',
  className = '',
}) => {
  const [mode, setMode] = useState('code');
  const wrapperRef = useRef(null);

  const getTextarea = () => wrapperRef.current?.querySelector('textarea') || null;

  const insertAtSelection = (before, after = '', placeholderText = '') => {
    const textarea = getTextarea();
    const start = textarea ? textarea.selectionStart : value.length;
    const end = textarea ? textarea.selectionEnd : value.length;
    const selected = value.slice(start, end) || placeholderText;
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    onChange?.(next);

    // Put the cursor back around what was inserted once React re-renders.
    const selStart = start + before.length;
    const selEnd = selStart + selected.length;
    requestAnimationFrame(() => {
      const el = getTextarea();
      if (!el) return;
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  };

  const insertVariable = (key) => insertAtSelection(`{{${key}}}`);

  return (
    <div className={`w-full ${className}`} ref={wrapperRef}>
      {label && (
        <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <Tabs items={TAB_ITEMS} value={mode} onChange={setMode} variant="pills" size="sm" />

      {mode === 'code' ? (
        <div className="mt-2">
          <div className="flex flex-wrap gap-1 mb-2">
            {TOOLBAR_ACTIONS.map((action) => (
              <Button
                key={action.key}
                variant="secondary"
                size="xs"
                disabled={disabled}
                ariaLabel={action.title}
                title={action.title}
                className={action.className}
                onClick={() => insertAtSelection(action.before, action.after, action.placeholder)}
              >
                {action.label}
              </Button>
            ))}
          </div>

          {variables.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 mb-2">
              <span className="text-xs text-gray-500 mr-1">Insert variable:</span>
              {variables.map((variable) => (
                <Button
                  key={variable.key}
                  variant="outline"
                  size="xs"
                  disabled={disabled}
                  title={variable.description}
                  onClick={() => insertVariable(variable.key)}
                >
                  {`{{${variable.key}}}`}
                </Button>
              ))}
            </div>
          )}

          <TextArea
            name={name}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            onBlur={onBlur}
            placeholder={placeholder}
            rows={rows}
            disabled={disabled}
            showError={false}
            className="font-mono text-sm"
            spellCheck={false}
          />
        </div>
      ) : (
        <div className="mt-2 border border-gray-300 rounded-lg bg-white overflow-hidden" style={{ height: previewHeight }}>
          {value.trim() ? (
            <iframe title={`${name}-preview`} sandbox="" srcDoc={value} className="w-full h-full border-0" />
          ) : (
            <p className="p-4 text-sm text-gray-400">Nothing to preview yet.</p>
          )}
        </div>
      )}

      {error && (
        <p className="mt-1 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {!error && helperText && <p className="mt-1 text-xs text-gray-500">{helperText}</p>}
    </div>
  );
};

export default HtmlEditor;
