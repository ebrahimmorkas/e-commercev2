import { useRef, useState } from 'react';
import Modal from '../Modal';
import InputField from '../InputField';
import Button from '../Buttons';
import { resolveLinkUrl, MAX_LINK_URL_LENGTH } from './linkUrl';

const MAX_LINK_TEXT_LENGTH = 500;

/**
 * "Insert link" dialog of the HtmlEditor: the text to show and where it goes.
 * Mounted only while open, so its fields start from the current selection.
 *
 * @param {Object} props - Component properties
 * @param {string} props.initialText - The text selected in the editor (may be empty)
 * @param {Array} props.variables - [{ key, description }] tokens that can be put in the link ({{key}})
 * @param {(link: { href: string, text: string }) => void} props.onInsert
 * @param {Function} props.onClose
 */
const LinkDialog = ({ initialText = '', variables = [], onInsert, onClose }) => {
  const [text, setText] = useState(initialText);
  const [url, setUrl] = useState('');
  const [errors, setErrors] = useState({});
  const urlRef = useRef(null);

  // {{image:name}} tokens become <img> tags, never part of an address.
  const urlVariables = variables.filter((variable) => !variable.key.startsWith('image:'));

  const handleInsert = () => {
    const nextErrors = {};
    const linkText = text.trim();
    if (!linkText) nextErrors.text = 'Please enter the text to show.';
    else if (linkText.length > MAX_LINK_TEXT_LENGTH) nextErrors.text = `The text can be at most ${MAX_LINK_TEXT_LENGTH} characters.`;
    const { href, error } = resolveLinkUrl(url);
    if (error) nextErrors.url = error;
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    onInsert({ href, text: linkText });
  };

  const handleKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    handleInsert();
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Insert link"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleInsert}>
            Insert link
          </Button>
        </>
      }
    >
      <div className="space-y-4" onKeyDown={handleKeyDown}>
        <InputField
          label="Text to show"
          name="linkText"
          placeholder="e.g. Google"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setErrors((prev) => ({ ...prev, text: '' }));
          }}
          maxLength={MAX_LINK_TEXT_LENGTH}
          error={errors.text || ''}
          required
        />
        <div ref={urlRef}>
          <InputField
            label="Link to"
            name="linkUrl"
            placeholder="https://google.com"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setErrors((prev) => ({ ...prev, url: '' }));
            }}
            maxLength={MAX_LINK_URL_LENGTH}
            error={errors.url || ''}
            required
          />
          <p className="mt-1 text-xs text-gray-500">A web address, an email address or a phone number.</p>
          {urlVariables.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 mt-2">
              <span className="text-xs text-gray-500 mr-1">Add variable:</span>
              {urlVariables.map((variable) => (
                <Button
                  key={variable.key}
                  variant="outline"
                  size="xs"
                  title={variable.description}
                  onClick={() => {
                    setUrl((prev) => `${prev}{{${variable.key}}}`);
                    setErrors((prev) => ({ ...prev, url: '' }));
                    urlRef.current?.querySelector('input')?.focus();
                  }}
                >
                  {`{{${variable.key}}}`}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default LinkDialog;
