import { useRef, useState } from 'react';
import Form from '../../../../components/common/Form';
import InputField from '../../../../components/common/InputField';
import TextArea from '../../../../components/common/TextArea';
import Dropdown from '../../../../components/common/DropDown';
import HtmlEditor from '../../../../components/common/HtmlEditor';
import Button from '../../../../components/common/Buttons';
import { useEmailTemplateVariables } from '../hooks/useEmailTemplateVariables';
import { ORDER_MODULE, getModuleLabel, getModuleOptions } from '../constants';
import { initialStepPicks, toStepRequest } from '../utils/stepAssignment';
import OrderStepsField from './OrderStepsField';
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

// What will happen to the module assignment when this form is saved - shown
// under the Module dropdown so auto-assignment is never a surprise. Mirrors
// the backend rules in emailTemplateMasterService (addTemplate/updateTemplate).
const describeModuleAssignment = ({ mode, values, initialValues, assignments, templates, isStepMode, stepsTouched }) => {
  const { module } = values;
  if (!module) {
    return "Select a module to have this template sent automatically for that module's emails.";
  }

  const label = getModuleLabel(module);
  if (isStepMode) {
    if (values.status !== 'A') {
      return `Inactive templates are not assigned to a module. Mark it active to use it for ${label} emails.`;
    }
    const isAssigning = mode === 'add' || module !== (initialValues.module || '') || stepsTouched;
    return isAssigning
      ? `This template will be assigned to the selected ${label} steps. If a step already belongs to another template, you will be asked to confirm before it is moved.`
      : 'Change the order steps below to change which steps this template is sent for.';
  }

  const holder = assignments.find((a) => a.module === module);
  const isHeldByThis = !!holder && mode === 'edit' && holder.templateId === initialValues._id;
  const isModuleChanged = mode === 'add' || module !== (initialValues.module || '');

  if (!isModuleChanged) {
    return isHeldByThis
      ? `This template is currently assigned to the ${label} module.`
      : `This template is not assigned yet. Use "Change Module" on the templates list to assign it to the ${label} module.`;
  }
  if (values.status !== 'A') {
    return `Inactive templates are not assigned to a module. Mark it active to use it for ${label} emails.`;
  }
  if (holder && !isHeldByThis) {
    const holderName = templates.find((t) => t._id === holder.templateId)?.templateName || 'another template';
    return `The ${label} module is currently assigned to "${holderName}". You will be asked to confirm before this template replaces it.`;
  }
  return `This template will be automatically assigned to the ${label} module.`;
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
 * @param {{module: string, templateId: string}[]} props.assignments - current module assignments (for the module hint)
 * @param {Object[]} props.templates - all templates (to name the one currently holding a module)
 * @param {{isOn: boolean, stepOptions: Object[], hasWorkflow: boolean}} props.stepWise - step-wise order templates
 * @param {string[]} props.unavailableModules - modules not to offer (their feature is off)
 */
const EmailTemplateForm = ({
  mode = 'add',
  initialValues = {},
  onSubmit,
  onCancel,
  submitting = false,
  assignments = [],
  templates = [],
  stepWise = { isOn: false, stepOptions: [], hasWorkflow: false },
  unavailableModules = [],
}) => {
  const validationSchema = buildValidationSchema(mode);
  const { variablesByModule } = useEmailTemplateVariables();

  // Order steps live outside the Form orchestrator: they're only required in
  // step-wise mode for the Order module, which its per-field validators
  // can't see. Only sent when the vendor touched them (or picked/changed the
  // module) so a plain content edit never reassigns anything.
  const ownAssignment = mode === 'edit' ? assignments.find((a) => a.templateId === initialValues._id) : null;
  const [stepPicks, setStepPicks] = useState(() => initialStepPicks(ownAssignment));
  const [stepsTouched, setStepsTouched] = useState(false);
  const [stepsError, setStepsError] = useState('');
  const isStepModeFor = (module) => stepWise.isOn && module === ORDER_MODULE;

  // Inserts {{key}} into the subject at the cursor (or at the end), like the
  // HTML body's variable buttons. InputField doesn't forward a ref, so the
  // input is found inside a wrapper instead.
  const subjectWrapperRef = useRef(null);
  const insertSubjectVariable = (key, currentValue, setFieldValue) => {
    const token = `{{${key}}}`;
    const input = subjectWrapperRef.current?.querySelector('input');
    const start = input?.selectionStart ?? currentValue.length;
    const end = input?.selectionEnd ?? currentValue.length;
    setFieldValue('subject', `${currentValue.slice(0, start)}${token}${currentValue.slice(end)}`);
    requestAnimationFrame(() => {
      if (!input) return;
      input.focus();
      input.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const handleStepPicksChange = (picks) => {
    setStepPicks(picks);
    setStepsTouched(true);
    setStepsError(picks.length === 0 ? 'Please select at least one order step.' : '');
  };

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

    const isModuleChanged = mode === 'add' || payload.module !== (initialValues.module || '');
    if (isStepModeFor(payload.module) && (isModuleChanged || stepsTouched)) {
      if (stepPicks.length === 0) {
        setStepsError('Please select at least one order step.');
        return;
      }
      Object.assign(payload, toStepRequest(stepPicks));
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
                options={getModuleOptions(unavailableModules)}
                value={values.module}
                onChange={(val) => setFieldValue('module', val || '')}
                placeholder="No module"
                helperText={describeModuleAssignment({
                  mode, values, initialValues, assignments, templates, isStepMode: isStepModeFor(values.module), stepsTouched,
                })}
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

            {isStepModeFor(values.module) && (
              <OrderStepsField
                value={stepPicks}
                onChange={handleStepPicksChange}
                stepOptions={stepWise.stepOptions}
                hasWorkflow={stepWise.hasWorkflow}
                error={stepsError}
              />
            )}

            <div ref={subjectWrapperRef}>
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
              {(variablesByModule[values.module] || []).length > 0 && (
                <div className="flex flex-wrap items-center gap-1 mt-2">
                  <span className={`text-xs mr-1 ${theme.text.muted}`}>Insert variable:</span>
                  {variablesByModule[values.module].map((variable) => (
                    <Button
                      key={variable.key}
                      type="button"
                      variant="outline"
                      size="xs"
                      title={variable.description}
                      onClick={() => insertSubjectVariable(variable.key, values.subject, setFieldValue)}
                    >
                      {`{{${variable.key}}}`}
                    </Button>
                  ))}
                </div>
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
