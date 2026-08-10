import React from 'react';
import Divider from './Divider';

/**
 * Interactive testing component for Divider
 * Demonstrates horizontal/vertical orientation, labels, variants, and colors
 */
const DividerTest = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Divider Component Test
          </h1>
          <p className="text-lg text-gray-600">
            Interactive testing interface for all divider variants and features
          </p>
        </div>

        {/* Basic horizontal */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Basic Horizontal</h2>
          <p className="text-sm text-gray-600">Content above</p>
          <Divider className="my-4" />
          <p className="text-sm text-gray-600">Content below</p>
        </section>

        {/* With label */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">With Label</h2>
          <Divider label="OR" />
        </section>

        {/* Variants */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Line Styles</h2>
          <div className="space-y-4">
            <Divider variant="solid" />
            <Divider variant="dashed" />
            <Divider variant="dotted" />
          </div>
        </section>

        {/* Colors */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Colors</h2>
          <div className="space-y-4">
            <Divider color="gray" />
            <Divider color="blue" />
            <Divider color="red" />
            <Divider color="green" />
          </div>
        </section>

        {/* Vertical */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Vertical</h2>
          <div className="flex items-center h-8 gap-4 text-sm text-gray-600">
            <span>Link One</span>
            <Divider orientation="vertical" />
            <span>Link Two</span>
            <Divider orientation="vertical" />
            <span>Link Three</span>
          </div>
        </section>
      </div>
    </div>
  );
};

export default DividerTest;
