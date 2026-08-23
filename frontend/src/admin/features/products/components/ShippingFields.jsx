import Dropdown from '../../../../components/common/DropDown';
import InputField from '../../../../components/common/InputField';
import theme from '../theme/theme';

const SHIPPING_TYPE_OPTIONS = [
  { value: 'COMPANY_SETTINGS', label: 'Use company default' },
  { value: 'CUSTOM', label: 'Custom amount' },
];

/**
 * shipping: { type: 'CUSTOM'|'COMPANY_SETTINGS', value }. There is currently
 * no company-wide shipping default configured anywhere in the backend
 * (checked CompanySettings) - "Use company default" just tells the backend
 * to store no custom value.
 */
const ShippingFields = ({ value, onChange }) => {
  const shipping = value || { type: 'COMPANY_SETTINGS', value: null };

  return (
    <div>
      <Dropdown
        label="Shipping"
        options={SHIPPING_TYPE_OPTIONS}
        value={shipping.type}
        onChange={(type) => onChange(type === 'CUSTOM' ? { type, value: shipping.value ?? '' } : { type, value: null })}
      />
      {shipping.type === 'CUSTOM' && (
        <InputField
          type="number"
          label="Shipping Amount"
          placeholder="e.g. 49"
          value={shipping.value ?? ''}
          onChange={(e) => onChange({ ...shipping, value: e.target.value })}
          className="mt-3"
        />
      )}
      {shipping.type === 'COMPANY_SETTINGS' && (
        <p className={`mt-1 text-xs ${theme.text.muted}`}>No company-wide default is configured yet - this size will ship without an explicit charge until one is set up.</p>
      )}
    </div>
  );
};

export default ShippingFields;
