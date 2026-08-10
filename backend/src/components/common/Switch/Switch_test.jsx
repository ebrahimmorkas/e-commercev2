import React, { useState } from 'react';
import Switch from './Switch';

/**
 * Interactive testing component for Switch
 * Demonstrates controlled/uncontrolled use, sizes, colors,
 * label position, and disabled states
 */
const SwitchTest = () => {
  const [activityLog, setActivityLog] = useState('Interact with a switch below to see events here.');
  const logEvent = (msg) => setActivityLog(msg);

  const [notifications, setNotifications] = useState(true);
  const [settings, setSettings] = useState({
    marketing: false,
    security: true,
    newsletter: false,
  });

  const toggleSetting = (key) => (e) => {
    setSettings((prev) => ({ ...prev, [key]: e.target.checked }));
    logEvent(`${key} set to ${e.target.checked}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Switch Component Test
          </h1>
          <p className="text-lg text-gray-600">
            Interactive testing interface for all switch variants and features
          </p>
          <div className="mt-4 p-4 bg-blue-100 rounded-lg inline-block">
            <p className="text-blue-800 font-medium">
              Activity: {activityLog}
            </p>
          </div>
        </div>

        {/* Basic + Controlled */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Basic &amp; Controlled</h2>
          <div className="space-y-4">
            <Switch
              label="Enable notifications"
              description={notifications ? 'You will receive push notifications' : 'Notifications are muted'}
              checked={notifications}
              onChange={(e) => {
                setNotifications(e.target.checked);
                logEvent(`Notifications ${e.target.checked ? 'enabled' : 'disabled'}`);
              }}
            />
            <Switch label="Uncontrolled switch" defaultChecked onChange={() => logEvent('Uncontrolled switch toggled')} />
          </div>
        </section>

        {/* Sizes */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Sizes</h2>
          <div className="flex flex-wrap items-center gap-8">
            <Switch size="sm" label="Small" defaultChecked />
            <Switch size="md" label="Medium" defaultChecked />
            <Switch size="lg" label="Large" defaultChecked />
          </div>
        </section>

        {/* Colors */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Colors</h2>
          <div className="flex flex-wrap gap-8">
            <Switch color="blue" label="Blue" defaultChecked />
            <Switch color="green" label="Green" defaultChecked />
            <Switch color="red" label="Red" defaultChecked />
            <Switch color="purple" label="Purple" defaultChecked />
          </div>
        </section>

        {/* Label Position */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Label Position</h2>
          <div className="flex flex-wrap gap-8">
            <Switch labelPosition="right" label="Label on right" defaultChecked />
            <Switch labelPosition="left" label="Label on left" defaultChecked />
            <Switch />
          </div>
        </section>

        {/* States */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">States</h2>
          <div className="flex flex-wrap gap-8">
            <Switch label="Disabled off" disabled />
            <Switch label="Disabled on" disabled defaultChecked />
          </div>
        </section>

        {/* Settings panel pattern */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Settings Panel Pattern</h2>
          <div className="divide-y divide-gray-100">
            <div className="flex items-center justify-between py-4">
              <Switch
                label="Marketing emails"
                description="Occasional product updates and offers"
                checked={settings.marketing}
                onChange={toggleSetting('marketing')}
              />
            </div>
            <div className="flex items-center justify-between py-4">
              <Switch
                label="Security alerts"
                description="Required for account safety"
                checked={settings.security}
                onChange={toggleSetting('security')}
              />
            </div>
            <div className="flex items-center justify-between py-4">
              <Switch
                label="Weekly newsletter"
                checked={settings.newsletter}
                onChange={toggleSetting('newsletter')}
              />
            </div>
          </div>
        </section>

        {/* Accessibility Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Accessibility Features</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>Uses a real <code>&lt;button role="switch"&gt;</code> with <code>aria-checked</code>, so it's keyboard-operable (Space/Enter) and announced correctly by screen readers.</p>
            <p>Clicking the label text toggles the switch, same as a native checkbox.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SwitchTest;
