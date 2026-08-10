import React, { useState } from 'react';
import Accordion from './Accordion';

/**
 * Interactive testing component for Accordion
 * Demonstrates single vs multiple open, controlled usage, variants,
 * and disabled sections
 */
const AccordionTest = () => {
  const faqItems = [
    {
      key: 'what',
      title: 'What is this component library?',
      content: 'A personal, reusable set of React + Tailwind components covering forms, feedback, navigation, and layout primitives.',
    },
    {
      key: 'styling',
      title: 'How is it styled?',
      content: 'Every component ships with Tailwind utility classes and accepts a className prop for overrides, matching the rest of the library.',
    },
    {
      key: 'access',
      title: 'Is it accessible?',
      content: 'Each component follows the relevant WAI-ARIA pattern where one exists — this Accordion uses aria-expanded/aria-controls with a real heading + region structure.',
    },
    {
      key: 'disabled',
      title: 'Disabled section (cannot open)',
      content: 'This content is not reachable.',
      disabled: true,
    },
  ];

  const [controlledOpen, setControlledOpen] = useState(['what']);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Accordion Component Test
          </h1>
          <p className="text-lg text-gray-600">
            Interactive testing interface for all accordion variants and features
          </p>
        </div>

        {/* Single-open, bordered (default) */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Single-Open, Bordered (default)</h2>
          <Accordion items={faqItems} defaultOpenKeys={['what']} />
        </section>

        {/* Multiple open, separated */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Multiple Open, Separated Variant</h2>
          <Accordion
            items={faqItems.filter((i) => !i.disabled)}
            allowMultiple
            variant="separated"
            defaultOpenKeys={['what', 'styling']}
          />
        </section>

        {/* Controlled */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Controlled</h2>
          <p className="text-sm text-gray-600 mb-4">Open keys: {controlledOpen.join(', ') || '(none)'}</p>
          <Accordion
            items={faqItems.filter((i) => !i.disabled)}
            openKeys={controlledOpen}
            onChange={setControlledOpen}
          />
        </section>

        {/* Accessibility Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Accessibility Features</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>Each header is a real <code>&lt;h3&gt;</code>/<code>&lt;button&gt;</code> with <code>aria-expanded</code>, and each panel is a <code>role="region"</code> linked via <code>aria-controls</code>/<code>aria-labelledby</code>.</p>
            <p>Panels animate open/closed height via a CSS grid-rows transition rather than JS-measured heights.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AccordionTest;
