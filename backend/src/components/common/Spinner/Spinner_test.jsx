import React, { useState } from 'react';
import Spinner from './Spinner';
import Button from '../Buttons';
import Card from '../Card';

/**
 * Interactive testing component for Spinner
 * Demonstrates sizes, colors, inline usage inside other components,
 * and the full-screen overlay mode
 */
const SpinnerTest = () => {
  const [overlayOpen, setOverlayOpen] = useState(false);

  const showOverlay = () => {
    setOverlayOpen(true);
    setTimeout(() => setOverlayOpen(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Spinner Component Test
          </h1>
          <p className="text-lg text-gray-600">
            Interactive testing interface for all spinner variants and features
          </p>
        </div>

        {/* Sizes */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Sizes</h2>
          <div className="flex flex-wrap items-center gap-6">
            <Spinner size="xs" />
            <Spinner size="sm" />
            <Spinner size="md" />
            <Spinner size="lg" />
            <Spinner size="xl" />
          </div>
        </section>

        {/* Colors */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Colors</h2>
          <div className="flex flex-wrap items-center gap-6">
            <Spinner color="blue" size="lg" />
            <Spinner color="gray" size="lg" />
            <Spinner color="green" size="lg" />
            <Spinner color="red" size="lg" />
            <div className="bg-gray-900 p-3 rounded-lg">
              <Spinner color="white" size="lg" />
            </div>
          </div>
        </section>

        {/* Inline usage */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Inline Usage</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-gray-600">
              <Spinner size="sm" />
              <span>Fetching latest results...</span>
            </div>
            <Card variant="outlined" padding="sm">
              <div className="flex items-center justify-center gap-2 py-6 text-gray-500">
                <Spinner size="md" color="gray" />
                <span>Loading card content...</span>
              </div>
            </Card>
          </div>
        </section>

        {/* Full-screen overlay */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Full-Screen Overlay</h2>
          <p className="text-sm text-gray-600 mb-4">
            Renders a fixed, viewport-covering overlay with a centered spinner for 2 seconds.
          </p>
          <Button variant="primary" onClick={showOverlay}>
            Trigger Full-Screen Loading
          </Button>
          {overlayOpen && <Spinner fullScreen size="xl" />}
        </section>

        {/* Accessibility Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Accessibility Features</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>Uses <code>role="status"</code> plus an accessible <code>label</code> (default "Loading") so screen readers announce the busy state.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SpinnerTest;
