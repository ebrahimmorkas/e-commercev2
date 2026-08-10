import React, { useState } from 'react';
import TextArea from './TextArea';
import { validations } from '../../../utils/index';

/**
 * Interactive testing component for TextArea
 * Demonstrates validation, char count, auto-resize, and disabled state
 */
const TextAreaTest = () => {
  const [bio, setBio] = useState('');
  const [feedback, setFeedback] = useState('');
  const [growing, setGrowing] = useState('');

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            TextArea Component Test
          </h1>
          <p className="text-lg text-gray-600">
            Interactive testing interface for all textarea variants and features
          </p>
        </div>

        {/* Basic + Validation */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Validation &amp; Character Count</h2>
          <TextArea
            label="Short Bio"
            name="bio"
            placeholder="Tell us about yourself..."
            required
            minLength={20}
            maxLength={200}
            showCharCount
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            validations={[validations.noProfanity]}
          />
        </section>

        {/* Auto-resize */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Auto-Resize</h2>
          <p className="text-sm text-gray-600 mb-4">Grows in height as you type instead of scrolling internally.</p>
          <TextArea
            label="Feedback"
            name="feedback"
            placeholder="Type a few lines to see it grow..."
            autoResize
            rows={2}
            value={growing}
            onChange={(e) => setGrowing(e.target.value)}
          />
        </section>

        {/* Rows */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Row Sizes</h2>
          <div className="space-y-4">
            <TextArea label="2 rows" rows={2} placeholder="Compact" name="rows2" />
            <TextArea label="6 rows" rows={6} placeholder="Roomy" name="rows6" />
          </div>
        </section>

        {/* States */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">States</h2>
          <div className="space-y-4">
            <TextArea label="Disabled" name="disabled" disabled defaultValue="Can't edit this." />
            <TextArea
              label="With server-side error"
              name="serverError"
              showError
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              validations={[() => (feedback.length > 0 ? true : 'This field cannot be empty')]}
            />
          </div>
        </section>

        {/* Accessibility Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Accessibility Features</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>Shares the exact validation and controlled/uncontrolled pattern as InputField, so validators from <code>utils/validations.js</code> work unchanged.</p>
            <p>Error messages use <code>aria-invalid</code>/<code>aria-describedby</code> and <code>role="alert"</code>.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default TextAreaTest;
