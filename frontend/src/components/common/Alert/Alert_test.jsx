import React, { useState } from 'react';
import Alert from './Alert';
import Button from '../Buttons';

/**
 * Interactive testing component for Alert
 * Demonstrates variants, titles, dismissible alerts, action buttons,
 * and the difference in intent versus Toast
 */
const AlertTest = () => {
  const [showDismissible, setShowDismissible] = useState(true);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Alert Component Test
          </h1>
          <p className="text-lg text-gray-600">
            Interactive testing interface for all alert variants and features
          </p>
        </div>

        {/* Variants */}
        <section className="bg-white rounded-xl shadow-md p-8 space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Variants</h2>
          <Alert variant="info" title="Heads up">
            A new version of the app is available.
          </Alert>
          <Alert variant="success" title="Success">
            Your changes have been saved.
          </Alert>
          <Alert variant="warning" title="Warning">
            Your subscription expires in 3 days.
          </Alert>
          <Alert variant="error" title="Error">
            We couldn't process your payment. Please try again.
          </Alert>
        </section>

        {/* No title, message only */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Message Only (No Title)</h2>
          <Alert variant="info">This is a simple one-line notice with no title.</Alert>
        </section>

        {/* Dismissible */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Dismissible</h2>
          {showDismissible ? (
            <Alert
              variant="warning"
              title="Unsaved changes"
              dismissible
              onDismiss={() => {}}
            >
              You have unsaved changes that will be lost if you navigate away.
            </Alert>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">Dismissed.</p>
              <Button variant="outline" size="sm" onClick={() => setShowDismissible(true)}>
                Show Again
              </Button>
            </div>
          )}
        </section>

        {/* With actions */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">With Actions</h2>
          <Alert
            variant="error"
            title="Connection lost"
            actions={
              <>
                <Button size="sm" variant="danger" onClick={() => {}}>
                  Retry
                </Button>
                <Button size="sm" variant="ghost" onClick={() => {}}>
                  Dismiss
                </Button>
              </>
            }
          >
            We couldn't reach the server. Check your connection and try again.
          </Alert>
        </section>

        {/* Alert vs Toast note */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Alert vs. Toast</h2>
          <p className="text-sm text-gray-600">
            Alert is a <strong>static, in-layout</strong> block — form validation summaries, page-level
            warnings, banners above content. Toast is a <strong>transient, floating</strong> notification
            for one-off events (a save completing, an error firing). Use Alert when the message should stay
            visible until the underlying condition changes; use Toast when it should announce and then fade.
          </p>
        </section>

        {/* Accessibility Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Accessibility Features</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>Uses <code>role="alert"</code> so assistive tech announces it as soon as it's rendered.</p>
            <p>The dismiss button has an explicit <code>aria-label="Dismiss"</code>.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AlertTest;
