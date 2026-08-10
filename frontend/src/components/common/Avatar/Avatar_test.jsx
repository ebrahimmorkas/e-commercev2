import React from 'react';
import Avatar, { AvatarGroup } from './Avatar';

/**
 * Interactive testing component for Avatar / AvatarGroup
 * Demonstrates image/initials/icon fallback, sizes, shapes,
 * status dots, and grouped/overlapping avatars
 */
const AvatarTest = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Avatar Component Test
          </h1>
          <p className="text-lg text-gray-600">
            Interactive testing interface for all avatar variants and features
          </p>
        </div>

        {/* Fallback chain */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Image → Initials → Icon Fallback</h2>
          <div className="flex flex-wrap items-center gap-6">
            <div className="text-center">
              <Avatar src="https://i.pravatar.cc/150?img=12" name="Aditi Sharma" size="lg" />
              <p className="text-xs text-gray-500 mt-2">Image</p>
            </div>
            <div className="text-center">
              <Avatar src="https://broken-url-example.invalid/none.jpg" name="Rohan Mehta" size="lg" />
              <p className="text-xs text-gray-500 mt-2">Broken image → initials</p>
            </div>
            <div className="text-center">
              <Avatar name="Priya Nair" size="lg" />
              <p className="text-xs text-gray-500 mt-2">Initials only</p>
            </div>
            <div className="text-center">
              <Avatar size="lg" />
              <p className="text-xs text-gray-500 mt-2">No name/image → icon</p>
            </div>
          </div>
        </section>

        {/* Sizes */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Sizes</h2>
          <div className="flex flex-wrap items-end gap-4">
            <Avatar name="Karan Verma" size="xs" />
            <Avatar name="Karan Verma" size="sm" />
            <Avatar name="Karan Verma" size="md" />
            <Avatar name="Karan Verma" size="lg" />
            <Avatar name="Karan Verma" size="xl" />
            <Avatar name="Karan Verma" size="2xl" />
          </div>
        </section>

        {/* Shapes */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Shapes</h2>
          <div className="flex flex-wrap gap-6">
            <Avatar name="Sneha Iyer" size="lg" shape="circle" />
            <Avatar name="Sneha Iyer" size="lg" shape="square" />
          </div>
        </section>

        {/* Status dots */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Status Dots</h2>
          <div className="flex flex-wrap gap-6">
            <Avatar name="Arjun Kapoor" size="lg" status="online" />
            <Avatar name="Neha Joshi" size="lg" status="away" />
            <Avatar name="Vikram Singh" size="lg" status="busy" />
            <Avatar name="Divya Rao" size="lg" status="offline" />
          </div>
        </section>

        {/* Clickable */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Clickable</h2>
          <Avatar name="Jane Doe" size="lg" onClick={() => alert('Avatar clicked')} />
        </section>

        {/* Group */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Avatar Group</h2>
          <p className="text-sm text-gray-600 mb-4">Overlapping stack, collapsing extras into a "+N" bubble.</p>
          <AvatarGroup max={4}>
            <Avatar name="Aditi Sharma" />
            <Avatar name="Rohan Mehta" />
            <Avatar name="Priya Nair" />
            <Avatar name="Karan Verma" />
            <Avatar name="Sneha Iyer" />
            <Avatar name="Arjun Kapoor" />
          </AvatarGroup>
        </section>

        {/* Accessibility Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Accessibility Features</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>Broken image URLs automatically fall back to initials rather than showing a broken-image icon.</p>
            <p>Clickable avatars get <code>role="button"</code> and <code>tabIndex=0</code>; the initials color is deterministic per name so the same person always gets the same color.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AvatarTest;
