import React, { useState } from 'react';
import Checkbox from './Checkbox';

/**
 * Interactive testing component for Checkbox
 * Demonstrates controlled/uncontrolled use, sizes, indeterminate,
 * error state, and a "select all" list pattern
 */
const CheckboxTest = () => {
  const [activityLog, setActivityLog] = useState('Interact with a checkbox below to see events here.');
  const logEvent = (msg) => setActivityLog(msg);

  const [single, setSingle] = useState(false);

  const ITEMS = ['Apples', 'Bananas', 'Cherries', 'Dates'];
  const [checkedItems, setCheckedItems] = useState([]);

  const allChecked = checkedItems.length === ITEMS.length;
  const someChecked = checkedItems.length > 0 && !allChecked;

  const toggleItem = (item) => {
    setCheckedItems((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const toggleAll = () => {
    setCheckedItems(allChecked ? [] : ITEMS);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Checkbox Component Test
          </h1>
          <p className="text-lg text-gray-600">
            Interactive testing interface for all checkbox variants and features
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
            <Checkbox
              label="Uncontrolled checkbox"
              description="Manages its own state internally via defaultChecked"
              defaultChecked
              onChange={() => logEvent('Uncontrolled checkbox toggled')}
            />
            <Checkbox
              label="Controlled checkbox"
              description={`Currently ${single ? 'checked' : 'unchecked'}`}
              checked={single}
              onChange={(e) => {
                setSingle(e.target.checked);
                logEvent(`Controlled checkbox set to ${e.target.checked}`);
              }}
            />
          </div>
        </section>

        {/* Sizes */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Sizes</h2>
          <div className="flex flex-wrap gap-8">
            <Checkbox size="sm" label="Small" defaultChecked />
            <Checkbox size="md" label="Medium" defaultChecked />
            <Checkbox size="lg" label="Large" defaultChecked />
          </div>
        </section>

        {/* States */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">States</h2>
          <div className="space-y-4">
            <Checkbox label="Disabled unchecked" disabled />
            <Checkbox label="Disabled checked" disabled defaultChecked />
            <Checkbox
              label="With error"
              error="You must accept the terms to continue"
              required
            />
          </div>
        </section>

        {/* Select All / Indeterminate pattern */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Select All (Indeterminate)</h2>
          <div className="space-y-2">
            <Checkbox
              label={`Select all (${checkedItems.length}/${ITEMS.length})`}
              checked={allChecked}
              indeterminate={someChecked}
              onChange={toggleAll}
            />
            <div className="ml-6 space-y-2 pt-2 border-t border-gray-100">
              {ITEMS.map((item) => (
                <Checkbox
                  key={item}
                  label={item}
                  checked={checkedItems.includes(item)}
                  onChange={() => toggleItem(item)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Accessibility Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Accessibility Features</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>Label is a proper <code>&lt;label htmlFor&gt;</code>, so clicking the text toggles the checkbox.</p>
            <p>Error messages use <code>role="alert"</code> and are linked via <code>aria-describedby</code>.</p>
            <p>The indeterminate visual state is applied directly to the DOM node, matching native checkbox behavior.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default CheckboxTest;
