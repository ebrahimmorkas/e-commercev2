import React, { useState } from 'react';
import Slider from './Slider';

/**
 * Interactive testing component for Slider
 * Demonstrates single-thumb and dual-thumb range mode, marks,
 * colors, steps, and disabled state
 */
const SliderTest = () => {
  const [volume, setVolume] = useState(40);
  const [priceRange, setPriceRange] = useState([200, 800]);
  const [rating, setRating] = useState(3);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Slider Component Test
          </h1>
          <p className="text-lg text-gray-600">
            Interactive testing interface for all slider variants and features
          </p>
        </div>

        {/* Basic single */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Single Value, with Live Display</h2>
          <div className="max-w-md">
            <Slider label="Volume" showValue value={volume} onChange={setVolume} />
          </div>
        </section>

        {/* Dual-thumb range */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Dual-Thumb Range</h2>
          <div className="max-w-md">
            <Slider
              range
              label="Price range"
              showValue
              min={0}
              max={1000}
              step={10}
              value={priceRange}
              onChange={setPriceRange}
            />
          </div>
        </section>

        {/* Marks */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">With Marks</h2>
          <div className="max-w-md">
            <Slider
              label="Rating"
              showValue
              min={1}
              max={5}
              step={1}
              value={rating}
              onChange={setRating}
              marks={[
                { value: 1, label: 'Poor' },
                { value: 3, label: 'Okay' },
                { value: 5, label: 'Great' },
              ]}
            />
          </div>
        </section>

        {/* Colors */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Colors</h2>
          <div className="max-w-md space-y-6">
            <Slider color="blue" defaultValue={50} />
            <Slider color="green" defaultValue={50} />
            <Slider color="red" defaultValue={50} />
            <Slider color="purple" defaultValue={50} />
          </div>
        </section>

        {/* Disabled */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Disabled</h2>
          <div className="max-w-md">
            <Slider label="Locked setting" showValue defaultValue={70} disabled />
          </div>
        </section>

        {/* Accessibility Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Accessibility Features</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>Built on native <code>&lt;input type="range"&gt;</code> elements, so keyboard arrow keys, Home/End, and screen reader value announcements all work out of the box.</p>
            <p>In range mode each thumb has its own descriptive <code>aria-label</code> (e.g. "Price range minimum" / "maximum").</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SliderTest;
