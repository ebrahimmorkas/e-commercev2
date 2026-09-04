import Dropdown from '../../../../components/common/DropDown';
import FileUpload from '../../../../components/common/FileUpload';
import { GIVE_DISCOUNT_TO_CONFIG, GIVE_DISCOUNT_TO_OPTIONS } from '../constants';
import { needsExcelFor, requiredExcelSheetsFor } from '../utils/discountDraft';
import theme from '../theme/theme';

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

  const giveDiscountToOptions =
    allowedGiveDiscountTo.length > 0
      ? GIVE_DISCOUNT_TO_OPTIONS.filter((opt) => allowedGiveDiscountTo.includes(opt.value))
      : GIVE_DISCOUNT_TO_OPTIONS;

  const config = GIVE_DISCOUNT_TO_CONFIG[draft.giveDiscountTo] || {};
  const requiredSheets = requiredExcelSheetsFor(draft.giveDiscountTo);
  const usesExcel = needsExcelFor(draft.giveDiscountTo);

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
              <strong>{draft.existingTargetCounts.users}</strong> user(s). Re-upload the excel file below to keep or change this - saving
              without a new file will fail.
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
          <FileUpload
            label="Excel File (.xlsx)"
            accept=".xlsx"
            onFilesSelected={(files) => set({ excelFile: files[0] || null })}
            helperText={isEdit ? 'Required on every save for this option.' : 'Required for this option.'}
          />
          <p className={`text-sm rounded-lg border px-4 py-2 ${theme.alert.warning.background} ${theme.alert.warning.border} ${theme.alert.warning.text}`}>
            Because this option uploads a file, the server receives this whole form as multipart data instead of JSON - toggle-based settings
            elsewhere in this form (Ongoing / Minimum Quantity / Coupon Code, Specific Days &amp; Hours, Payment Methods, Auto-apply, etc.) are
            not reliably applied together with an excel upload in the current backend. Prefer a Product/Category/User Group targeting option
            if you need those together.
          </p>
        </div>
      )}

      {config.needsProductGroupIds && (
        <Dropdown
          label="Product Group(s)"
          name="productGroupIds"
          options={productGroupOptions}
          value={draft.productGroupIds}
          onChange={(val) => set({ productGroupIds: val })}
          multiple
          searchable
          required
          helperText={productGroupOptions.length === 0 ? 'No PRODUCT groups found - create one under Groups first.' : ''}
        />
      )}

      {config.needsCategoryGroupIds && (
        <Dropdown
          label="Category Group(s)"
          name="categoryGroupIds"
          options={categoryGroupOptions}
          value={draft.categoryGroupIds}
          onChange={(val) => set({ categoryGroupIds: val })}
          multiple
          searchable
          required
          helperText={categoryGroupOptions.length === 0 ? 'No CATEGORY groups found - create one under Groups first.' : ''}
        />
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
          helperText={userGroupOptions.length === 0 ? 'No USER groups found - create one under Groups first.' : ''}
        />
      )}
    </div>
  );
};

export default TargetingStep;
