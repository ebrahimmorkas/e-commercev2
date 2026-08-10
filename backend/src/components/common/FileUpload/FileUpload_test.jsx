import React, { useState } from 'react';
import FileUpload from './FileUpload';

/**
 * Interactive testing component for FileUpload
 * Demonstrates single/multiple selection, accept filtering, max size validation,
 * max file count, and disabled state
 */
const FileUploadTest = () => {
  const [activityLog, setActivityLog] = useState('Select or drop a file below to see events here.');
  const logEvent = (msg) => setActivityLog(msg);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            FileUpload Component Test
          </h1>
          <p className="text-lg text-gray-600">
            Interactive testing interface for all file-upload variants and features
          </p>
          <div className="mt-4 p-4 bg-blue-100 rounded-lg inline-block">
            <p className="text-blue-800 font-medium">
              Activity: {activityLog}
            </p>
          </div>
        </div>

        {/* Single file */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Single File</h2>
          <div className="max-w-md">
            <FileUpload
              label="Resume"
              accept=".pdf,.doc,.docx"
              onFilesSelected={(files) => logEvent(files.length ? `Selected: ${files[0].name}` : 'Cleared')}
            />
          </div>
        </section>

        {/* Multiple files with size + count limits */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Multiple Files, with Limits</h2>
          <p className="text-sm text-gray-600 mb-4">Up to 3 images, 2MB max each. Try dropping a large file to see the per-file error.</p>
          <div className="max-w-md">
            <FileUpload
              label="Gallery images"
              accept="image/*"
              multiple
              maxFiles={3}
              maxSize={2 * 1024 * 1024}
              helperText="PNG, JPG up to 2MB — max 3 files"
              onFilesSelected={(files) => logEvent(`${files.length} valid file(s) selected`)}
            />
          </div>
        </section>

        {/* External error */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">External / Server Error</h2>
          <div className="max-w-md">
            <FileUpload label="Attachment" error="Upload failed — please try again" />
          </div>
        </section>

        {/* Disabled */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Disabled</h2>
          <div className="max-w-md">
            <FileUpload label="Locked" disabled helperText="Uploads are currently disabled" />
          </div>
        </section>

        {/* Accessibility Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Accessibility Features</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>The dropzone is a focusable, keyboard-activatable <code>role="button"</code> (Enter/Space opens the file picker), not just a mouse-only drop target.</p>
            <p>Each file's remove button has a specific <code>aria-label</code> (e.g. "Remove resume.pdf").</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default FileUploadTest;
