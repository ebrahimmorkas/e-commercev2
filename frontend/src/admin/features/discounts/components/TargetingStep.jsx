import { useState } from 'react';
import Dropdown from '../../../../components/common/DropDown';
import FileUpload from '../../../../components/common/FileUpload';
import Button from '../../../../components/common/Buttons';
import { useToast } from '../../../../components/common/Toast';
import { saveBlob } from '../../../../utils/saveBlob';
import { downloadTargetingSampleFile } from '../api/discountApi';
import { GIVE_DISCOUNT_TO_CONFIG, GIVE_DISCOUNT_TO_OPTIONS } from '../constants';
import { needsExcelFor, requiredExcelSheetsFor, canKeepExistingExcelTargets } from '../utils/discountDraft';
import theme from '../theme/theme';

// Only active groups can be picked (an inactive one never matches a cart); one
// the discount already uses stays listed, marked, so it can be seen and removed.
const toGroupDropdownOptions = (options, selectedIds = []) =>
  options
    .filter((option) => option.isActive !== false || selectedIds.includes(option.value))
    .map((option) => (option.isActive === false ? { ...option, label: `${option.label} (Inactive)` } : option));

/**
 * @param {Object} props.draft
 * @param {(patch: Object) => void} props.onChange
 * @param {string[]} props.allowedGiveDiscountTo - companyMaster.allowedConstantsOfGiveDiscountTo (empty = all allowed)
 * @param {Array} props.productGroupOptions
 * @param {Array} props.categoryGroupOptions
 * @param {Array} props.userGroupOptions
 * @param {boolean} props.isEdit
 */
