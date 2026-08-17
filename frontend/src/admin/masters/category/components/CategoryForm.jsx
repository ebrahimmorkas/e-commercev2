import { useMemo } from 'react';
import Form from '../../../../components/common/Form';
import InputField from '../../../../components/common/InputField';
import Dropdown from '../../../../components/common/DropDown';
import FileUpload from '../../../../components/common/FileUpload';
import Avatar from '../../../../components/common/Avatar';
import Button from '../../../../components/common/Buttons';
import { flattenToTree, getDescendantIds } from '../utils/categoryTree';
import theme from '../theme/theme';

const STATUS_OPTIONS = [
  { value: 'A', label: 'Active' },
  { value: 'I', label: 'Inactive' },
];

const NO_PARENT_VALUE = '';

/**
 * Builds the parent-category dropdown options: active categories only
 * (the backend rejects attaching under a non-active parent), excluding the
 * category being edited and any of its own descendants (would create a
 * cycle). Indented by depth so the hierarchy is visible while picking.
 */
const buildParentOptions = (allCategories, editingCategoryId) => {
  const excluded = new Set();
  if (editingCategoryId) {
    excluded.add(String(editingCategoryId));
    getDescendantIds(allCategories, editingCategoryId).forEach((id) => excluded.add(id));
  }

  const tree = flattenToTree(allCategories);
  const options = tree
    .filter((category) => category.status === 'A' && !excluded.has(String(category._id)))
    .map((category) => ({
      value: String(category._id),
      label: `${'— '.repeat(category.depth)}${category.categoryName}`,
    }));

  return [{ value: NO_PARENT_VALUE, label: 'None (top-level category)' }, ...options];
};

/**
 * Add/Edit form for a category. Built on the reusable Form orchestrator
 * (render-prop mode, since Dropdown/FileUpload aren't config-driven field
 * types) so field state, touched/blur, and submit-gating come for free.
 *
 * @param {'add'|'edit'} props.mode
 * @param {Object} props.initialValues - category document when editing
 * @param {Array} props.allCategories - full flat admin category list, for the parent picker
 * @param {(fields: Object, imageFile: File|null) => Promise<boolean>} props.onSubmit
 * @param {Function} props.onCancel
 * @param {boolean} props.submitting
 */
const CategoryForm = ({ mode = 'add', initialValues = {}, allCategories = [], onSubmit, onCancel, submitting = false }) => {
  const parentOptions = useMemo(
    () => buildParentOptions(allCategories, mode === 'edit' ? initialValues._id : null),
    [allCategories, mode, initialValues._id]
  );

  const validationSchema = {
    categoryName: {
      required: true,
      validations: [
        (v) => (v.trim().length >= 1 ? true : 'Category name is required'),
        (v) => (v.trim().length <= 100 ? true : 'Category name must not exceed 100 characters'),
      ],
    },
    parent_category_id: {},
    status: { required: true },
  };

  const formInitialValues = {
    categoryName: initialValues.categoryName || '',
    parent_category_id: initialValues.parent_category_id ? String(initialValues.parent_category_id) : NO_PARENT_VALUE,
    status: initialValues.status || 'A',
    image: null,
  };

  const handleFormSubmit = async (values) => {
    const fields = {
      categoryName: values.categoryName.trim(),
      parent_category_id: values.parent_category_id || '',
      status: values.status,
    };
    await onSubmit(fields, values.image || null);
  };

  return (
    <Form initialValues={formInitialValues} validationSchema={validationSchema} onSubmit={handleFormSubmit}>
      {({ values, errors, touched, submitAttempted, setFieldValue, handleChange, handleBlur }) => {
        const showError = (name) => (touched[name] || submitAttempted) && errors[name];

        return (
          <>
            <div>
              <InputField
                label="Category Name"
                name="categoryName"
                placeholder="e.g. Shirts"
                value={values.categoryName}
                onChange={handleChange('categoryName')}
                onBlur={handleBlur('categoryName')}
                required
                maxLength={100}
                showError={false}
              />
              {showError('categoryName') && (
                <p className={`mt-1 text-sm ${theme.text.error}`} role="alert">{errors.categoryName}</p>
              )}
            </div>

            <Dropdown
              label="Parent Category"
              name="parent_category_id"
              placeholder="None (top-level category)"
              options={parentOptions}
              value={values.parent_category_id}
              onChange={(val) => setFieldValue('parent_category_id', val)}
              searchable
              clearable
              helperText="Leave empty to create a top-level category."
            />

            <Dropdown
              label="Status"
              name="status"
              options={STATUS_OPTIONS}
              value={values.status}
              onChange={(val) => setFieldValue('status', val)}
              required
              error={showError('status') ? errors.status : ''}
            />

            <div>
              {initialValues.image?.url && (
                <div className="flex items-center gap-3 mb-2">
                  <Avatar src={initialValues.image.url} name={values.categoryName} shape="square" size="lg" />
                  <p className={`text-sm ${theme.text.muted}`}>Current image - upload a new one to replace it.</p>
                </div>
              )}
              <FileUpload
                label={initialValues.image?.url ? 'Replace Image' : 'Category Image'}
                accept="image/*"
                maxSize={5 * 1024 * 1024}
                onFilesSelected={(files) => setFieldValue('image', files[0] || null)}
                helperText="JPG, JPEG, PNG or GIF, up to 5MB. Optional."
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant={theme.button.ghost} onClick={onCancel} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" variant={theme.button.primary} loading={submitting}>
                {mode === 'edit' ? 'Save Changes' : 'Add Category'}
              </Button>
            </div>
          </>
        );
      }}
    </Form>
  );
};

export default CategoryForm;
