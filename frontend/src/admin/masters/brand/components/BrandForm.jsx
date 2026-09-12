import Form from '../../../../components/common/Form';
import InputField from '../../../../components/common/InputField';
import Dropdown from '../../../../components/common/DropDown';
import Button from '../../../../components/common/Buttons';
import theme from '../theme/theme';

const STATUS_OPTIONS = [
  { value: 'A', label: 'Active' },
  { value: 'I', label: 'Inactive' },
];

const buildValidationSchema = (mode) => {
  const schema = {
    brandName: {
      required: true,
      validations: [
        (v) => (v.trim().length >= 2 ? true : 'Brand name must be at least 2 characters'),
        (v) => (v.trim().length <= 50 ? true : 'Brand name must not exceed 50 characters'),
      ],
    },
    brandShortName: {
      required: false,
      validations: [
        (v) => (!v || v.trim().length <= 20 ? true : 'Short name must not exceed 20 characters'),
      ],
    },
  };

  if (mode === 'edit') {
    schema.status = { required: true };
  }

  return schema;
};

/**
 * Add/Edit form for a brand. Built on the reusable Form orchestrator
 * (render-prop mode) so field state, touched/blur, and submit-gating come
 * for free.
 *
 * @param {'add'|'edit'} props.mode
 * @param {Object} props.initialValues
 * @param {(values: Object) => Promise<boolean>} props.onSubmit - resolves to whether the save succeeded
 * @param {Function} props.onCancel
 * @param {boolean} props.submitting
 */
const BrandForm = ({ mode = 'add', initialValues = {}, onSubmit, onCancel, submitting = false }) => {
  const validationSchema = buildValidationSchema(mode);

  const formInitialValues = {
    brandName: initialValues.brandName || '',
    brandShortName: initialValues.brandShortName || '',
    status: initialValues.status || 'A',
  };

  const handleFormSubmit = async (values) => {
    const payload = {
      brandName: values.brandName.trim(),
      brandShortName: values.brandShortName?.trim() || null,
    };

    if (mode === 'edit') {
      payload.status = values.status;
    }

    await onSubmit(payload);
  };

  return (
    <Form initialValues={formInitialValues} validationSchema={validationSchema} onSubmit={handleFormSubmit}>
      {({ values, errors, touched, submitAttempted, setFieldValue, handleChange, handleBlur }) => {
        const showError = (name) => (touched[name] || submitAttempted) && errors[name];

        return (
          <>
            <div>
              <InputField
                label="Brand Name"
                name="brandName"
                placeholder="e.g. Nike"
                value={values.brandName}
                onChange={handleChange('brandName')}
                onBlur={handleBlur('brandName')}
                required
                maxLength={50}
                showError={false}
              />
              {showError('brandName') && <p className={`mt-1 text-sm ${theme.text.error}`} role="alert">{errors.brandName}</p>}
            </div>

            <div>
              <InputField
                label="Short Name"
                name="brandShortName"
                placeholder="Optional short name shown in place of the full name"
                value={values.brandShortName}
                onChange={handleChange('brandShortName')}
                onBlur={handleBlur('brandShortName')}
                maxLength={20}
                showError={false}
              />
              {showError('brandShortName') && <p className={`mt-1 text-sm ${theme.text.error}`} role="alert">{errors.brandShortName}</p>}
            </div>

            {mode === 'edit' && (
              <Dropdown
                label="Status"
                name="status"
                options={STATUS_OPTIONS}
                value={values.status}
                onChange={(val) => setFieldValue('status', val)}
                required
                error={showError('status') ? errors.status : ''}
              />
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant={theme.button.ghost} onClick={onCancel} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" variant={theme.button.primary} loading={submitting}>
                {mode === 'edit' ? 'Save Changes' : 'Add Brand'}
              </Button>
            </div>
          </>
        );
      }}
    </Form>
  );
};

export default BrandForm;
