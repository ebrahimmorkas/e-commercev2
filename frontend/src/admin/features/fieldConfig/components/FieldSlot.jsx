import CustomFieldInput from './CustomFieldInput';
import { CUSTOM_FIELD_PLACEMENTS } from '../constants';

/**
 * Wraps one built-in form field so the vendor's field config can act on it
 * without the form knowing: the field is drawn as usual, or left out when
 * hidden, with the vendor's custom fields placed before / after / in place of it.
 *
 * @param {Object} props
 * @param {Object} props.config - useFieldConfig(entity) view
 * @param {string} props.field - the built-in field's registry name, e.g. 'productCode'
 * @param {Object} props.values - custom field values { key: value }
 * @param {(key: string, value: any) => void} props.onValueChange
 * @param {(key: string) => string} [props.errorFor]
 * @param {React.ReactNode} props.children - the built-in field (may be null, e.g. an auto-generated code)
 */
const FieldSlot = ({ config, field, values, onValueChange, errorFor = () => '', children }) => {
  const renderFields = (definitions) =>
    definitions.map((definition) => (
      <CustomFieldInput
        key={definition.key}
        definition={definition}
        value={values?.[definition.key]}
        onChange={(next) => onValueChange(definition.key, next)}
        error={errorFor(definition.key)}
      />
    ));

  return (
    <>
      {renderFields(config.customFieldsAt(CUSTOM_FIELD_PLACEMENTS.BEFORE, field))}
      {config.isHidden(field) ? renderFields(config.customFieldsAt(CUSTOM_FIELD_PLACEMENTS.REPLACE, field)) : children}
      {renderFields(config.customFieldsAt(CUSTOM_FIELD_PLACEMENTS.AFTER, field))}
    </>
  );
};

export default FieldSlot;
