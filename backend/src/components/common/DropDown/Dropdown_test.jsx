import React, { useState } from 'react';
import Dropdown from './Dropdown';

/**
 * Interactive testing component for Dropdown
 * Demonstrates all features and variants
 */
const DropdownTest = () => {
  // Sample data
  const countries = [
    { value: 'us', label: 'United States' },
    { value: 'uk', label: 'United Kingdom' },
    { value: 'ca', label: 'Canada' },
    { value: 'au', label: 'Australia' },
    { value: 'de', label: 'Germany' },
    { value: 'fr', label: 'France' },
    { value: 'jp', label: 'Japan' },
    { value: 'in', label: 'India' },
  ];

  const fruits = [
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana' },
    { value: 'orange', label: 'Orange' },
    { value: 'grape', label: 'Grape' },
    { value: 'mango', label: 'Mango' },
    { value: 'strawberry', label: 'Strawberry' },
  ];

  const priorities = [
    { value: 'low', label: 'Low Priority' },
    { value: 'medium', label: 'Medium Priority' },
    { value: 'high', label: 'High Priority' },
    { value: 'urgent', label: 'Urgent', disabled: true },
  ];

  // State for controlled components
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedFruits, setSelectedFruits] = useState([]);
  const [selectedPriority, setSelectedPriority] = useState('medium');
  
  // Sample icons
  const GlobeIcon = () => (
    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  const StarIcon = () => (
    <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Dropdown Component Test
          </h1>
          <p className="text-lg text-gray-600">
            Interactive testing interface for all dropdown variants and features
          </p>
        </div>

        {/* Basic Dropdown */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Basic Dropdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Default</h3>
              <Dropdown
                options={countries}
                placeholder="Select a country"
                onChange={(value, option) => console.log('Selected:', value, option)}
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">With Label</h3>
              <Dropdown
                label="Country"
                options={countries}
                placeholder="Select a country"
                onChange={(value) => console.log('Selected:', value)}
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Required Field</h3>
              <Dropdown
                label="Country"
                options={countries}
                placeholder="Select a country"
                required
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">With Default Value</h3>
              <Dropdown
                label="Country"
                options={countries}
                defaultValue="us"
              />
            </div>
          </div>
        </section>

        {/* Sizes */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Sizes</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Small</h3>
              <Dropdown
                size="sm"
                options={fruits}
                placeholder="Select a fruit"
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Medium (Default)</h3>
              <Dropdown
                size="md"
                options={fruits}
                placeholder="Select a fruit"
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Large</h3>
              <Dropdown
                size="lg"
                options={fruits}
                placeholder="Select a fruit"
              />
            </div>
          </div>
        </section>

        {/* Variants */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Variants</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Default</h3>
              <Dropdown
                variant="default"
                options={fruits}
                placeholder="Select a fruit"
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Bordered</h3>
              <Dropdown
                variant="bordered"
                options={fruits}
                placeholder="Select a fruit"
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Filled</h3>
              <Dropdown
                variant="filled"
                options={fruits}
                placeholder="Select a fruit"
              />
            </div>
          </div>
        </section>

        {/* With Icons */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">With Icons</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Left Icon</h3>
              <Dropdown
                leftIcon={<GlobeIcon />}
                options={countries}
                placeholder="Select a country"
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">With Label & Icon</h3>
              <Dropdown
                label="Favorite"
                leftIcon={<StarIcon />}
                options={fruits}
                placeholder="Select your favorite fruit"
              />
            </div>
          </div>
        </section>

        {/* Searchable */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Searchable Dropdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Search Enabled</h3>
              <Dropdown
                label="Country"
                options={countries}
                placeholder="Search and select..."
                searchable
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Large List with Search</h3>
              <Dropdown
                label="Select Item"
                options={[
                  ...countries,
                  { value: 'it', label: 'Italy' },
                  { value: 'es', label: 'Spain' },
                  { value: 'br', label: 'Brazil' },
                  { value: 'mx', label: 'Mexico' },
                  { value: 'cn', label: 'China' },
                ]}
                placeholder="Search countries..."
                searchable
                maxHeight={250}
              />
            </div>
          </div>
        </section>

        {/* Clearable */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Clearable Dropdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">With Clear Button</h3>
              <Dropdown
                label="Country"
                options={countries}
                placeholder="Select a country"
                clearable
                defaultValue="us"
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Clearable + Searchable</h3>
              <Dropdown
                label="Fruit"
                options={fruits}
                placeholder="Select a fruit"
                clearable
                searchable
                defaultValue="apple"
              />
            </div>
          </div>
        </section>

        {/* Multiple Selection */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Multiple Selection</h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Select Multiple Fruits</h3>
              <Dropdown
                label="Fruits"
                options={fruits}
                placeholder="Select fruits..."
                multiple
                value={selectedFruits}
                onChange={(value) => {
                  setSelectedFruits(value);
                  console.log('Selected fruits:', value);
                }}
              />
              <p className="mt-2 text-sm text-gray-600">
                Selected: {selectedFruits.length > 0 ? selectedFruits.join(', ') : 'None'}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Multiple + Searchable + Clearable</h3>
              <Dropdown
                label="Countries"
                options={countries}
                placeholder="Select countries..."
                multiple
                searchable
                clearable
              />
            </div>
          </div>
        </section>

        {/* Controlled Component */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Controlled Component</h2>
          <div className="space-y-4">
            <div>
              <Dropdown
                label="Country (Controlled)"
                options={countries}
                placeholder="Select a country"
                value={selectedCountry}
                onChange={(value) => setSelectedCountry(value)}
                clearable
              />
              <p className="mt-2 text-sm text-gray-600">
                Selected value: <span className="font-semibold">{selectedCountry || 'None'}</span>
              </p>
              <button
                onClick={() => setSelectedCountry('ca')}
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Set to Canada
              </button>
            </div>
          </div>
        </section>

        {/* With Helper Text & Errors */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Helper Text & Errors</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">With Helper Text</h3>
              <Dropdown
                label="Priority"
                options={priorities}
                placeholder="Select priority"
                helperText="Choose the task priority level"
                defaultValue="medium"
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">With Error</h3>
              <Dropdown
                label="Country"
                options={countries}
                placeholder="Select a country"
                error="This field is required"
                required
              />
            </div>
          </div>
        </section>

        {/* Disabled State */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Disabled State</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Disabled Dropdown</h3>
              <Dropdown
                label="Country"
                options={countries}
                placeholder="Select a country"
                disabled
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Disabled with Value</h3>
              <Dropdown
                label="Country"
                options={countries}
                disabled
                defaultValue="us"
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Disabled Options</h3>
              <Dropdown
                label="Priority"
                options={priorities}
                placeholder="Select priority"
                helperText="Some options are disabled"
              />
            </div>
          </div>
        </section>

        {/* Position */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Dropdown Position</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Bottom (Default)</h3>
              <Dropdown
                label="Country"
                options={countries}
                placeholder="Opens downward"
                position="bottom"
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Top</h3>
              <Dropdown
                label="Country"
                options={countries}
                placeholder="Opens upward"
                position="top"
              />
            </div>
          </div>
        </section>

        {/* Form Example */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">In Form Context</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              alert(`Selected Priority: ${selectedPriority}`);
            }}
            className="space-y-6 max-w-md"
          >
            <Dropdown
              label="Task Priority"
              options={priorities}
              placeholder="Select priority"
              value={selectedPriority}
              onChange={(value) => setSelectedPriority(value)}
              required
              helperText="This determines task urgency"
            />

            <button
              type="submit"
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Submit Form
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};

export default DropdownTest;