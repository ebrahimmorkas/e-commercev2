import React, { useState } from 'react';
import Button from './Button';
// import { Button } from '@components/common/Buttons'; 

/**
 * Interactive testing component for Button
 * Demonstrates all features and variants
 */

const ButtonTest = () => {
  const [loadingStates, setLoadingStates] = useState({});
  const [clickCount, setClickCount] = useState(0);

  const handleLoadingDemo = (buttonId) => {
    setLoadingStates({ ...loadingStates, [buttonId]: true });
    setTimeout(() => {
      setLoadingStates({ ...loadingStates, [buttonId]: false });
    }, 2000);
  };

  const handleClick = () => {
    setClickCount(clickCount + 1);
  };

  // Sample icons (you can replace with actual icon library)
  const PlusIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );

  const TrashIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /> 
    </svg>
  );

  const DownloadIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );

  const HeartIcon = () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Button Component Test
          </h1>
          <p className="text-lg text-gray-600">
            Interactive testing interface for all button variants and features
          </p>
          <div className="mt-4 p-4 bg-blue-100 rounded-lg inline-block">
            <p className="text-blue-800 font-medium">
              Click Count: {clickCount}
            </p>
          </div>
        </div>

        {/* Variants Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Button Variants</h2>
          <div className="flex flex-wrap gap-4">
            <Button variant="primary" onClick={handleClick}>
              Primary Button
            </Button>
            <Button variant="secondary" onClick={handleClick}>
              Secondary Button
            </Button>
            <Button variant="outline" onClick={handleClick}>
              Outline Button
            </Button>
            <Button variant="ghost" onClick={handleClick}>
              Ghost Button
            </Button>
            <Button variant="danger" onClick={handleClick}>
              Danger Button
            </Button>
            <Button variant="success" onClick={handleClick}>
              Success Button
            </Button>
            <Button variant="warning" onClick={handleClick}>
              Warning Button
            </Button>
          </div>
        </section>

        {/* Sizes Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Button Sizes</h2>
          <div className="flex flex-wrap items-center gap-4">
            <Button size="xs" onClick={handleClick}>
              Extra Small
            </Button>
            <Button size="sm" onClick={handleClick}>
              Small
            </Button>
            <Button size="md" onClick={handleClick}>
              Medium
            </Button>
            <Button size="lg" onClick={handleClick}>
              Large
            </Button>
            <Button size="xl" onClick={handleClick}>
              Extra Large
            </Button>
          </div>
        </section>

        {/* Shapes Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Button Shapes</h2>
          <div className="flex flex-wrap gap-4">
            <Button shape="rounded" onClick={handleClick}>
              Rounded (Default)
            </Button>
            <Button shape="square" onClick={handleClick}>
              Square
            </Button>
            <Button shape="pill" onClick={handleClick}>
              Pill
            </Button>
          </div>
        </section>

        {/* With Icons Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Buttons with Icons</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">Left Icon</h3>
              <div className="flex flex-wrap gap-4">
                <Button leftIcon={<PlusIcon />} onClick={handleClick}>
                  Add Item
                </Button>
                <Button variant="danger" leftIcon={<TrashIcon />} onClick={handleClick}>
                  Delete
                </Button>
                <Button variant="success" leftIcon={<DownloadIcon />} onClick={handleClick}>
                  Download
                </Button>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">Right Icon</h3>
              <div className="flex flex-wrap gap-4">
                <Button rightIcon={<PlusIcon />} onClick={handleClick}>
                  Create New
                </Button>
                <Button variant="outline" rightIcon={<DownloadIcon />} onClick={handleClick}>
                  Export
                </Button>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">Icon Only</h3>
              <div className="flex flex-wrap gap-4">
                <Button isIconOnly ariaLabel="Add" onClick={handleClick}>
                  <PlusIcon />
                </Button>
                <Button isIconOnly variant="danger" ariaLabel="Delete" onClick={handleClick}>
                  <TrashIcon />
                </Button>
                <Button isIconOnly variant="outline" ariaLabel="Like" shape="pill" onClick={handleClick}>
                  <HeartIcon />
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Loading States Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Loading States</h2>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <Button
                loading={loadingStates.btn1}
                onClick={() => handleLoadingDemo('btn1')}
              >
                Click to Load
              </Button>
              <Button
                variant="success"
                loading={loadingStates.btn2}
                loadingText="Saving..."
                onClick={() => handleLoadingDemo('btn2')}
              >
                Save Changes
              </Button>
              <Button
                variant="outline"
                loading={loadingStates.btn3}
                loadingText="Processing..."
                onClick={() => handleLoadingDemo('btn3')}
              >
                Process
              </Button>
            </div>
            <p className="text-sm text-gray-600">
              Click buttons above to see 2-second loading state
            </p>
          </div>
        </section>

        {/* Disabled States Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Disabled States</h2>
          <div className="flex flex-wrap gap-4">
            <Button disabled>Disabled Primary</Button>
            <Button variant="secondary" disabled>
              Disabled Secondary
            </Button>
            <Button variant="outline" disabled>
              Disabled Outline
            </Button>
            <Button variant="danger" disabled>
              Disabled Danger
            </Button>
          </div>
        </section>

        {/* Full Width Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Full Width Buttons</h2>
          <div className="space-y-4">
            <Button fullWidth onClick={handleClick}>
              Full Width Primary
            </Button>
            <Button fullWidth variant="outline" onClick={handleClick}>
              Full Width Outline
            </Button>
            <Button fullWidth variant="success" leftIcon={<PlusIcon />} onClick={handleClick}>
              Full Width with Icon
            </Button>
          </div>
        </section>

        {/* Button Types Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Button Types in Form</h2>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              alert('Form submitted!');
            }}
          >
            <div>
              <input
                type="text"
                placeholder="Enter some text..."
                className="px-4 py-2 border rounded-lg w-full"
              />
            </div>
            <div className="flex gap-4">
              <Button type="submit" variant="success">
                Submit Form
              </Button>
              <Button type="reset" variant="secondary">
                Reset Form
              </Button>
              <Button type="button" variant="outline" onClick={() => alert('Regular button')}>
                Regular Button
              </Button>
            </div>
          </form>
        </section>

        {/* Combined Features Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Combined Features</h2>
          <div className="flex flex-wrap gap-4">
            <Button
              size="lg"
              shape="pill"
              leftIcon={<PlusIcon />}
              onClick={handleClick}
            >
              Large Pill with Icon
            </Button>
            <Button
              size="sm"
              variant="danger"
              shape="pill"
              rightIcon={<TrashIcon />}
              onClick={handleClick}
            >
              Small Danger Pill
            </Button>
            <Button
              size="xl"
              variant="success"
              fullWidth
              leftIcon={<DownloadIcon />}
              onClick={handleClick}
            >
              Extra Large Full Width Success
            </Button>
          </div>
        </section>

        {/* Custom Styling Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Custom Styling</h2>
          <div className="flex flex-wrap gap-4">
            <Button
              className="shadow-lg hover:shadow-xl"
              onClick={handleClick}
            >
              Custom Shadow
            </Button>
            <Button
              className="font-bold uppercase tracking-wider"
              variant="outline"
              onClick={handleClick}
            >
              Custom Typography
            </Button>
            <Button
              className="border-4 border-purple-500"
              variant="ghost"
              onClick={handleClick}
            >
              Custom Border
            </Button>
          </div>
        </section>

        {/* Accessibility Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Accessibility Features</h2>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <Button isIconOnly ariaLabel="Add new item">
                <PlusIcon />
              </Button>
              <Button isIconOnly variant="danger" ariaLabel="Delete selected items">
                <TrashIcon />
              </Button>
            </div>
            <p className="text-sm text-gray-600">
              Icon-only buttons include proper aria-label for screen readers
            </p>
            <p className="text-sm text-gray-600">
              Loading buttons include aria-busy attribute
            </p>
            <p className="text-sm text-gray-600">
              All buttons support keyboard navigation and focus states
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ButtonTest;