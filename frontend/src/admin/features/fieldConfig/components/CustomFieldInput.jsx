import InputField from '../../../../components/common/InputField';
import Dropdown from '../../../../components/common/DropDown';
import { CUSTOM_FIELD_TYPES } from '../constants';

/**
 * Input for one of the vendor's custom fields (text / number / select),
 * drawn from its definition in the field config.
 */
const CustomFieldInput = ({ definition, value, onChange, error }) => {
  if (definition.type === CUSTOM_FIELD_TYPES.SELECT) {
    return (
      <Dropdown
        label={definition.label}
        placeholder={definition.placeholder || 'Select'}
        options={(definition.options || []).map((option) => ({ value: option, label: option }))}
        value={value ?? ''}
        onChange={(next) => onChange(next ?? '')}
        required={definition.required}
        clearable={!definition.required}
        error={error}
      />
    );
  }

  return (
    <InputField
      type={definition.type === CUSTOM_FIELD_TYPES.NUMBER ? 'number' : 'text'}
      label={definition.label}
      placeholder={definition.placeholder || ''}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      maxLength={definition.type === CUSTOM_FIELD_TYPES.TEXT ? definition.maxLength || 500 : undefined}
      required={definition.required}
      error={error}
    />
  );
};

export default CustomFieldInput;
