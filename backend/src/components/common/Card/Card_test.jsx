import React, { useState } from 'react';
import Card from './Card';
import Button from '../Buttons';
import Badge from '../Badge';

/**
 * Interactive testing component for Card
 * Demonstrates variants, padding, image header, footer,
 * hoverable/clickable cards, and a loading skeleton
 */
const CardTest = () => {
  const [activityLog, setActivityLog] = useState('Interact with a card below to see events here.');
  const logEvent = (msg) => setActivityLog(msg);
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Card Component Test
          </h1>
          <p className="text-lg text-gray-600">
            Interactive testing interface for all card variants and features
          </p>
          <div className="mt-4 p-4 bg-blue-100 rounded-lg inline-block">
            <p className="text-blue-800 font-medium">
              Activity: {activityLog}
            </p>
          </div>
        </div>

        {/* Variants */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Variants</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card variant="elevated" title="Elevated" subtitle="Default shadow style">
              <p className="text-sm text-gray-600">Uses a soft drop shadow instead of a border.</p>
            </Card>
            <Card variant="outlined" title="Outlined" subtitle="Border, no shadow">
              <p className="text-sm text-gray-600">Good for dense layouts where shadows add noise.</p>
            </Card>
            <Card variant="flat" title="Flat" subtitle="Subtle gray background">
              <p className="text-sm text-gray-600">Blends into a page rather than standing out.</p>
            </Card>
          </div>
        </section>

        {/* Header actions + footer */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Header Actions &amp; Footer</h2>
          <div className="max-w-md">
            <Card
              title="Project Phoenix"
              subtitle="Updated 2 hours ago"
              headerActions={<Badge variant="green" dot>Active</Badge>}
              footer={
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => logEvent('Archive clicked')}>
                    Archive
                  </Button>
                  <Button size="sm" variant="primary" onClick={() => logEvent('Open clicked')}>
                    Open
                  </Button>
                </div>
              }
            >
              <p className="text-sm text-gray-600">
                A composable card body can hold any content — text, lists, other components.
              </p>
            </Card>
          </div>
        </section>

        {/* Image header */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Image Header</h2>
          <div className="max-w-sm">
            <Card
              image="https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&h=400&fit=crop"
              imageAlt="Mountain landscape"
              title="Mountain Retreat"
              subtitle="Colorado, USA"
            >
              <p className="text-sm text-gray-600">A card with an image rendered above the header.</p>
            </Card>
          </div>
        </section>

        {/* Hoverable / clickable */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Hoverable &amp; Clickable</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card hoverable title="Hover me" subtitle="Lifts on hover">
              <p className="text-sm text-gray-600">Purely visual — no click behavior.</p>
            </Card>
            <Card
              hoverable
              onClick={() => logEvent('Clickable card activated')}
              title="Click or press Enter"
              subtitle="Keyboard accessible"
            >
              <p className="text-sm text-gray-600">Focusable via keyboard, activates on click or Enter/Space.</p>
            </Card>
          </div>
        </section>

        {/* Padding */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Padding</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card padding="sm" variant="outlined" title="Small padding">
              <p className="text-sm text-gray-600">Compact.</p>
            </Card>
            <Card padding="md" variant="outlined" title="Medium padding">
              <p className="text-sm text-gray-600">Default.</p>
            </Card>
            <Card padding="lg" variant="outlined" title="Large padding">
              <p className="text-sm text-gray-600">Roomy.</p>
            </Card>
          </div>
        </section>

        {/* Loading skeleton */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Loading Skeleton</h2>
          <div className="max-w-sm space-y-4">
            <Button variant="outline" onClick={() => setLoading((l) => !l)}>
              {loading ? 'Show Content' : 'Show Loading Skeleton'}
            </Button>
            <Card variant="outlined" loading={loading} title="Card Title">
              <p className="text-sm text-gray-600">This content is replaced by a skeleton while loading.</p>
            </Card>
          </div>
        </section>

        {/* Accessibility Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Accessibility Features</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>Clickable cards (<code>onClick</code> provided) get <code>role="button"</code>, <code>tabIndex=0</code>, and respond to Enter/Space, not just mouse clicks.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default CardTest;
