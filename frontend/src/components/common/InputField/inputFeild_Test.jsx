import React, { useState } from 'react';
import InputField from '.';
import { validations } from '../../../utils/index';

/**
 * Real-time InputField Component Tester
 * Interactive playground to test and customize the InputField UI
 */
const InputFieldTest = () => {
  // Test input value
  const [testValue, setTestValue] = useState('');

  // UI Customization Controls
  const [config, setConfig] = useState({
    // Basic props
    type: 'text',
    placeholder: 'Enter text here...',
    label: 'Test Input Field',
    disabled: false,
    required: false,
    showError: true,
    
    // Validation props
    minLength: null,
    maxLength: null,
    validationType: 'none', // none, email, username, password, phone
    
    // Styling options
    borderColor: 'blue',
    borderWidth: '1',
    roundness: 'lg',
    padding: '4',
    fontSize: 'base',
    labelSize: 'sm',
  });

  const handleConfigChange = (key, value) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Get validation function based on selected type
  const getValidations = () => {
    switch(config.validationType) {
      case 'email': return [validations.email];
      case 'username': return [validations.username];
      case 'password': return [validations.mediumPassword];
      case 'phone': return [validations.phoneUS];
      default: return [];
    }
  };

  // Build custom className based on config
  const getCustomClasses = () => {
    const classes = [];
    
    // Border
    classes.push(`border-${config.borderWidth}`);
    
    // Rounded corners
    classes.push(`rounded-${config.roundness}`);
    
    // Padding
    classes.push(`px-${config.padding} py-${parseInt(config.padding) / 2}`);
    
    // Font size
    classes.push(`text-${config.fontSize}`);
    
    return classes.join(' ');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            InputField Component Tester
          </h1>
          <p className="text-gray-600">
            Customize and test your InputField component in real-time
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel - Live Preview */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="mb-6 pb-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800 mb-1">
                Live Preview
              </h2>
              <p className="text-sm text-gray-500">
                Test your component here
              </p>
            </div>

            {/* The Test Input Field */}
            <div className="space-y-6">
              <InputField
                type={config.type}
                placeholder={config.placeholder}
                label={config.label}
                name="testInput"
                value={testValue}
                onChange={(e) => setTestValue(e.target.value)}
                disabled={config.disabled}
                required={config.required}
                showError={config.showError}
                minLength={config.minLength}
                maxLength={config.maxLength}
                validations={getValidations()}
                className={`w-full ${getCustomClasses()}`}
              />

              {/* Current Value Display */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  Current Value:
                </p>
                <code className="text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded">
                  {testValue || '(empty)'}
                </code>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setTestValue('')}
                  className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={() => setTestValue('Sample Text')}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Fill Sample
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel - Customization Controls */}
          <div className="bg-white rounded-xl shadow-lg p-8 space-y-6">
            <div className="mb-6 pb-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800 mb-1">
                Customization
              </h2>
              <p className="text-sm text-gray-500">
                Adjust properties to see changes
              </p>
            </div>

            {/* Basic Properties */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">Basic Properties</h3>
              
              {/* Input Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Input Type
                </label>
                <select
                  value={config.type}
                  onChange={(e) => handleConfigChange('type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="text">Text</option>
                  <option value="password">Password</option>
                  <option value="email">Email</option>
                  <option value="number">Number</option>
                  <option value="tel">Phone</option>
                  <option value="url">URL</option>
                </select>
              </div>

              {/* Placeholder */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Placeholder
                </label>
                <input
                  type="text"
                  value={config.placeholder}
                  onChange={(e) => handleConfigChange('placeholder', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Label */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Label Text
                </label>
                <input
                  type="text"
                  value={config.label}
                  onChange={(e) => handleConfigChange('label', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Checkboxes */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.disabled}
                    onChange={(e) => handleConfigChange('disabled', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Disabled</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.required}
                    onChange={(e) => handleConfigChange('required', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Required</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showError}
                    onChange={(e) => handleConfigChange('showError', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Show Error Messages</span>
                </label>
              </div>
            </div>

            {/* Validation */}
            <div className="space-y-4 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Validation</h3>
              
              {/* Validation Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Validation Type
                </label>
                <select
                  value={config.validationType}
                  onChange={(e) => handleConfigChange('validationType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="none">None</option>
                  <option value="email">Email</option>
                  <option value="username">Username</option>
                  <option value="password">Password (Medium)</option>
                  <option value="phone">Phone (US)</option>
                </select>
              </div>

              {/* Min Length */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Min Length (optional)
                </label>
                <input
                  type="number"
                  value={config.minLength || ''}
                  onChange={(e) => handleConfigChange('minLength', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="No minimum"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Max Length */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Length (optional)
                </label>
                <input
                  type="number"
                  value={config.maxLength || ''}
                  onChange={(e) => handleConfigChange('maxLength', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="No maximum"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Styling */}
            <div className="space-y-4 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Styling</h3>
              
              {/* Border Roundness */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Border Radius
                </label>
                <select
                  value={config.roundness}
                  onChange={(e) => handleConfigChange('roundness', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="none">None</option>
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                  <option value="xl">Extra Large</option>
                  <option value="full">Full</option>
                </select>
              </div>

              {/* Padding */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Padding Size
                </label>
                <select
                  value={config.padding}
                  onChange={(e) => handleConfigChange('padding', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="2">Small</option>
                  <option value="3">Medium</option>
                  <option value="4">Large</option>
                  <option value="6">Extra Large</option>
                </select>
              </div>

              {/* Font Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Font Size
                </label>
                <select
                  value={config.fontSize}
                  onChange={(e) => handleConfigChange('fontSize', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="xs">Extra Small</option>
                  <option value="sm">Small</option>
                  <option value="base">Base</option>
                  <option value="lg">Large</option>
                  <option value="xl">Extra Large</option>
                </select>
              </div>
            </div>

            {/* Reset Button */}
            <div className="pt-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setConfig({
                    type: 'text',
                    placeholder: 'Enter text here...',
                    label: 'Test Input Field',
                    disabled: false,
                    required: false,
                    showError: true,
                    minLength: null,
                    maxLength: null,
                    validationType: 'none',
                    borderColor: 'blue',
                    borderWidth: '1',
                    roundness: 'lg',
                    padding: '4',
                    fontSize: 'base',
                    labelSize: 'sm',
                  });
                  setTestValue('');
                }}
                className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
              >
                Reset All Settings
              </button>
            </div>
          </div>
        </div>

        {/* Usage Guide */}
        <div className="mt-8 bg-white rounded-xl shadow-lg p-8">
          <h3 className="text-xl font-bold text-gray-800 mb-4">
            How to Use This Tester
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-gray-600">
            <div>
              <div className="font-semibold text-gray-800 mb-2">1. Interact</div>
              <p>Type in the input field on the left to test real-time validation and behavior</p>
            </div>
            <div>
              <div className="font-semibold text-gray-800 mb-2">2. Customize</div>
              <p>Use the controls on the right to change properties, validation, and styling</p>
            </div>
            <div>
              <div className="font-semibold text-gray-800 mb-2">3. Test</div>
              <p>Try different combinations to see how your component behaves in various scenarios</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InputFieldTest;