import { useState } from 'react';
import Dropdown from '../../../../components/common/DropDown';
import FileUpload from '../../../../components/common/FileUpload';
import Button from '../../../../components/common/Buttons';
import { useToast } from '../../../../components/common/Toast';
import { saveBlob } from '../../../../utils/saveBlob';
import { GIVE_FREE_CASH_TO_CONFIG, GIVE_FREE_CASH_TO_OPTIONS } from '../constants';
import { needsExcelFor, canKeepExistingUsers } from '../utils/freeCashDraft';
import { downloadUsersSampleFile } from '../api/freeCashApi';
import theme from '../theme/theme';

// Only active groups can be picked (an inactive one gives nobody Free Cash);
// one the campaign already uses stays listed, marked, so it can be removed.
const toGroupDropdownOptions = (options, selectedIds = []) =>
  options
    .filter((option) => option.isActive !== false || selectedIds.includes(option.value))
    .map((option) => (option.isActive === false ? { ...option, label: `${option.label} (Inactive)` } : option));

/**
 * @param {Object} props.draft
 * @param {(patch: Object) => void} props.onChange
 * @param {string[]} props.allowedGiveFreeCashTo - companyMaster.freeCashOptions (empty = all allowed)
 * @param {Array} props.userGroupOptions - [{ value, label, isActive }]
 * @param {Array} props.mainCategoryOptions
 * @param {(mainCategoryIds: string[]) => Array} props.getSubCategoryOptions
 * @param {boolean} props.isEdit
 */
const TargetingStep = ({
  draft,
  onChange,
  allowedGiveFreeCashTo = [],
  userGroupOptions = [],
  mainCategoryOptions = [],
  getSubCategoryOptions,
  isEdit = false,
}) => {
  const set = (patch) => onChange({ ...draft, ...patch });
  const toast = useToast();
  const [downloadingSample, setDownloadingSample] = useState(false);

  const giveFreeCashToOptions =
    allowedGiveFreeCashTo.length > 0
      ? GIVE_FREE_CASH_TO_OPTIONS.filter((opt) => allowedGiveFreeCashTo.includes(opt.value))
      : GIVE_FREE_CASH_TO_OPTIONS;

  const config = GIVE_FREE_CASH_TO_CONFIG[draft.giveFreeCashTo] || {};
  const usesExcel = needsExcelFor(draft.giveFreeCashTo);
  const subCategoryOptions = getSubCategoryOptions(draft.mainCategoryIds);
  const keepsExistingUsers = isEdit && canKeepExistingUsers(draft);
  const isUserTargeted = draft.giveFreeCashTo === 'SPECIFIC_USERS' || draft.giveFreeCashTo === 'GROUPS';

  const handleGiveFreeCashToChange = (val) => {
    set({
      giveFreeCashTo: val,
      excelFile: null,
      userGroupIds: [],
      mainCategoryIds: [],
      subCategoryIds: [],
    });
  };

  const handleMainCategoryChange = (val) => {
    // Dropping a main category also drops any sub-category selections that
    // belonged only to it, since subCategoryIds must stay a subset of what
    // getSubCategoryOptions(mainCategoryIds) currently offers.
    const nextValidSubIds = new Set(getSubCategoryOptions(val).map((o) => o.value));
    set({
      mainCategoryIds: val,
      subCategoryIds: draft.subCategoryIds.filter((id) => nextValidSubIds.has(id)),
    });
  };

  const handleDownloadSample = async () => {
    setDownloadingSample(true);
    try {
      const { blob, filename } = await downloadUsersSampleFile();
      saveBlob(blob, filename || 'free-cash-sample-users.xlsx');
    } catch (err) {
      toast.error(err.message || 'Could not download the sample file');
    } finally {
      setDownloadingSample(false);
    }
  };

  return (
    <div className="space-y-5">
      <Dropdown
        label="Give Free Cash To"
        name="giveFreeCashTo"
        options={giveFreeCashToOptions}
        value={draft.giveFreeCashTo}
        onChange={handleGiveFreeCashToChange}
        required
        searchable
        helperText={config.description}
      />

      {usesExcel && (
        <div className="space-y-2">
          {isEdit && draft.existingTargetCount !== null && (
            <p className={`text-sm ${theme.text.body}`}>
              Currently given to <strong>{draft.existingTargetCount}</strong> customer(s).{' '}
              {keepsExistingUsers
                ? 'Save without a file to keep them, or upload a new file to replace the list.'
                : 'Upload an excel file below for the selected option.'}
            </p>
          )}
          <p className={`text-sm ${theme.text.body}`}>
            Upload one <code className="px-1 py-0.5 rounded bg-gray-100">.xlsx</code> file with a sheet named{' '}
            <code className="px-1 py-0.5 rounded bg-gray-100">Users</code> and one customer{' '}
            <code className="px-1 py-0.5 rounded bg-gray-100">Email</code> per row (active customers of your store only).
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant={theme.button.secondary} size="sm" onClick={handleDownloadSample} loading={downloadingSample}>
              Download sample file
            </Button>
            <span className={`text-xs ${theme.text.muted}`}>A .xlsx with the Users sheet ready to fill in.</span>
          </div>
          <FileUpload
            label="Excel File (.xlsx)"
            accept=".xlsx"
            onFilesSelected={(files) => set({ excelFile: files[0] || null })}
            helperText={keepsExistingUsers ? 'Optional - only needed to change the current list.' : 'Required for this option.'}
          />
        </div>
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
          helperText={
            !userGroupOptions.some((g) => g.isActive !== false)
              ? 'No active USER groups found - create or activate one under Groups first.'
              : 'Every active customer in the selected group(s) gets it - including anyone who joins a group later.'
          }
        />
      )}

      {isEdit && isUserTargeted && (
        <p className={`text-xs rounded-lg border px-3 py-2 ${theme.alert.warning.background} ${theme.alert.warning.border} ${theme.alert.warning.text}`}>
          Changing who gets it: customers newly added get this Free Cash when you save; customers no longer included lose any balance they
          haven&apos;t used yet (amounts already used are not affected).
        </p>
      )}

      {config.needsMainCategoryIds && (
        <>
          <Dropdown
            label="Main Category/Categories"
            name="mainCategoryIds"
            options={mainCategoryOptions}
            value={draft.mainCategoryIds}
            onChange={handleMainCategoryChange}
            multiple
            searchable
            required
            helperText={mainCategoryOptions.length === 0 ? 'No active main categories found - create one under Categories first.' : ''}
          />

          {config.needsSubCategoryIds && draft.mainCategoryIds.length > 0 && (
            <Dropdown
              label="Sub Category/Categories"
              name="subCategoryIds"
              options={subCategoryOptions}
              value={draft.subCategoryIds}
              onChange={(val) => set({ subCategoryIds: val })}
              multiple
              searchable
              helperText={
                subCategoryOptions.length === 0
                  ? 'The selected main category/categories have no sub-categories - eligible for the whole main category.'
                  : 'Leave empty to allow the whole selected main category/categories instead of specific sub-categories.'
              }
            />
          )}
        </>
      )}
    </div>
  );
};

export default TargetingStep;
