import React from 'react';
import Tooltip from './Tooltip';
import Button from '../Buttons';

const InfoIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

/**
 * Interactive testing component for Tooltip
 * Demonstrates positions, delay, disabled state, arrow toggle,
 * and pairing with icon-only Buttons
 */
const TooltipTest = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Tooltip Component Test
          </h1>
          <p className="text-lg text-gray-600">
            Interactive testing interface for all tooltip variants and features
          </p>
        </div>

        {/* Positions */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Positions</h2>
          <div className="flex flex-wrap items-center justify-center gap-16 py-12">
            <Tooltip content="Top tooltip" position="top">
              <Button variant="outline">Top</Button>
            </Tooltip>
            <Tooltip content="Bottom tooltip" position="bottom">
              <Button variant="outline">Bottom</Button>
            </Tooltip>
            <Tooltip content="Left tooltip" position="left">
              <Button variant="outline">Left</Button>
            </Tooltip>
            <Tooltip content="Right tooltip" position="right">
              <Button variant="outline">Right</Button>
            </Tooltip>
          </div>
        </section>

        {/* Icon-only Button pairing */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Pairing with Icon-Only Buttons</h2>
          <p className="text-sm text-gray-600 mb-4">
            Icon-only buttons already need an <code>ariaLabel</code>; a tooltip adds the same hint visually.
          </p>
          <Tooltip content="More information">
            <Button isIconOnly ariaLabel="More information" variant="ghost">
              <InfoIcon />
            </Button>
          </Tooltip>
        </section>

        {/* Delay */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Delay</h2>
          <div className="flex flex-wrap gap-8">
            <Tooltip content="Appears instantly" delay={0}>
              <Button variant="secondary">No delay</Button>
            </Tooltip>
            <Tooltip content="Appears after 800ms" delay={800}>
              <Button variant="secondary">800ms delay</Button>
            </Tooltip>
          </div>
        </section>

        {/* No arrow / disabled */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Arrow &amp; Disabled</h2>
          <div className="flex flex-wrap gap-8">
            <Tooltip content="No arrow here" arrow={false}>
              <Button variant="secondary">No arrow</Button>
            </Tooltip>
            <Tooltip content="You will never see this" disabled>
              <Button variant="secondary" disabled>
                Disabled tooltip
              </Button>
            </Tooltip>
          </div>
        </section>

        {/* Accessibility Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Accessibility Features</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>Shown on both hover and keyboard focus (not hover-only), and uses <code>role="tooltip"</code>.</p>
            <p>Positioned via CSS relative to its trigger, so like Dropdown it can be clipped by an ancestor with <code>overflow: hidden</code> — a portal-based version would be a future enhancement.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default TooltipTest;
