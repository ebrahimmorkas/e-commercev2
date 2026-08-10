import React, { useState } from 'react';
import EmptyState from './EmptyState';
import Button from '../Buttons';
import Card from '../Card';
import Table from '../tables/table';

const SearchIcon = () => (
  <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const InboxIcon = () => (
  <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-4.586a1 1 0 00-.707.293l-1.414 1.414a1 1 0 01-.707.293h-2.172a1 1 0 01-.707-.293l-1.414-1.414A1 1 0 008.586 13H4" />
  </svg>
);

/**
 * Interactive testing component for EmptyState
 * Demonstrates sizes, custom icons, action buttons, and using it as
 * a custom Table emptyComponent
 */
const EmptyStateTest = () => {
  const [hasData, setHasData] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            EmptyState Component Test
          </h1>
          <p className="text-lg text-gray-600">
            Interactive testing interface for all empty-state variants and features
          </p>
        </div>

        {/* Sizes */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Sizes</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card variant="outlined" padding="none">
              <EmptyState size="sm" title="No results" description="Try a different search." />
            </Card>
            <Card variant="outlined" padding="none">
              <EmptyState size="md" title="No results" description="Try a different search." />
            </Card>
            <Card variant="outlined" padding="none">
              <EmptyState size="lg" title="No results" description="Try a different search." />
            </Card>
          </div>
        </section>

        {/* Custom icon + action */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Custom Icon &amp; Action</h2>
          <Card variant="outlined" padding="none">
            <EmptyState
              icon={<SearchIcon />}
              title="No search results"
              description="We couldn't find anything matching your filters. Try broadening your search."
              action={<Button variant="primary" size="sm">Clear filters</Button>}
            />
          </Card>
        </section>

        {/* Inbox-style empty state */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Inbox Zero Pattern</h2>
          <Card variant="outlined" padding="none">
            <EmptyState
              icon={<InboxIcon />}
              title="You're all caught up"
              description="No new notifications right now."
            />
          </Card>
        </section>

        {/* Table integration */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">As a Table's emptyComponent</h2>
          <p className="text-sm text-gray-600 mb-4">
            Table already accepts a custom <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">emptyComponent</code>{' '}
            — EmptyState drops right in.
          </p>
          <div className="flex items-center gap-3 mb-4">
            <Button variant="outline" size="sm" onClick={() => setHasData((v) => !v)}>
              {hasData ? 'Clear Data' : 'Add Sample Row'}
            </Button>
          </div>
          <Table
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'email', label: 'Email' },
            ]}
            data={hasData ? [{ id: 1, name: 'Jane Doe', email: 'jane@example.com' }] : []}
            emptyComponent={
              <EmptyState
                size="sm"
                icon={<InboxIcon />}
                title="No rows yet"
                description="Add a row to see it appear here."
                action={<Button variant="primary" size="sm" onClick={() => setHasData(true)}>Add Sample Row</Button>}
              />
            }
          />
        </section>
      </div>
    </div>
  );
};

export default EmptyStateTest;
