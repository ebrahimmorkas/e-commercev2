import { useState } from 'react';
import Form from '../../../../components/common/Form';
import InputField from '../../../../components/common/InputField';
import TextArea from '../../../../components/common/TextArea';
import Dropdown from '../../../../components/common/DropDown';
import Button from '../../../../components/common/Buttons';
import Switch from '../../../../components/common/Switch';
import FileUpload from '../../../../components/common/FileUpload';
import MembersPicker from './MembersPicker';
import { useGroupFormLookups } from '../hooks/useGroupFormLookups';
import theme from '../theme/theme';

const GROUP_TYPE_OPTIONS = [
  { value: 'PRODUCT', label: 'Product' },
  { value: 'CATEGORY', label: 'Category' },
  { value: 'USER', label: 'User' },
  { value: 'BRAND', label: 'Brand' },
  { value: 'ORDER', label: 'Order' },
  { value: 'CUSTOM', label: 'Custom' },
];

// groupTypes that can resolve their members from an uploaded excel file
// instead of the manual picker - mirrors backend/constants/groupConstants.js.
const EXCEL_UPLOAD_GROUP_TYPES = ['PRODUCT', 'CATEGORY', 'USER'];

const EXCEL_SHEET_INFO = {
  PRODUCT: { sheet: 'Products', column: 'Product Name' },
  CATEGORY: { sheet: 'Categories', column: 'Category Name' },
  USER: { sheet: 'Users', column: 'Email' },
};

const buildValidationSchema = (maxMembers, pickerMode) => ({
  groupType: { required: true },
  groupName: {
    required: true,
    validations: [
      (v) => (v.trim().length >= 2 ? true : 'Group name must be at least 2 characters'),
      (v) => (v.trim().length <= 120 ? true : 'Group name must not exceed 120 characters'),
    ],
  },
  members: {
    required: pickerMode !== 'excel',
    validations:
      pickerMode === 'excel'
        ? []
        : [
            (v) => (Array.isArray(v) && v.length > 0 ? true : 'At least one member is required'),
            (v) => (!maxMembers || v.length <= maxMembers ? true : `A group can have at most ${maxMembers} members`),
          ],
  },
  slug: {
    validations: [(v) => (!v || v.trim().length <= 160 ? true : 'Slug must not exceed 160 characters')],
  },
  description: {
    validations: [(v) => (!v || v.length <= 500 ? true : 'Description must not exceed 500 characters')],
  },
  precedence: {
    validations: [
      (v) =>
        v === '' || v === undefined || v === null || (Number.isInteger(Number(v)) && Number(v) >= 0)
          ? true
          : 'Precedence must be a non-negative whole number',
    ],
  },
  remarks: {
    validations: [(v) => (!v || v.length <= 500 ? true : 'Remarks must not exceed 500 characters')],
  },
});

/**
 * Add/Edit form for a group. Built on the reusable Form orchestrator
 * (render-prop mode). The members picker's option source depends on the
 * live groupType value, which Form keeps in its own internal state - hooks
 * can't be called from inside Form's render-prop callback, so groupType is
 * mirrored into local state here and useGroupFormLookups is called at the
 * top level like any other hook.
 *
 * @param {'add'|'edit'} props.mode
 * @param {Object} props.initialValues
 * @param {(values: Object) => Promise<boolean>} props.onSubmit - resolves to whether the save succeeded
 * @param {Function} props.onCancel
 * @param {boolean} props.submitting
 */
