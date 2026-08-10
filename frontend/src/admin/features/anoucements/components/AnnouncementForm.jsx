import Form from '../../../../components/common/Form';
import InputField from '../../../../components/common/InputField';
import TextArea from '../../../../components/common/TextArea';
import DatePicker from '../../../../components/common/DatePicker';
import Dropdown from '../../../../components/common/DropDown';
import Checkbox from '../../../../components/common/Checkbox';
import Button from '../../../../components/common/Buttons';
import { useToast } from '../../../../components/common/Toast';
import theme from '../theme/theme';

const STATUS_OPTIONS = [
  { value: 'A', label: 'Active' },
  { value: 'I', label: 'Inactive' },
];

const toDateOrNull = (value) => (value ? new Date(value) : null);

// Local YYYY-MM-DD, avoiding the UTC-shift toISOString() would introduce for a local-midnight Date
const toDateString = (date) => {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const buildValidationSchema = (mode) => {
  const schema = {
    name: {
      required: true,
      validations: [
        (v) => (v.trim().length >= 2 ? true : 'Name must be at least 2 characters'),
        (v) => (v.trim().length <= 20 ? true : 'Name must not exceed 20 characters'),
      ],
    },
    heading: {
      required: false,
      validations: [
        (v) => (!v || v.trim().length >= 2 ? true : 'Heading must be at least 2 characters'),
        (v) => (!v || v.trim().length <= 20 ? true : 'Heading must not exceed 20 characters'),
      ],
    },
    content: {
      required: true,
      validations: [
        (v) => (v.trim().length >= 2 ? true : 'Content must be at least 2 characters'),
        (v) => (v.trim().length <= 200 ? true : 'Content must not exceed 200 characters'),
      ],
    },
    startDate: { required: true },
    endDate: { required: true },
    precedence: {
      required: false,
      validations: [
        (v) => (!v || (Number.isInteger(Number(v)) && Number(v) >= 1) ? true : 'Precedence must be a positive whole number'),
      ],
    },
  };

  if (mode === 'edit') {
    schema.status = { required: true };
  }

  return schema;
};

/**
 * Add/Edit form for an announcement. Built on the reusable Form orchestrator
 * (render-prop mode, since DatePicker/Dropdown aren't config-driven field
 * types) so field state, touched/blur, and submit-gating come for free.
 *
 * @param {'add'|'edit'} props.mode
 * @param {Object} props.initialValues
 * @param {(values: Object) => Promise<boolean>} props.onSubmit - resolves to whether the save succeeded
 * @param {Function} props.onCancel
 * @param {boolean} props.submitting
 */
const AnnouncementForm = ({ mode = 'add', initialValues = {}, onSubmit, onCancel, submitting = false }) => {
  const toast = useToast();
  const validationSchema = buildValidationSchema(mode);

  const formInitialValues = {
    name: initialValues.name || '',
    heading: initialValues.heading || '',
    content: initialValues.content || '',
    startDate: toDateOrNull(initialValues.startDate),
    endDate: toDateOrNull(initialValues.endDate),
    precedence: initialValues.precedence ?? '',
    status: initialValues.status || 'A',
    isDefault: !!initialValues.isDefault,
  };

  const handleFormSubmit = async (values) => {
    if (values.startDate && values.endDate && new Date(values.endDate) <= new Date(values.startDate)) {
      toast.error('End date must be after the start date');
      return;
    }

    const payload = {
      name: values.name.trim(),
      heading: values.heading?.trim() || undefined,
      content: values.content.trim(),
      startDate: toDateString(values.startDate),
      endDate: toDateString(values.endDate),
    };

    if (values.precedence !== '' && values.precedence !== undefined && values.precedence !== null) {
      payload.precedence = Number(values.precedence);
    }

    if (mode === 'edit') {
      payload.status = values.status;
      if (values.isDefault) payload.isDefault = true;
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
                label="Name"
                name="name"
                placeholder="e.g. Summer Sale"
                value={values.name}
                onChange={handleChange('name')}
                onBlur={handleBlur('name')}
                required
                maxLength={20}
                showError={false}
              />
              {showError('name') && <p className={`mt-1 text-sm ${theme.text.error}`} role="alert">{errors.name}</p>}
            </div>

            <div>
              <InputField
                label="Heading"
                name="heading"
                placeholder="Optional short heading"
                value={values.heading}
                onChange={handleChange('heading')}
                onBlur={handleBlur('heading')}
                maxLength={20}
                showError={false}
              />
              {showError('heading') && <p className={`mt-1 text-sm ${theme.text.error}`} role="alert">{errors.heading}</p>}
            </div>

            <div>
              <TextArea
                label="Content"
                name="content"
                placeholder="Announcement message shown to customers"
                value={values.content}
                onChange={handleChange('content')}
                onBlur={handleBlur('content')}
                required
                rows={3}
                maxLength={200}
                showCharCount
                showError={false}
              />
              {showError('content') && <p className={`mt-1 text-sm ${theme.text.error}`} role="alert">{errors.content}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DatePicker
                label="Start Date"
                name="startDate"
                value={values.startDate}
                onChange={(date) => setFieldValue('startDate', date)}
                required
                error={showError('startDate') ? errors.startDate : ''}
              />
              <DatePicker
                label="End Date"
                name="endDate"
                value={values.endDate}
                onChange={(date) => setFieldValue('endDate', date)}
                minDate={values.startDate || undefined}
                required
                error={showError('endDate') ? errors.endDate : ''}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <InputField
                  type="number"
                  label="Precedence"
                  name="precedence"
                  placeholder="Display order (auto if left blank)"
                  value={values.precedence}
                  onChange={handleChange('precedence')}
                  onBlur={handleBlur('precedence')}
                  min={1}
                  showError={false}
                />
                {showError('precedence') && <p className={`mt-1 text-sm ${theme.text.error}`} role="alert">{errors.precedence}</p>}
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
            </div>

            {mode === 'edit' && !initialValues.isDefault && (
              <Checkbox
                label="Make this the default announcement"
                description="Only one announcement can be default; it always shows first."
                checked={values.isDefault}
                onChange={handleChange('isDefault')}
              />
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant={theme.button.ghost} onClick={onCancel} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" variant={theme.button.primary} loading={submitting}>
                {mode === 'edit' ? 'Save Changes' : 'Add Announcement'}
              </Button>
            </div>
          </>
        );
      }}
    </Form>
  );
};

export default AnnouncementForm;
