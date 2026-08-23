import { useState } from 'react';
import InputField from '../../../../components/common/InputField';
import Badge from '../../../../components/common/Badge';
import theme from '../theme/theme';

/**
 * Free-text tag list editor (colors, search keywords, exclude zip codes).
 * Enter or comma commits the current text as a new tag.
 */
const TagInput = ({ label, placeholder, value = [], onChange, helperText, badgeVariant = 'blue' }) => {
  const [draft, setDraft] = useState('');

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (!value.some((v) => v.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...value, trimmed]);
    }
    setDraft('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const removeAt = (index) => onChange(value.filter((_, i) => i !== index));

  return (
    <div className="w-full">
      <InputField
        label={label}
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
      />
      {helperText && <p className={`mt-1 text-xs ${theme.text.muted}`}>{helperText}</p>}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {value.map((tag, index) => (
            <Badge key={`${tag}-${index}`} variant={badgeVariant} onRemove={() => removeAt(index)} removeLabel={`Remove ${tag}`}>
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

export default TagInput;
