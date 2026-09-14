import Dropdown from '../../../../components/common/DropDown';
import FileUpload from '../../../../components/common/FileUpload';
import { GIVE_FREE_CASH_TO_CONFIG, GIVE_FREE_CASH_TO_OPTIONS } from '../constants';
import { needsExcelFor } from '../utils/freeCashDraft';
import theme from '../theme/theme';

/**
 * @param {Object} props.draft
 * @param {(patch: Object) => void} props.onChange
 * @param {string[]} props.allowedGiveFreeCashTo - companyMaster.freeCashOptions (empty = all allowed)
 * @param {Array} props.userGroupOptions
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

  const giveFreeCashToOptions =
    allowedGiveFreeCashTo.length > 0
      ? GIVE_FREE_CASH_TO_OPTIONS.filter((opt) => allowedGiveFreeCashTo.includes(opt.value))
      : GIVE_FREE_CASH_TO_OPTIONS;

  const config = GIVE_FREE_CASH_TO_CONFIG[draft.giveFreeCashTo] || {};
  const usesExcel = needsExcelFor(draft.giveFreeCashTo);
  const subCategoryOptions = getSubCategoryOptions(draft.mainCategoryIds);

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
              Currently targeting <strong>{draft.existingTargetCount}</strong> user(s). Re-upload the excel file below to keep or change this -
              saving without a new file will fail.
            </p>
          )}
          <p className={`text-sm ${theme.text.body}`}>
            Upload one <code className="px-1 py-0.5 rounded bg-gray-100">.xlsx</code> file containing a sheet named{' '}
            <code className="px-1 py-0.5 rounded bg-gray-100">Users</code>. Each row needs an{' '}
            <code className="px-1 py-0.5 rounded bg-gray-100">Email</code> column matching an existing active user.
          </p>
          <FileUpload
            label="Excel File (.xlsx)"
            accept=".xlsx"
            onFilesSelected={(files) => set({ excelFile: files[0] || null })}
            helperText={isEdit ? 'Required on every save for this option.' : 'Required for this option.'}
          />
        </div>
      )}

      {config.needsUserGroupIds && (
        <Dropdown
          label="User Group(s)"
          name="userGroupIds"
          options={userGroupOptions}
          value={draft.userGroupIds}
          onChange={(val) => set({ userGroupIds: val })}
          multiple
          searchable
          required
          helperText={userGroupOptions.length === 0 ? 'No USER groups found - create one under Groups first.' : 'Every current member of the selected group(s) becomes eligible.'}
        />
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
            helperText={mainCategoryOptions.length === 0 ? 'No main categories found - create one under Categories first.' : ''}
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
