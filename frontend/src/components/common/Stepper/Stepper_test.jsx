import React, { useState } from 'react';
import Stepper from './Stepper';
import Button from '../Buttons';

/**
 * Interactive testing component for Stepper
 * Demonstrates horizontal/vertical layout, a driven checkout-style flow,
 * and clickable/non-linear navigation
 */
const StepperTest = () => {
  const checkoutSteps = [
    { key: 'cart', label: 'Cart' },
    { key: 'shipping', label: 'Shipping' },
    { key: 'payment', label: 'Payment' },
    { key: 'review', label: 'Review' },
  ];

  const onboardingSteps = [
    { key: 'account', label: 'Create account', description: 'Set your email and password' },
    { key: 'profile', label: 'Complete profile', description: 'Tell us about yourself' },
    { key: 'verify', label: 'Verify email', description: 'Confirm your email address' },
    { key: 'done', label: 'All set', description: 'Start using the app' },
  ];

  const [checkoutStep, setCheckoutStep] = useState(0);
  const [clickableStep, setClickableStep] = useState(1);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Stepper Component Test
          </h1>
          <p className="text-lg text-gray-600">
            Interactive testing interface for all stepper variants and features
          </p>
        </div>

        {/* Driven horizontal flow */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Horizontal — Driven Checkout Flow</h2>
          <Stepper steps={checkoutSteps} currentStep={checkoutStep} className="mb-8" />
          <div className="flex gap-3">
            <Button
              variant="ghost"
              disabled={checkoutStep === 0}
              onClick={() => setCheckoutStep((s) => Math.max(0, s - 1))}
            >
              Back
            </Button>
            <Button
              variant="primary"
              disabled={checkoutStep === checkoutSteps.length - 1}
              onClick={() => setCheckoutStep((s) => Math.min(checkoutSteps.length - 1, s + 1))}
            >
              {checkoutStep === checkoutSteps.length - 1 ? 'Complete' : 'Next'}
            </Button>
          </div>
        </section>

        {/* Clickable, non-linear */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Horizontal — Clickable (Non-Linear)</h2>
          <p className="text-sm text-gray-600 mb-6">Click any step circle to jump directly to it.</p>
          <Stepper steps={checkoutSteps} currentStep={clickableStep} onStepClick={setClickableStep} />
        </section>

        {/* Vertical with descriptions */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Vertical, with Descriptions</h2>
          <div className="max-w-md">
            <Stepper steps={onboardingSteps} currentStep={1} variant="vertical" />
          </div>
        </section>

        {/* Accessibility Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Accessibility Features</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>The active step's circle button carries <code>aria-current="step"</code>.</p>
            <p>Step circles are only interactive (real, focusable <code>&lt;button&gt;</code>) when <code>onStepClick</code> is provided — otherwise they're inert indicators.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default StepperTest;
