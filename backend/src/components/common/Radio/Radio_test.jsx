import React, { useState } from 'react';
import RadioGroup, { Radio } from './Radio';

/**
 * Interactive testing component for Radio / RadioGroup
 * Demonstrates controlled groups, direction, sizes, disabled options,
 * error state, and standalone Radio usage
 */
const RadioTest = () => {
  const [activityLog, setActivityLog] = useState('Interact with a radio group below to see events here.');
  const logEvent = (msg) => setActivityLog(msg);

  const PLAN_OPTIONS = [
    { value: 'free', label: 'Free', description: 'Basic features, community support' },
    { value: 'pro', label: 'Pro', description: 'Everything in Free, plus priority support' },
    { value: 'enterprise', label: 'Enterprise', description: 'Custom contracts and SSO', disabled: true },
  ];

  const [plan, setPlan] = useState('pro');
  const [align, setAlign] = useState('left');

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Radio Component Test
          </h1>
          <p className="text-lg text-gray-600">
            Interactive testing interface for all radio variants and features
          </p>
          <div className="mt-4 p-4 bg-blue-100 rounded-lg inline-block">
            <p className="text-blue-800 font-medium">
              Activity: {activityLog}
            </p>
          </div>
        </div>

        {/* Controlled Group */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Controlled Group (with descriptions &amp; disabled option)</h2>
          <RadioGroup
            name="plan"
            label="Choose a plan"
            options={PLAN_OPTIONS}
            value={plan}
            onChange={(value) => {
              setPlan(value);
              logEvent(`Plan changed to "${value}"`);
            }}
          />
        </section>

        {/* Direction */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Layout Direction</h2>
          <RadioGroup
            name="align"
            label="Text alignment"
            direction="horizontal"
            options={[
              { value: 'left', label: 'Left' },
              { value: 'center', label: 'Center' },
              { value: 'right', label: 'Right' },
            ]}
            value={align}
            onChange={(value) => {
              setAlign(value);
              logEvent(`Alignment changed to "${value}"`);
            }}
          />
        </section>

        {/* Sizes */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Sizes</h2>
          <div className="flex flex-wrap gap-8">
            <RadioGroup
              name="size-sm"
              size="sm"
              direction="horizontal"
              defaultValue="a"
              options={[{ value: 'a', label: 'Small' }]}
            />
            <RadioGroup
              name="size-md"
              size="md"
              direction="horizontal"
              defaultValue="a"
              options={[{ value: 'a', label: 'Medium' }]}
            />
            <RadioGroup
              name="size-lg"
              size="lg"
              direction="horizontal"
              defaultValue="a"
              options={[{ value: 'a', label: 'Large' }]}
            />
          </div>
        </section>

        {/* States */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">States</h2>
          <div className="space-y-8">
            <RadioGroup
              name="disabled-group"
              label="Entire group disabled"
              disabled
              defaultValue="x"
              options={[
                { value: 'x', label: 'Option X' },
                { value: 'y', label: 'Option Y' },
              ]}
            />
            <RadioGroup
              name="error-group"
              label="With error"
              required
              error="Please select a shipping method"
              options={[
                { value: 'standard', label: 'Standard' },
                { value: 'express', label: 'Express' },
              ]}
            />
          </div>
        </section>

        {/* Standalone Radio */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Standalone Radio</h2>
          <p className="text-sm text-gray-600 mb-4">
            The individual <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">Radio</code> is
            also exported for full manual control of a native radio group.
          </p>
          <div className="flex gap-6">
            <Radio name="manual" value="one" label="Manual One" defaultChecked={false} />
            <Radio name="manual" value="two" label="Manual Two" defaultChecked={false} />
          </div>
        </section>

        {/* Accessibility Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Accessibility Features</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>Groups render as a native <code>&lt;fieldset&gt;</code>/<code>&lt;legend&gt;</code> with <code>role="radiogroup"</code>.</p>
            <p>Arrow-key navigation between options comes for free from the native <code>name</code>-grouped radio inputs.</p>
            <p>Error messages use <code>role="alert"</code> so assistive tech announces them immediately.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default RadioTest;
