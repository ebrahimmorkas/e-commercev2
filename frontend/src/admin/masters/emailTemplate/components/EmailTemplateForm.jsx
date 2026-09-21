import Form from '../../../../components/common/Form';
import InputField from '../../../../components/common/InputField';
import TextArea from '../../../../components/common/TextArea';
import Dropdown from '../../../../components/common/DropDown';
import HtmlEditor from '../../../../components/common/HtmlEditor';
import Button from '../../../../components/common/Buttons';
import { useEmailTemplateVariables } from '../hooks/useEmailTemplateVariables';
import { EMAIL_MODULE_OPTIONS } from '../constants';
import theme from '../theme/theme';

const STATUS_OPTIONS = [
  { value: 'A', label: 'Active' },
  { value: 'I', label: 'Inactive' },
];

const buildValidationSchema = (mode) => {
  const schema = {
    templateName: {
      required: true,
      validations: [
        (v) => (v.trim().length >= 2 ? true : 'Template name must be at least 2 characters'),
        (v) => (v.trim().length <= 100 ? true : 'Template name must not exceed 100 characters'),
      ],
    },
    module: { required: false },
    subject: {
      required: true,
      validations: [(v) => (v.trim().length <= 200 ? true : 'Subject must not exceed 200 characters')],
    },
    htmlBody: {
      required: true,
      validations: [(v) => (v.trim().length > 0 ? true : 'HTML body is required')],
    },
    textBody: { required: false },
  };

  if (mode === 'edit') {
    schema.status = { required: true };
  }

  return schema;
};

/**
 * Add/Edit form for an email template. Built on the reusable Form orchestrator
 * (render-prop mode, since Dropdown/HtmlEditor aren't config-driven field types).
 *
 * @param {'add'|'edit'} props.mode
 * @param {Object} props.initialValues
 * @param {(values: Object) => Promise<void>} props.onSubmit
 * @param {Function} props.onCancel
 * @param {boolean} props.submitting
 */
const EmailTemplateForm = ({ mode = 'add', initialValues = {}, onSubmit, onCancel, submitting = false }) => {
  const validationSchema = buildValidationSchema(mode);
  const { variablesByModule } = useEmailTemplateVariables();

  const formInitialValues = {
    templateName: initialValues.templateName || '',
    module: initialValues.module || '',
    subject: initialValues.subject || '',
    htmlBody: initialValues.htmlBody || '',
    textBody: initialValues.textBody || '',
    status: initialValues.status || 'A',
  };

  const handleFormSubmit = async (values) => {
    const payload = {
      templateName: values.templateName.trim(),
      module: values.module || '',
      subject: values.subject.trim(),
      htmlBody: values.htmlBody,
      textBody: values.textBody || '',
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
                label="Template Name"
                name="templateName"
                placeholder="e.g. Order Status Update"
                value={values.templateName}
                onChange={handleChange('templateName')}
                onBlur={handleBlur('templateName')}
                required
                maxLength={100}
                showError={false}
              />
              {showError('templateName') && (
                <p className={`mt-1 text-sm ${theme.text.error}`} role="alert">{errors.templateName}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Dropdown
                label="Module"
                name="module"
                options={EMAIL_MODULE_OPTIONS}
                value={values.module}
                onChange={(val) => setFieldValue('module', val || '')}
                placeholder="No module (label only)"
                helperText="Only used to organise templates and list the variables you can use."
                clearable
              />

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

            <div>
              <InputField
                label="Subject"
                name="subject"
                placeholder="e.g. Your order {{orderNumber}} is {{stepName}}"
                value={values.subject}
                onChange={handleChange('subject')}
                onBlur={handleBlur('subject')}
                required
                maxLength={200}
                showError={false}
              />
              {showError('subject') && (
                <p className={`mt-1 text-sm ${theme.text.error}`} role="alert">{errors.subject}</p>
              )}
            </div>

            <HtmlEditor
              label="HTML Body"
              name="htmlBody"
              value={values.htmlBody}
              onChange={(html) => setFieldValue('htmlBody', html)}
              onBlur={handleBlur('htmlBody')}
              variables={variablesByModule[values.module] || []}
              placeholder="<p>Hello {{customerName}},</p>"
              helperText={
                values.module
                  ? 'Use the variable buttons to insert values that are filled in when the email is sent.'
                  : 'Pick a module to see the variables you can insert.'
              }
              error={showError('htmlBody') ? errors.htmlBody : ''}
              required
            />

            <TextArea
              label="Plain Text Body"
              name="textBody"
              placeholder="Optional plain-text version for email clients that do not show HTML"
              value={values.textBody}
              onChange={handleChange('textBody')}
              onBlur={handleBlur('textBody')}
              rows={4}
              showError={false}
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant={theme.button.ghost} onClick={onCancel} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" variant={theme.button.primary} loading={submitting}>
                {mode === 'edit' ? 'Save Changes' : 'Add Template'}
              </Button>
            </div>
          </>
        );
      }}
    </Form>
  );
};

export default EmailTemplateForm;
