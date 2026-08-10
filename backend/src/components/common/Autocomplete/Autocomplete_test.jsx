import React, { useState } from 'react';
import Autocomplete from './Autocomplete';

const COUNTRIES = [
  'United States', 'United Kingdom', 'India', 'Canada', 'Australia',
  'Germany', 'France', 'Japan', 'Brazil', 'South Africa', 'Mexico', 'Italy',
];

/**
 * Interactive testing component for Autocomplete
 * Demonstrates free-text filtering, minChars threshold, async/loading mode,
 * required + error state, and onSelect vs onChange semantics
 */
const AutocompleteTest = () => {
  const [activityLog, setActivityLog] = useState('Type in an autocomplete below to see events here.');
  const logEvent = (msg) => setActivityLog(msg);

  const [country, setCountry] = useState('');
  const [asyncQuery, setAsyncQuery] = useState('');
  const [asyncLoading, setAsyncLoading] = useState(false);
  const [asyncResults, setAsyncResults] = useState([]);

  const handleAsyncChange = (text) => {
    setAsyncQuery(text);
    if (text.length < 2) {
      setAsyncResults([]);
      return;
    }
    setAsyncLoading(true);
    setTimeout(() => {
      setAsyncResults(COUNTRIES.filter((c) => c.toLowerCase().includes(text.toLowerCase())));
      setAsyncLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Autocomplete Component Test
          </h1>
          <p className="text-lg text-gray-600">
            Interactive testing interface for all autocomplete variants and features
          </p>
          <div className="mt-4 p-4 bg-blue-100 rounded-lg inline-block">
            <p className="text-blue-800 font-medium">
              Activity: {activityLog}
            </p>
          </div>
        </div>

        {/* Basic */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Basic (Free Text + Suggestions)</h2>
          <div className="max-w-md">
            <Autocomplete
              label="Country"
              placeholder="Start typing a country..."
              options={COUNTRIES}
              value={country}
              onChange={setCountry}
              onSelect={(option) => logEvent(`Selected: ${option.label}`)}
            />
          </div>
        </section>

        {/* minChars */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Minimum Characters (minChars=2)</h2>
          <p className="text-sm text-gray-600 mb-4">Suggestions only appear after 2+ characters.</p>
          <div className="max-w-md">
            <Autocomplete
              label="Search"
              placeholder="Type at least 2 characters..."
              options={COUNTRIES}
              minChars={2}
              defaultValue=""
              onSelect={(option) => logEvent(`Selected: ${option.label}`)}
            />
          </div>
        </section>

        {/* Simulated async */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Simulated Async Source</h2>
          <p className="text-sm text-gray-600 mb-4">Shows a loading row for 500ms before results appear.</p>
          <div className="max-w-md">
            <Autocomplete
              label="Async search"
              placeholder="Search countries..."
              options={asyncResults}
              value={asyncQuery}
              onChange={handleAsyncChange}
              loading={asyncLoading}
              minChars={2}
              onSelect={(option) => logEvent(`Async selected: ${option.label}`)}
            />
          </div>
        </section>

        {/* Required + error */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Required, with Error</h2>
          <div className="max-w-md">
            <Autocomplete
              label="Destination"
              required
              options={COUNTRIES}
              error="Please select a valid destination"
            />
          </div>
        </section>

        {/* Accessibility Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Accessibility Features</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>The input uses <code>role="combobox"</code> with <code>aria-expanded</code>/<code>aria-controls</code>, and the suggestion list is a <code>role="listbox"</code> of <code>role="option"</code>s.</p>
            <p>Arrow keys move the highlighted suggestion, Enter selects it, and Escape closes the list without clearing what you typed.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AutocompleteTest;
