import Form from '../../../../components/common/Form';
import InputField from '../../../../components/common/InputField';
import Dropdown from '../../../../components/common/DropDown';
import Button from '../../../../components/common/Buttons';
import theme from '../theme/theme';

const STATUS_OPTIONS = [
  { value: 'A', label: 'Active' },
  { value: 'I', label: 'Inactive' },
];

// Mirrors backend courierMasterValidations (trimmed, 2-100 characters).
const buildValidationSchema = (mode) => {
  const schema = {
    courierName: {
      required: true,
      validations: [
        (v) => (v.trim().length >= 2 ? true : 'Courier name must be at least 2 characters'),
        (v) => (v.trim().length <= 100 ? true : 'Courier name must not exceed 100 characters'),
      ],
    },
  };

  if (mode === 'edit') {
    schema.status = { required: true };
  }

  return schema;
};

/**
 * Add/Edit form for a courier. Built on the reusable Form orchestrator
 * (render-prop mode).
 *
 * @param {'add'|'edit'} props.mode
 * @param {Object} props.initialValues
 * @param {(values: Object) => Promise<void>} props.onSubmit
 * @param {Function} props.onCancel
 * @param {boolean} props.submitting
 */
const CourierForm = ({ mode = 'add', initialValues = {}, onSubmit, onCancel, submitting = false }) => {
  const validationSchema = buildValidationSchema(mode);

  const formInitialValues = {
    courierName: initialValues.courierName || '',
    status: initialValues.status || 'A',
  };

  const handleFormSubmit = async (values) => {
    const payload = { courierName: values.courierName.trim() };
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
                label="Courier Name"
                name="courierName"
                placeholder="e.g. Blue Dart"
                value={values.courierName}
                onChange={handleChange('courierName')}
                onBlur={handleBlur('courierName')}
                required
                maxLength={100}
                showError={false}
              />
              {showError('courierName') && (
                <p className={`mt-1 text-sm ${theme.text.error}`} role="alert">{errors.courierName}</p>
              )}
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
                {mode === 'edit' ? 'Save Changes' : 'Save'}
              </Button>
            </div>
          </>
        );
      }}
    </Form>
  );
};

export default CourierForm;
