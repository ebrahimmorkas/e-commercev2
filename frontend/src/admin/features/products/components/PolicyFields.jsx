import Switch from '../../../../components/common/Switch';
import InputField from '../../../../components/common/InputField';
import Dropdown from '../../../../components/common/DropDown';
import theme from '../theme/theme';

const DURATION_TYPE_OPTIONS = [
  { value: 'DAYS', label: 'Days' },
  { value: 'MONTHS', label: 'Months' },
  { value: 'YEARS', label: 'Years' },
];

/**
 * One warranty/return/exchange policy: { isAvailable, duration, durationType }.
 */
const PolicyFields = ({ label, value, onChange, unavailable = false }) => {
  const policy = value || { isAvailable: false, duration: null, durationType: null };

  const setAvailable = (isAvailable) => onChange({ isAvailable, duration: isAvailable ? policy.duration : null, durationType: isAvailable ? policy.durationType : null });

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      {/* When the store doesn't have this feature it can't be switched ON, but one that is already on can
          still be switched off - otherwise an existing size would be stuck and every save would be rejected. */}
      <Switch
        label={label}
        checked={policy.isAvailable}
        onChange={(e) => setAvailable(e.target.checked)}
        disabled={unavailable && !policy.isAvailable}
        description={unavailable ? 'Not enabled for your account.' : ''}
        color={theme.switch.color}
      />
      {policy.isAvailable && (
        <div className="grid grid-cols-2 gap-3 mt-3">
          <InputField
            type="number"
            label="Duration"
            placeholder="e.g. 30"
            value={policy.duration ?? ''}
            onChange={(e) => onChange({ ...policy, duration: e.target.value })}
          />
          <Dropdown
            label="Duration Type"
            options={DURATION_TYPE_OPTIONS}
            value={policy.durationType || ''}
            onChange={(val) => onChange({ ...policy, durationType: val })}
          />
        </div>
      )}
    </div>
  );
};

export default PolicyFields;
