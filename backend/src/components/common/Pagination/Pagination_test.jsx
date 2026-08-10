import React, { useState } from 'react';
import Pagination from './Pagination';

/**
 * Interactive testing component for Pagination
 * Demonstrates numbered vs simple variant, sibling/boundary counts,
 * first/last jump buttons, sizes, and a totalItems/pageSize driven example
 */
const PaginationTest = () => {
  const [page1, setPage1] = useState(1);
  const [page2, setPage2] = useState(1);
  const [page3, setPage3] = useState(7);
  const [page4, setPage4] = useState(1);

  const TOTAL_ITEMS = 237;
  const PAGE_SIZE = 10;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Pagination Component Test
          </h1>
          <p className="text-lg text-gray-600">
            Interactive testing interface for all pagination variants and features
          </p>
        </div>

        {/* Numbered, small page count */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Numbered (Small Page Count)</h2>
          <Pagination currentPage={page1} totalPages={5} onPageChange={setPage1} />
          <p className="mt-4 text-sm text-gray-600">Current page: {page1}</p>
        </section>

        {/* Numbered with ellipsis + first/last */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Numbered with Ellipsis &amp; First/Last</h2>
          <Pagination
            currentPage={page3}
            totalPages={24}
            onPageChange={setPage3}
            showFirstLast
            siblingCount={1}
            boundaryCount={1}
          />
          <p className="mt-4 text-sm text-gray-600">Current page: {page3} of 24</p>
        </section>

        {/* Simple variant */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Simple Variant</h2>
          <p className="text-sm text-gray-600 mb-4">
            Just Previous/Next and a page count — the same footer style used inside the Table component.
          </p>
          <Pagination currentPage={page2} totalPages={8} onPageChange={setPage2} variant="simple" />
        </section>

        {/* Derived from totalItems + pageSize */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Derived from totalItems + pageSize</h2>
          <p className="text-sm text-gray-600 mb-4">
            {TOTAL_ITEMS} items at {PAGE_SIZE} per page — <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">totalPages</code> is computed automatically.
          </p>
          <Pagination
            currentPage={page4}
            totalItems={TOTAL_ITEMS}
            pageSize={PAGE_SIZE}
            onPageChange={setPage4}
            showFirstLast
          />
        </section>

        {/* Sizes */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Sizes</h2>
          <div className="space-y-4">
            <Pagination currentPage={2} totalPages={5} size="sm" onPageChange={() => {}} />
            <Pagination currentPage={2} totalPages={5} size="md" onPageChange={() => {}} />
            <Pagination currentPage={2} totalPages={5} size="lg" onPageChange={() => {}} />
          </div>
        </section>

        {/* Disabled */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Disabled</h2>
          <Pagination currentPage={3} totalPages={10} disabled onPageChange={() => {}} />
        </section>

        {/* Accessibility Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Accessibility Features</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>Wrapped in a <code>&lt;nav aria-label="Pagination"&gt;</code> landmark, and the active page button has <code>aria-current="page"</code>.</p>
            <p>Every navigation control (prev/next/first/last) has a descriptive <code>aria-label</code>.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default PaginationTest;
