import React from 'react';
import { useToast } from './useToast';
import Button from '../Buttons';

/**
 * Interactive testing component for the Toast system
 * Must be rendered inside a <ToastProvider> (wired up in App.jsx).
 * Demonstrates all variants, titles, persistent toasts, and manual dismissal.
 */
const ToastTest = () => {
  const toast = useToast();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Toast Component Test
          </h1>
          <p className="text-lg text-gray-600">
            Interactive testing interface for the toast notification system
          </p>
        </div>

        {/* Variants */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Variants</h2>
          <div className="flex flex-wrap gap-4">
            <Button variant="secondary" onClick={() => toast('Plain informational message')}>
              Default
            </Button>
            <Button variant="success" onClick={() => toast.success('Changes saved successfully')}>
              Success
            </Button>
            <Button variant="danger" onClick={() => toast.error('Failed to save changes')}>
              Error
            </Button>
            <Button variant="warning" onClick={() => toast.warning('Your session expires in 5 minutes')}>
              Warning
            </Button>
            <Button variant="outline" onClick={() => toast.info('A new version is available')}>
              Info
            </Button>
          </div>
        </section>

        {/* Titles */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">With a Title</h2>
          <Button
            variant="primary"
            onClick={() =>
              toast.success('Your changes have been saved to the cloud.', { title: 'Saved' })
            }
          >
            Show Titled Toast
          </Button>
        </section>

        {/* Persistent / manual dismiss */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Persistent Toast</h2>
          <p className="text-sm text-gray-600 mb-4">
            Setting <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">duration: 0</code> disables
            auto-dismiss; it stays until the (x) button is clicked.
          </p>
          <Button
            variant="outline"
            onClick={() =>
              toast.error('This requires your attention and will not auto-dismiss.', {
                title: 'Action required',
                duration: 0,
              })
            }
          >
            Show Persistent Toast
          </Button>
        </section>

        {/* Stacking */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Stacking &amp; Max Toasts</h2>
          <p className="text-sm text-gray-600 mb-4">
            Fire several in a row — the provider caps how many show at once (default 5) and drops the oldest.
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh'].forEach((label, i) => {
                setTimeout(() => toast.info(`${label} toast`), i * 150);
              });
            }}
          >
            Fire 7 Toasts
          </Button>
        </section>

        {/* Accessibility Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Accessibility Features</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>The toast region uses <code>aria-live="polite"</code> so screen readers announce new toasts without interrupting.</p>
            <p>Hovering a toast pauses its auto-dismiss timer; leaving it resumes the remaining time.</p>
            <p>Rendered via a portal into <code>document.body</code>, independent of scroll position or ancestor overflow.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ToastTest;
