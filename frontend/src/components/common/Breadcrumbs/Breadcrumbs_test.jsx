import React, { useState } from 'react';
import Breadcrumbs from './Breadcrumbs';

const HomeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

/**
 * Interactive testing component for Breadcrumbs
 * Demonstrates links vs onClick navigation, icons, custom separator,
 * and collapsing long trails with maxItems
 */
const BreadcrumbsTest = () => {
  const [activityLog, setActivityLog] = useState('Click a breadcrumb link below to see events here.');
  const logEvent = (msg) => setActivityLog(msg);

  const basicItems = [
    { label: 'Home', href: '#', icon: <HomeIcon /> },
    { label: 'Projects', href: '#' },
    { label: 'React Component Library', href: '#' },
    { label: 'Breadcrumbs' },
  ];

  const clickableItems = [
    { label: 'Dashboard', onClick: (e) => { e.preventDefault(); logEvent('Navigated to Dashboard'); } },
    { label: 'Team', onClick: (e) => { e.preventDefault(); logEvent('Navigated to Team'); } },
    { label: 'Members' },
  ];

  const longTrail = [
    { label: 'Home', href: '#' },
    { label: 'Category', href: '#' },
    { label: 'Subcategory', href: '#' },
    { label: 'Product Type', href: '#' },
    { label: 'Brand', href: '#' },
    { label: 'Product Name' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Breadcrumbs Component Test
          </h1>
          <p className="text-lg text-gray-600">
            Interactive testing interface for all breadcrumbs variants and features
          </p>
          <div className="mt-4 p-4 bg-blue-100 rounded-lg inline-block">
            <p className="text-blue-800 font-medium">
              Activity: {activityLog}
            </p>
          </div>
        </div>

        {/* Basic with icon */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Basic (with icon on first item)</h2>
          <Breadcrumbs items={basicItems} />
        </section>

        {/* onClick navigation */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Programmatic Navigation (onClick, no href)</h2>
          <Breadcrumbs items={clickableItems} />
        </section>

        {/* Custom separator */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Custom Separator</h2>
          <Breadcrumbs items={basicItems} separator={<span className="text-gray-300">/</span>} />
        </section>

        {/* Collapsed long trail */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Collapsed Long Trail (maxItems=4)</h2>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Full trail ({longTrail.length} items):</p>
              <Breadcrumbs items={longTrail} />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Collapsed:</p>
              <Breadcrumbs items={longTrail} maxItems={4} />
            </div>
          </div>
        </section>

        {/* Accessibility Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Accessibility Features</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>Wrapped in <code>&lt;nav aria-label="Breadcrumb"&gt;</code> with an ordered list, and the current page has <code>aria-current="page"</code>.</p>
            <p>Separators are <code>aria-hidden</code> so screen readers don't announce them as content.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default BreadcrumbsTest;