const GroupForm = ({ mode = 'add', initialValues = {}, onSubmit, onCancel, submitting = false }) => {
  const [selectedGroupType, setSelectedGroupType] = useState(initialValues.groupType || '');
  const { companyMaster, memberOptions, categories, loadingMembers, membersError } = useGroupFormLookups(selectedGroupType);
  const categoryNestingAllowed = companyMaster?.isNestingCategoryAllowedInGroup === true;

  // 'list' = manual picker (MembersPicker), 'excel' = upload a file and let
  // the server resolve members from its rows. Always starts on 'list', even
  // when editing a group that was originally created via excel - re-editing
  // shows the current members and only switches to 'excel' if the vendor
  // explicitly wants to re-upload.
  const [pickerMode, setPickerMode] = useState('list');
  const [excelFile, setExcelFile] = useState(null);
  const [excelFileError, setExcelFileError] = useState('');

  const maxMembers = companyMaster?.numberOfMembersPerGroup;
  const validationSchema = buildValidationSchema(maxMembers, pickerMode);

  const allowedGroupTypes = companyMaster?.allowedGroupTypes;
  const groupTypeOptions =
    Array.isArray(allowedGroupTypes) && allowedGroupTypes.length > 0
      ? GROUP_TYPE_OPTIONS.filter((opt) => allowedGroupTypes.includes(opt.value))
      : GROUP_TYPE_OPTIONS;

  const supportsExcel = EXCEL_UPLOAD_GROUP_TYPES.includes(selectedGroupType);
  const excelUploadEnabled = supportsExcel && companyMaster?.isExcelUploadAllowedForGroups === true;

  const formInitialValues = {
    groupType: initialValues.groupType || '',
    groupName: initialValues.groupName || '',
    members: initialValues.members || [],
    slug: initialValues.slug || '',
    description: initialValues.description || '',
    precedence: initialValues.precedence ?? '',
    remarks: initialValues.remarks || '',
  };

  const handleFormSubmit = async (values) => {
    if (pickerMode === 'excel' && !excelFile) {
      setExcelFileError('An excel file is required for this mode.');
      return;
    }

    const payload = {
      groupType: values.groupType,
      groupName: values.groupName.trim(),
      members: pickerMode === 'excel' ? undefined : values.members,
      slug: values.slug?.trim() ? values.slug.trim().toLowerCase() : undefined,
      description: values.description?.trim() || '',
      precedence: values.precedence === '' ? undefined : Number(values.precedence),
      remarks: values.remarks?.trim() || '',
    };
    await onSubmit(payload, pickerMode === 'excel' ? excelFile : undefined);
  };

  return (
    <Form initialValues={formInitialValues} validationSchema={validationSchema} onSubmit={handleFormSubmit}>
      {({ values, errors, touched, submitAttempted, setFieldValue, handleChange, handleBlur }) => {
        const showError = (name) => (touched[name] || submitAttempted) && errors[name];

        return (
          <>
            <Dropdown
              label="Group Type"
              name="groupType"
              options={groupTypeOptions}
              value={values.groupType}
              onChange={(val) => {
                setFieldValue('groupType', val);
                setFieldValue('members', []);
                setSelectedGroupType(val);
                setPickerMode('list');
                setExcelFile(null);
                setExcelFileError('');
              }}
              required
              error={showError('groupType') ? errors.groupType : ''}
              helperText="Changing the type clears the currently selected members"
            />

            <div>
              <InputField
                label="Group Name"
                name="groupName"
                placeholder="e.g. Summer Sale Products"
                value={values.groupName}
                onChange={handleChange('groupName')}
                onBlur={handleBlur('groupName')}
                required
                maxLength={120}
                showError={false}
              />
              {showError('groupName') && (
                <p className={`mt-1 text-sm ${theme.text.error}`} role="alert">
                  {errors.groupName}
                </p>
              )}
            </div>

            {values.groupType && excelUploadEnabled && (
              <Switch
                label="Upload members from an excel file"
                description="Off: pick members from the list below. On: resolve members from an uploaded .xlsx file instead."
                checked={pickerMode === 'excel'}
                onChange={(e) => {
                  setPickerMode(e.target.checked ? 'excel' : 'list');
                  setExcelFile(null);
                  setExcelFileError('');
                }}
                color={theme.switch.color}
              />
            )}

            {values.groupType && pickerMode === 'list' && (
              <MembersPicker
                groupType={values.groupType}
                value={values.members}
                onChange={(ids) => setFieldValue('members', ids)}
                options={memberOptions}
                categories={categories}
                categoryNestingAllowed={categoryNestingAllowed}
                loadingOptions={loadingMembers}
                error={showError('members') ? errors.members : membersError}
              />
            )}

            {values.groupType && pickerMode === 'excel' && excelUploadEnabled && (
              <div>
                <p className={`text-sm mb-2 ${theme.text.body}`}>
                  Upload one <code className="px-1 py-0.5 rounded bg-gray-100">.xlsx</code> file containing a sheet
                  named <code className="px-1 py-0.5 rounded bg-gray-100">{EXCEL_SHEET_INFO[values.groupType].sheet}</code>{' '}
                  with a <code className="px-1 py-0.5 rounded bg-gray-100">{EXCEL_SHEET_INFO[values.groupType].column}</code>{' '}
                  column. Each row must match an existing active record for this vendor.
                  {values.groupType === 'CATEGORY' && categoryNestingAllowed && (
                    <>
                      {' '}
                      An optional <code className="px-1 py-0.5 rounded bg-gray-100">Sub Category</code> column can drill
                      further down - chain nested levels with{' '}
                      <code className="px-1 py-0.5 rounded bg-gray-100">{'>'}</code>, e.g.{' '}
                      <code className="px-1 py-0.5 rounded bg-gray-100">Mathematics{'>'}Algebra</code>.
                    </>
                  )}
                </p>
                <FileUpload
                  label="Excel File (.xlsx)"
                  accept=".xlsx"
                  onFilesSelected={(files) => {
                    setExcelFile(files[0] || null);
                    if (files[0]) setExcelFileError('');
                  }}
                  error={excelFileError}
                  helperText={mode === 'edit' ? 'Required in this mode on every save.' : 'Required in this mode.'}
                />
              </div>
            )}

            <div>
              <InputField
                label="Slug"
                name="slug"
                placeholder="Optional - leave blank for none"
                value={values.slug}
                onChange={handleChange('slug')}
                onBlur={handleBlur('slug')}
                maxLength={160}
                showError={false}
              />
              {showError('slug') && (
                <p className={`mt-1 text-sm ${theme.text.error}`} role="alert">
                  {errors.slug}
                </p>
              )}
            </div>

            <div>
              <TextArea
                label="Description"
                name="description"
                placeholder="Optional description shown to other admins"
                value={values.description}
                onChange={handleChange('description')}
                onBlur={handleBlur('description')}
                maxLength={500}
                rows={3}
                showError={false}
              />
              {showError('description') && (
                <p className={`mt-1 text-sm ${theme.text.error}`} role="alert">
                  {errors.description}
                </p>
              )}
            </div>

            <div>
              <InputField
                label="Precedence"
                name="precedence"
                type="number"
                min={0}
                placeholder="Lower numbers are listed first"
                value={values.precedence}
                onChange={handleChange('precedence')}
                onBlur={handleBlur('precedence')}
                showError={false}
              />
              {showError('precedence') && (
                <p className={`mt-1 text-sm ${theme.text.error}`} role="alert">
                  {errors.precedence}
                </p>
              )}
            </div>

            <div>
              <TextArea
                label="Remarks"
                name="remarks"
                placeholder="Optional internal notes"
                value={values.remarks}
                onChange={handleChange('remarks')}
                onBlur={handleBlur('remarks')}
                maxLength={500}
                rows={2}
                showError={false}
              />
              {showError('remarks') && (
                <p className={`mt-1 text-sm ${theme.text.error}`} role="alert">
                  {errors.remarks}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant={theme.button.ghost} onClick={onCancel} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" variant={theme.button.primary} loading={submitting}>
                {mode === 'edit' ? 'Save Changes' : 'Add Group'}
              </Button>
            </div>
          </>
        );
      }}
    </Form>
  );
};

export default GroupForm;
