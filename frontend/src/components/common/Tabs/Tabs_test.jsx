import React, { useState } from 'react';
import Tabs from './Tabs';
import Badge from '../Badge';

const HomeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

/**
 * Interactive testing component for Tabs
 * Demonstrates variants, sizes, full width, disabled tabs,
 * icons/badges in labels, and controlled usage
 */
const TabsTest = () => {
  const [activityLog, setActivityLog] = useState('Interact with a tabs group below to see events here.');
  const logEvent = (msg) => setActivityLog(msg);

  const basicItems = [
    { key: 'overview', label: 'Overview', content: <p className="text-gray-600">Overview content goes here.</p> },
    { key: 'activity', label: 'Activity', content: <p className="text-gray-600">Recent activity feed goes here.</p> },
    { key: 'settings', label: 'Settings', content: <p className="text-gray-600">Settings form goes here.</p> },
    { key: 'archived', label: 'Archived', disabled: true, content: <p>Archived content</p> },
  ];

  const [controlledTab, setControlledTab] = useState('inbox');
  const mailItems = [
    { key: 'inbox', label: <span className="inline-flex items-center gap-2">Inbox <Badge size="sm" variant="blue">12</Badge></span> },
    { key: 'sent', label: 'Sent' },
    { key: 'drafts', label: <span className="inline-flex items-center gap-2">Drafts <Badge size="sm" variant="gray">3</Badge></span> },
  ].map((item) => ({ ...item, content: <p className="text-gray-600">Showing "{item.key}" folder.</p> }));

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Tabs Component Test
          </h1>
          <p className="text-lg text-gray-600">
            Interactive testing interface for all tabs variants and features
          </p>
          <div className="mt-4 p-4 bg-blue-100 rounded-lg inline-block">
            <p className="text-blue-800 font-medium">
              Activity: {activityLog}
            </p>
          </div>
        </div>

        {/* Underline variant (default), with disabled tab */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Underline Variant (default) + Disabled Tab</h2>
          <Tabs items={basicItems} defaultValue="overview" onChange={(key) => logEvent(`Switched to "${key}"`)} />
        </section>

        {/* Pills variant */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Pills Variant</h2>
          <Tabs items={basicItems.filter((i) => !i.disabled)} variant="pills" defaultValue="overview" />
        </section>

        {/* Bordered variant, full width */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Bordered Variant, Full Width</h2>
          <Tabs items={basicItems.filter((i) => !i.disabled)} variant="bordered" fullWidth defaultValue="activity" />
        </section>

        {/* Sizes */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Sizes</h2>
          <div className="space-y-6">
            <Tabs
              size="sm"
              variant="pills"
              items={[
                { key: 'a', label: 'Small A' },
                { key: 'b', label: 'Small B' },
              ]}
              defaultValue="a"
            />
            <Tabs
              size="lg"
              variant="pills"
              items={[
                { key: 'a', label: 'Large A' },
                { key: 'b', label: 'Large B' },
              ]}
              defaultValue="a"
            />
          </div>
        </section>

        {/* Icons + badges in labels, controlled */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Icons, Badges &amp; Controlled Usage</h2>
          <Tabs
            items={[{ ...mailItems[0], icon: <HomeIcon /> }, mailItems[1], mailItems[2]]}
            value={controlledTab}
            onChange={setControlledTab}
          />
          <p className="mt-4 text-sm text-gray-600">Externally controlled active tab: <strong>{controlledTab}</strong></p>
        </section>

        {/* Accessibility Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Accessibility Features</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>Implements the WAI-ARIA tabs pattern: <code>role="tablist"</code>/<code>"tab"</code>/<code>"tabpanel"</code> with matching <code>aria-controls</code>/<code>aria-labelledby</code>.</p>
            <p>Arrow Left/Right, Home, and End move focus and selection between enabled tabs; disabled tabs are skipped.</p>
            <p>Only the active tab is in the natural tab order (roving <code>tabIndex</code>).</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default TabsTest;
