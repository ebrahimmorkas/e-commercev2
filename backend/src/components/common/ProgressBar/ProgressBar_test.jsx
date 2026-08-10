import React, { useEffect, useState } from 'react';
import ProgressBar from './ProgressBar';
import Button from '../Buttons';

/**
 * Interactive testing component for ProgressBar
 * Demonstrates linear/circular variants, sizes, colors, striped fill,
 * and a live-updating upload simulation
 */
const ProgressBarTest = () => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploading = uploadProgress > 0 && uploadProgress < 100;

  useEffect(() => {
    if (!uploading) return;
    const timer = setTimeout(() => setUploadProgress((p) => Math.min(100, p + 10)), 300);
    return () => clearTimeout(timer);
  }, [uploading, uploadProgress]);

  const startUpload = () => setUploadProgress(1);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            ProgressBar Component Test
          </h1>
          <p className="text-lg text-gray-600">
            Interactive testing interface for all progress bar variants and features
          </p>
        </div>

        {/* Linear basic */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Linear, with Label</h2>
          <div className="space-y-4 max-w-md">
            <ProgressBar value={25} showLabel />
            <ProgressBar value={60} showLabel color="green" />
            <ProgressBar value={90} showLabel color="red" />
          </div>
        </section>

        {/* Sizes */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Sizes</h2>
          <div className="space-y-4 max-w-md">
            <ProgressBar value={45} size="sm" />
            <ProgressBar value={45} size="md" />
            <ProgressBar value={45} size="lg" />
          </div>
        </section>

        {/* Striped */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Striped</h2>
          <div className="max-w-md">
            <ProgressBar value={70} striped color="purple" size="lg" />
          </div>
        </section>

        {/* Circular */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Circular</h2>
          <div className="flex flex-wrap items-center gap-8">
            <ProgressBar variant="circular" value={30} size="sm" showLabel />
            <ProgressBar variant="circular" value={65} size="md" showLabel color="green" />
            <ProgressBar variant="circular" value={90} size="lg" showLabel color="red" />
          </div>
        </section>

        {/* Live upload simulation */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Live Upload Simulation</h2>
          <div className="max-w-md space-y-4">
            <ProgressBar value={uploadProgress} showLabel color={uploadProgress >= 100 ? 'green' : 'blue'} />
            <Button variant="primary" onClick={startUpload} disabled={uploading}>
              {uploading ? 'Uploading...' : uploadProgress >= 100 ? 'Upload Again' : 'Start Upload'}
            </Button>
          </div>
        </section>

        {/* Accessibility Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Accessibility Features</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>Both variants use <code>role="progressbar"</code> with <code>aria-valuenow</code>/<code>aria-valuemin</code>/<code>aria-valuemax</code> so assistive tech can announce progress.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ProgressBarTest;
