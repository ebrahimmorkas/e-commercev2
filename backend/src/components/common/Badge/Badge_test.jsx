import React, { useState } from 'react';
import Badge from './Badge';

/**
 * Interactive testing component for Badge
 * Demonstrates variants, sizes, shapes, outline style, status dots,
 * and removable tags
 */
const BadgeTest = () => {
  const [tags, setTags] = useState(['react', 'tailwind', 'vite', 'accessibility']);

  const removeTag = (tag) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const statuses = [
    { label: 'active', variant: 'green' },
    { label: 'inactive', variant: 'gray' },
    { label: 'suspended', variant: 'red' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Badge Component Test
          </h1>
          <p className="text-lg text-gray-600">
            Interactive testing interface for all badge variants and features
          </p>
        </div>

        {/* Variants */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Color Variants</h2>
          <div className="flex flex-wrap gap-3">
            <Badge variant="gray">Gray</Badge>
            <Badge variant="blue">Blue</Badge>
            <Badge variant="green">Green</Badge>
            <Badge variant="red">Red</Badge>
            <Badge variant="yellow">Yellow</Badge>
            <Badge variant="purple">Purple</Badge>
          </div>
        </section>

        {/* Outline */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Outline Style</h2>
          <div className="flex flex-wrap gap-3">
            <Badge variant="blue" outline>Blue</Badge>
            <Badge variant="green" outline>Green</Badge>
            <Badge variant="red" outline>Red</Badge>
          </div>
        </section>

        {/* Sizes & Shapes */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Sizes &amp; Shapes</h2>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge size="sm" variant="blue">Small</Badge>
              <Badge size="md" variant="blue">Medium</Badge>
              <Badge size="lg" variant="blue">Large</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge shape="pill" variant="purple">Pill</Badge>
              <Badge shape="rounded" variant="purple">Rounded</Badge>
            </div>
          </div>
        </section>

        {/* Status dots (Table integration pattern) */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Status Dots</h2>
          <p className="text-sm text-gray-600 mb-4">
            Same pattern used for the status column in the Table component test.
          </p>
          <div className="flex flex-wrap gap-3">
            {statuses.map((s) => (
              <Badge key={s.label} variant={s.variant} dot className="capitalize">
                {s.label}
              </Badge>
            ))}
          </div>
        </section>

        {/* Removable tags */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Removable Tags</h2>
          <div className="flex flex-wrap gap-2">
            {tags.length === 0 ? (
              <p className="text-sm text-gray-500">All tags removed.</p>
            ) : (
              tags.map((tag) => (
                <Badge key={tag} variant="blue" onRemove={() => removeTag(tag)} removeLabel={`Remove ${tag}`}>
                  {tag}
                </Badge>
              ))
            )}
          </div>
        </section>

        {/* Accessibility Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Accessibility Features</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>Remove buttons expose a specific <code>aria-label</code> (e.g. "Remove react") rather than a generic one.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default BadgeTest;