const TargetingStep = ({
  draft,
  onChange,
  allowedGiveDiscountTo = [],
  productGroupOptions = [],
  categoryGroupOptions = [],
  userGroupOptions = [],
  isEdit = false,
}) => {
  const set = (patch) => onChange({ ...draft, ...patch });
  const toast = useToast();
  const [downloadingSample, setDownloadingSample] = useState(false);

  const giveDiscountToOptions =
    allowedGiveDiscountTo.length > 0
      ? GIVE_DISCOUNT_TO_OPTIONS.filter((opt) => allowedGiveDiscountTo.includes(opt.value))
      : GIVE_DISCOUNT_TO_OPTIONS;

  const config = GIVE_DISCOUNT_TO_CONFIG[draft.giveDiscountTo] || {};
  const requiredSheets = requiredExcelSheetsFor(draft.giveDiscountTo);
  const usesExcel = needsExcelFor(draft.giveDiscountTo);

  // The sample only has the sheet(s) the selected option reads.
  const handleDownloadSample = async () => {
    setDownloadingSample(true);
    try {
      const { blob, filename } = await downloadTargetingSampleFile(draft.giveDiscountTo);
      saveBlob(blob, filename || 'discount-sample.xlsx');
    } catch (err) {
      toast.error(err.message || 'Could not download the sample file');
    } finally {
      setDownloadingSample(false);
    }
  };

  const handleGiveDiscountToChange = (val) => {
    set({
      giveDiscountTo: val,
      excelFile: null,
      productGroupIds: [],
      categoryGroupIds: [],
      userGroupIds: [],
    });
  };

  return (
    <div className="space-y-5">
      <Dropdown
        label="Give Discount To"
        name="giveDiscountTo"
        options={giveDiscountToOptions}
        value={draft.giveDiscountTo}
        onChange={handleGiveDiscountToChange}
        required
        searchable
        helperText={config.description}
      />

      {config.notSupported && (
        <p className={`text-sm rounded-lg border px-4 py-2 ${theme.alert.warning.background} ${theme.alert.warning.border} ${theme.alert.warning.text}`}>
          This option is not supported by the backend yet - choose a different targeting option to continue.
        </p>
      )}

      {usesExcel && (
        <div className="space-y-2">
          {isEdit && draft.existingTargetCounts && (
            <p className={`text-sm ${theme.text.body}`}>
              Currently targeting <strong>{draft.existingTargetCounts.products}</strong> product(s),{' '}
              <strong>{draft.existingTargetCounts.categories}</strong> categor{draft.existingTargetCounts.categories === 1 ? 'y' : 'ies'} and{' '}
              <strong>{draft.existingTargetCounts.users}</strong> user(s).{' '}
              {canKeepExistingExcelTargets(draft)
                ? 'Save without a file to keep these, or upload a new excel file to replace them.'
                : 'Upload an excel file below for the selected option.'}
            </p>
          )}
          <p className={`text-sm ${theme.text.body}`}>
            Upload one <code className="px-1 py-0.5 rounded bg-gray-100">.xlsx</code> file containing a sheet named{' '}
            {requiredSheets.map((sheet, i) => (
              <span key={sheet}>
                {i > 0 && ' and '}
                <code className="px-1 py-0.5 rounded bg-gray-100">{sheet}</code>
              </span>
            ))}
            . Each row needs a {requiredSheets.includes('Products') && <code className="px-1 py-0.5 rounded bg-gray-100">Product Name</code>}
            {requiredSheets.includes('Products') && requiredSheets.length > 1 && ', '}
            {requiredSheets.includes('Categories') && <code className="px-1 py-0.5 rounded bg-gray-100">Category Name</code>}
            {requiredSheets.includes('Categories') && requiredSheets.includes('Users') && ' and '}
            {requiredSheets.includes('Users') && <code className="px-1 py-0.5 rounded bg-gray-100">Email</code>} column matching an existing
            active record.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant={theme.button.secondary} size="sm" onClick={handleDownloadSample} loading={downloadingSample}>
              Download sample file
            </Button>
            <span className={`text-xs ${theme.text.muted}`}>
              One .xlsx with the {requiredSheets.join(' and ')} sheet{requiredSheets.length > 1 ? 's' : ''} ready to fill in.
            </span>
          </div>
          <FileUpload
            label="Excel File (.xlsx)"
            accept=".xlsx"
            onFilesSelected={(files) => set({ excelFile: files[0] || null })}
            helperText={isEdit && canKeepExistingExcelTargets(draft) ? 'Optional - only needed to change the current list.' : 'Required for this option.'}
          />
        </div>
      )}

      {config.needsProductGroupIds && (
        <Dropdown
          label="Product Group(s)"
          name="productGroupIds"
          options={toGroupDropdownOptions(productGroupOptions, draft.productGroupIds)}
          value={draft.productGroupIds}
          onChange={(val) => set({ productGroupIds: val })}
          multiple
          searchable
          required
          helperText={!productGroupOptions.some((g) => g.isActive !== false) ? 'No active PRODUCT groups found - create or activate one under Groups first.' : ''}
        />
      )}

      {config.needsCategoryGroupIds && (
        <Dropdown
          label="Category Group(s)"
          name="categoryGroupIds"
          options={toGroupDropdownOptions(categoryGroupOptions, draft.categoryGroupIds)}
          value={draft.categoryGroupIds}
          onChange={(val) => set({ categoryGroupIds: val })}
          multiple
          searchable
          required
          helperText={!categoryGroupOptions.some((g) => g.isActive !== false) ? 'No active CATEGORY groups found - create or activate one under Groups first.' : ''}
        />
      )}

      {config.needsUserGroupIds && (
        <Dropdown
          label="User Group(s)"
          name="userGroupIds"
          options={toGroupDropdownOptions(userGroupOptions, draft.userGroupIds)}
          value={draft.userGroupIds}
          onChange={(val) => set({ userGroupIds: val })}
          multiple
          searchable
          required
          helperText={!userGroupOptions.some((g) => g.isActive !== false) ? 'No active USER groups found - create or activate one under Groups first.' : ''}
        />
      )}
    </div>
  );
};

export default TargetingStep;
