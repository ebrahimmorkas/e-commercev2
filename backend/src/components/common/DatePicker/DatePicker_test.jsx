import React, { useState } from 'react';
import DatePicker from './DatePicker';

/**
 * Interactive testing component for DatePicker
 * Demonstrates controlled/uncontrolled use, min/max bounds,
 * custom disabledDates (weekends), clearable, and error state
 */
const DatePickerTest = () => {
  const [activityLog, setActivityLog] = useState('Pick a date below to see events here.');
  const logEvent = (msg) => setActivityLog(msg);

  const [basicDate, setBasicDate] = useState(null);

  const today = new Date();
  const in30Days = new Date();
  in30Days.setDate(today.getDate() + 30);

  const isWeekend = (date) => date.getDay() === 0 || date.getDay() === 6;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            DatePicker Component Test
          </h1>
          <p className="text-lg text-gray-600">
            Interactive testing interface for all date picker variants and features
          </p>
          <div className="mt-4 p-4 bg-blue-100 rounded-lg inline-block">
            <p className="text-blue-800 font-medium">
              Activity: {activityLog}
            </p>
          </div>
        </div>

        {/* Basic controlled */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Basic, Controlled</h2>
          <div className="max-w-xs">
            <DatePicker
              label="Event date"
              value={basicDate}
              onChange={(date) => {
                setBasicDate(date);
                logEvent(date ? `Selected ${date.toDateString()}` : 'Cleared');
              }}
            />
          </div>
        </section>

        {/* Uncontrolled with default */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Uncontrolled, with Default Value</h2>
          <div className="max-w-xs">
            <DatePicker
              label="Start date"
              defaultValue={new Date()}
              onChange={(date) => logEvent(`Start date changed: ${date ? date.toDateString() : 'cleared'}`)}
            />
          </div>
        </section>

        {/* Min/max bounds */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Bounded Range (Next 30 Days Only)</h2>
          <div className="max-w-xs">
            <DatePicker
              label="Delivery date"
              minDate={today}
              maxDate={in30Days}
              helperText="Only the next 30 days are selectable"
            />
          </div>
        </section>

        {/* Custom disabledDates */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Custom Disabled Dates (No Weekends)</h2>
          <div className="max-w-xs">
            <DatePicker label="Appointment" disabledDates={isWeekend} helperText="Weekends are unavailable" />
          </div>
        </section>

        {/* Required + error */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Required, with Error</h2>
          <div className="max-w-xs">
            <DatePicker label="Date of birth" required error="Date of birth is required" clearable={false} />
          </div>
        </section>

        {/* Disabled */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Disabled</h2>
          <div className="max-w-xs">
            <DatePicker label="Locked date" defaultValue={new Date()} disabled />
          </div>
        </section>

        {/* Accessibility Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Accessibility Features</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>The trigger is a real <code>&lt;button&gt;</code> with <code>aria-haspopup="dialog"</code>/<code>aria-expanded</code>; the calendar itself uses <code>role="dialog"</code>.</p>
            <p>Today's date carries <code>aria-current="date"</code>, and the selected day carries <code>aria-pressed="true"</code>.</p>
            <p>Escape and an outside click both close the calendar without changing the current selection.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default DatePickerTest;
