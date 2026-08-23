import InputField from '../../../../components/common/InputField';
import Button from '../../../../components/common/Buttons';
import theme from '../theme/theme';

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

/**
 * Editor for a description array: [{ key, value }]. Used at product,
 * variant ("additional"), and size ("additional") level.
 */
const DescriptionListEditor = ({ label = 'Description', value = [], onChange }) => {
  const updateRow = (index, field, val) => {
    const next = value.map((row, i) => (i === index ? { ...row, [field]: val } : row));
    onChange(next);
  };
  const addRow = () => onChange([...value, { key: '', value: '' }]);
  const removeRow = (index) => onChange(value.filter((_, i) => i !== index));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="block text-sm font-medium text-gray-700">{label}</span>
        <Button type="button" size="xs" variant={theme.button.ghost} leftIcon={<PlusIcon />} onClick={addRow}>
          Add row
        </Button>
      </div>
      {value.length === 0 && <p className={`text-sm ${theme.text.muted}`}>No entries yet.</p>}
      <div className="space-y-2">
        {value.map((row, index) => (
          <div key={index} className="flex flex-col sm:flex-row gap-2 rounded-lg border border-gray-100 bg-gray-50/60 sm:bg-transparent sm:border-0 p-2 sm:p-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
              <InputField placeholder="Key (e.g. Material)" value={row.key} onChange={(e) => updateRow(index, 'key', e.target.value)} />
              <InputField placeholder="Value (e.g. Cotton)" value={row.value} onChange={(e) => updateRow(index, 'value', e.target.value)} />
            </div>
            <Button
              type="button"
              isIconOnly
              size="sm"
              variant={theme.button.ghost}
              ariaLabel="Remove row"
              onClick={() => removeRow(index)}
              className="self-end sm:self-start flex-shrink-0"
            >
              <TrashIcon />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DescriptionListEditor;
