import React, { useState } from 'react';
import Form from './Form';
import InputField from '../InputField';
import RadioGroup from '../Radio';
import Switch from '../Switch';
import Button from '../Buttons';
import { validations } from '../../../utils/index';

/**
 * Interactive testing component for Form
 * Demonstrates config-driven mode (auto-rendered fields) and
 * render-prop mode (fully custom layout using the same validation engine)
 */
const FormTest = () => {
  const [activityLog, setActivityLog] = useState('Submit a form below to see the result here.');
  const logEvent = (msg) => setActivityLog(msg);

  // ---- Config-driven mode ----
  const signupFields = [
    { name: 'fullName', type: 'text', label: 'Full Name', placeholder: 'Jane Doe', required: true },
    {
      name: 'email',
      type: 'email',
      label: 'Email',
      placeholder: 'jane@example.com',
      required: true,
      validations: [validations.email],
    },
    {
      name: 'password',
      type: 'password',
      label: 'Password',
      placeholder: 'At least 8 characters',
      required: true,
      validations: [validations.mediumPassword],
    },
    {
      name: 'plan',
      type: 'select',
      label: 'Plan',
      placeholder: 'Choose a plan',
      required: true,
      options: [
        { value: 'free', label: 'Free' },
        { value: 'pro', label: 'Pro' },
        { value: 'enterprise', label: 'Enterprise' },
      ],
    },
    {
      name: 'bio',
      type: 'textarea',
      label: 'Bio (optional)',
      placeholder: 'A short intro...',
      rows: 3,
    },
    {
      name: 'terms',
      type: 'checkbox',
      label: 'I agree to the Terms of Service',
      required: true,
    },
  ];

  // ---- Render-prop mode ----
  const notifySchema = {
    channel: { required: true },
    frequency: { required: true },
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Form Component Test
          </h1>
          <p className="text-lg text-gray-600">
            Interactive testing interface for the Form orchestrator
          </p>
          <div className="mt-4 p-4 bg-blue-100 rounded-lg inline-block">
            <p className="text-blue-800 font-medium">
              Activity: {activityLog}
            </p>
          </div>
        </div>

        {/* Config-driven mode */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Config-Driven Mode</h2>
          <p className="text-sm text-gray-600 mb-6">
            Pass a <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">fields</code> array and
            Form renders InputField/TextArea/Dropdown/Checkbox for you, wired to a shared
            values/errors/touched state and the same validators from{' '}
            <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">utils/validations.js</code>.
            Try submitting empty to see validation kick in.
          </p>
          <div className="max-w-md">
            <Form
              fields={signupFields}
              submitLabel="Create Account"
              showReset
              resetLabel="Clear"
              onSubmit={async (values) => {
                await new Promise((resolve) => setTimeout(resolve, 800));
                logEvent(`Signup submitted for "${values.fullName}" (${values.plan} plan)`);
              }}
            />
          </div>
        </section>

        {/* Render-prop mode */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Render-Prop Mode</h2>
          <p className="text-sm text-gray-600 mb-6">
            Pass a function as <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">children</code>{' '}
            for full layout control, mixing in components (RadioGroup, Switch) that config mode doesn't know about.
            Validation rules come from <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">validationSchema</code>.
          </p>
          <div className="max-w-md">
            <Form
              validationSchema={notifySchema}
              onSubmit={(values) => logEvent(`Notification preferences saved: ${JSON.stringify(values)}`)}
            >
              {({ values, errors, touched, submitAttempted, isSubmitting, setFieldValue, handleSubmit }) => (
                <>
                  <RadioGroup
                    name="channel"
                    label="Notify me via"
                    required
                    options={[
                      { value: 'email', label: 'Email' },
                      { value: 'sms', label: 'SMS' },
                      { value: 'push', label: 'Push notification' },
                    ]}
                    value={values.channel || ''}
                    onChange={(value) => setFieldValue('channel', value)}
                    error={(touched.channel || submitAttempted) && errors.channel}
                  />

                  <RadioGroup
                    name="frequency"
                    label="Frequency"
                    required
                    direction="horizontal"
                    options={[
                      { value: 'instant', label: 'Instant' },
                      { value: 'daily', label: 'Daily digest' },
                      { value: 'weekly', label: 'Weekly digest' },
                    ]}
                    value={values.frequency || ''}
                    onChange={(value) => setFieldValue('frequency', value)}
                    error={(touched.frequency || submitAttempted) && errors.frequency}
                  />

                  <Switch
                    label="Include marketing updates"
                    checked={!!values.marketing}
                    onChange={(e) => setFieldValue('marketing', e.target.checked)}
                  />

                  <Button type="button" variant="primary" loading={isSubmitting} onClick={handleSubmit}>
                    Save Preferences
                  </Button>
                </>
              )}
            </Form>
          </div>
        </section>

        {/* Standalone field reuse note */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Individually-Validated Fields Still Work</h2>
          <p className="text-sm text-gray-600 mb-4">
            Outside of Form, InputField still validates itself exactly as before — Form only adds
            central orchestration on top, it doesn't replace it.
          </p>
          <div className="max-w-md">
            <InputField
              label="Standalone email"
              name="standaloneEmail"
              type="email"
              placeholder="you@example.com"
              validations={[validations.email]}
            />
          </div>
        </section>

        {/* Accessibility Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Accessibility Features</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>Uses <code>noValidate</code> and drives all validation itself, so error messages are consistent regardless of field type.</p>
            <p>Errors only appear after a field is blurred or a submit attempt is made — not on first keystroke.</p>
            <p>Every error message uses <code>role="alert"</code>, including the submit-time error summary banner.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default FormTest;
