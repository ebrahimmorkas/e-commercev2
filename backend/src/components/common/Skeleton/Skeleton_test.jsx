import React, { useState } from 'react';
import Skeleton from './Skeleton';
import Card from '../Card';
import Button from '../Buttons';

/**
 * Interactive testing component for Skeleton
 * Demonstrates the text/circle/rect variants and composing them into
 * realistic loading states (a profile row, a card, a table row)
 */
const SkeletonTest = () => {
  const [loading, setLoading] = useState(true);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Skeleton Component Test
          </h1>
          <p className="text-lg text-gray-600">
            Interactive testing interface for all skeleton variants and features
          </p>
        </div>

        {/* Variants */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Variants</h2>
          <div className="space-y-6">
            <div>
              <p className="text-xs text-gray-500 mb-2">text (3 lines)</p>
              <Skeleton variant="text" lines={3} />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2">circle</p>
              <Skeleton variant="circle" height="3rem" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2">rect</p>
              <Skeleton variant="rect" height="8rem" />
            </div>
          </div>
        </section>

        {/* Composed: profile row */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Composed: Profile Row</h2>
          <div className="flex items-center gap-4 max-w-sm">
            <Skeleton variant="circle" height="3rem" />
            <div className="flex-1">
              <Skeleton variant="text" lines={2} />
            </div>
          </div>
        </section>

        {/* Composed: card */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Composed: Card</h2>
          <div className="max-w-sm">
            <Card variant="outlined">
              <Skeleton variant="rect" height="10rem" className="mb-4" />
              <Skeleton variant="text" lines={3} />
            </Card>
          </div>
        </section>

        {/* Toggle real content */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Toggle: Skeleton → Real Content</h2>
          <Button variant="outline" onClick={() => setLoading((l) => !l)} className="mb-4">
            {loading ? 'Show Content' : 'Show Skeleton'}
          </Button>
          <div className="max-w-md flex items-center gap-4">
            {loading ? (
              <>
                <Skeleton variant="circle" height="3rem" />
                <div className="flex-1">
                  <Skeleton variant="text" lines={2} />
                </div>
              </>
            ) : (
              <>
                <img
                  src="https://i.pravatar.cc/150?img=5"
                  alt="Sample user"
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <p className="font-medium text-gray-900">Aditi Sharma</p>
                  <p className="text-sm text-gray-500">Product Designer</p>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default SkeletonTest;
