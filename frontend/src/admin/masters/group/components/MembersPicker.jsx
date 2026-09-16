import { useState } from 'react';
import Dropdown from '../../../../components/common/DropDown';
import InputField from '../../../../components/common/InputField';
import Badge from '../../../../components/common/Badge';
import Button from '../../../../components/common/Buttons';
import CategoryMembersPicker from './CategoryMembersPicker';
import theme from '../theme/theme';

const HEX24 = /^[a-f0-9]{24}$/i;

/**
 * Members field for the group form. PRODUCT/BRAND/ORDER/USER groups pick
 * from a searchable multi-select of the real collection (options come from
 * useGroupFormLookups); CATEGORY groups use CategoryMembersPicker's
 * drill-down path picker instead, since categories nest; CUSTOM groups have
 * no backing collection, so members are hand-typed Mongo ObjectIds added one
 * at a time as chips.
 *
 * @param {string} props.groupType
 * @param {string[]} props.value - selected member ids
 * @param {(ids: string[]) => void} props.onChange
 * @param {Array} props.options - [{value, label}], only used for PRODUCT/BRAND/ORDER/USER
 * @param {Array} [props.categories] - raw category docs, only used for CATEGORY
 * @param {boolean} [props.categoryNestingAllowed]
 * @param {boolean} props.loadingOptions
 * @param {string} [props.error]
 */
const MembersPicker = ({
  groupType,
  value = [],
  onChange,
  options = [],
  categories = [],
  categoryNestingAllowed = true,
  loadingOptions = false,
  error = '',
}) => {
  const [customInput, setCustomInput] = useState('');
  const [customError, setCustomError] = useState('');

  if (groupType === 'CATEGORY') {
    return (
      <CategoryMembersPicker
        categories={categories}
        value={value}
        onChange={onChange}
        nestingAllowed={categoryNestingAllowed}
        error={error}
      />
    );
  }

  if (groupType === 'CUSTOM') {
    const addCustomMember = () => {
      const id = customInput.trim();
      if (!id) return;
      if (!HEX24.test(id)) {
        setCustomError('Must be a valid 24-character Mongo ObjectId');
        return;
      }
      if (value.includes(id)) {
        setCustomError('That id is already added');
        return;
      }
      onChange([...value, id]);
      setCustomInput('');
      setCustomError('');
    };

    const removeMember = (id) => onChange(value.filter((memberId) => memberId !== id));

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Members <span className="text-red-500 ml-1">*</span>
        </label>
        <div className="flex gap-2 items-start">
          <div className="flex-1">
            <InputField
              placeholder="Paste a 24-character Mongo ObjectId"
              value={customInput}
              onChange={(e) => {
                setCustomInput(e.target.value);
                setCustomError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomMember();
                }
              }}
              showError={false}
            />
          </div>
          <Button type="button" variant={theme.button.secondary} onClick={addCustomMember}>
            Add
          </Button>
        </div>
        {(customError || error) && (
          <p className="mt-1 text-sm text-red-600" role="alert">
            {customError || error}
          </p>
        )}
        {value.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {value.map((id) => (
              <Badge key={id} variant="gray" onRemove={() => removeMember(id)} removeLabel={`Remove ${id}`}>
                {id}
              </Badge>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Dropdown
      label="Members"
      options={options}
      value={value}
      onChange={(ids) => onChange(ids)}
      multiple
      searchable
      required
      disabled={loadingOptions}
      placeholder={loadingOptions ? 'Loading...' : 'Select members'}
      error={error}
    />
  );
};

export default MembersPicker;
