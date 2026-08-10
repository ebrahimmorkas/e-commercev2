import React, { useState } from 'react';
// import Table from './Table';
import Table from './table';
// import { ButtonTest } from '../Buttons/Button_test';
import Button from '../Buttons';

/**
 * Interactive testing component for Table
 * Demonstrates all features: columns, sorting, selection, actions,
 * custom renderers, pagination, and states
 */

const INITIAL_USERS = [
  { id: 1, name: 'Aditi Sharma', email: 'aditi.sharma@example.com', role: 'Admin', status: 'active', joined: '2023-01-14' },
  { id: 2, name: 'Rohan Mehta', email: 'rohan.mehta@example.com', role: 'Editor', status: 'active', joined: '2023-03-22' },
  { id: 3, name: 'Priya Nair', email: 'priya.nair@example.com', role: 'Viewer', status: 'inactive', joined: '2022-11-05' },
  { id: 4, name: 'Karan Verma', email: 'karan.verma@example.com', role: 'Editor', status: 'active', joined: '2023-06-18' },
  { id: 5, name: 'Sneha Iyer', email: 'sneha.iyer@example.com', role: 'Viewer', status: 'suspended', joined: '2022-08-30' },
  { id: 6, name: 'Arjun Kapoor', email: 'arjun.kapoor@example.com', role: 'Admin', status: 'active', joined: '2023-09-11' },
  { id: 7, name: 'Neha Joshi', email: 'neha.joshi@example.com', role: 'Viewer', status: 'inactive', joined: '2022-05-02' },
  { id: 8, name: 'Vikram Singh', email: 'vikram.singh@example.com', role: 'Editor', status: 'active', joined: '2023-02-27' },
];

const PRODUCTS = [
  { id: 'p1', name: 'Wireless Mouse', category: 'Accessories', price: 799, stock: 42 },
  { id: 'p2', name: 'Mechanical Keyboard', category: 'Accessories', price: 3499, stock: 15 },
  { id: 'p3', name: '27" Monitor', category: 'Displays', price: 15999, stock: 0 },
  { id: 'p4', name: 'USB-C Hub', category: 'Accessories', price: 1299, stock: 8 },
];

const statusStyles = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-600',
  suspended: 'bg-red-100 text-red-700',
};

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const TableTest = () => {
  const [users, setUsers] = useState(INITIAL_USERS);
  const [selected, setSelected] = useState([]);
  const [activityLog, setActivityLog] = useState('Interact with a table below to see events here.');
  const [isLoading, setIsLoading] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);

  const logEvent = (msg) => setActivityLog(msg);

  const toggleLoadingDemo = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 2000);
  };

  const resetUsers = () => {
    setUsers(INITIAL_USERS);
    setSelected([]);
    logEvent('Data reset to initial sample set');
  };

  // ---- Basic columns ----
  const basicColumns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' },
  ];

  // ---- Sortable columns ----
  const sortableColumns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'joined', label: 'Joined', sortable: true },
  ];

  // ---- Columns with custom cell renderer ----
  const statusColumns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'role', label: 'Role', sortable: true },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusStyles[row.status]}`}>
          {row.status}
        </span>
      ),
    },
  ];

  // ---- Product columns (price/stock formatting) ----
  const productColumns = [
    { key: 'name', label: 'Product', sortable: true },
    { key: 'category', label: 'Category', sortable: true },
    {
      key: 'price',
      label: 'Price',
      sortable: true,
      align: 'right',
      render: (row) => `₹${row.price.toLocaleString('en-IN')}`,
    },
    {
      key: 'stock',
      label: 'Stock',
      sortable: true,
      align: 'right',
      render: (row) =>
        row.stock === 0 ? (
          <span className="text-red-600 font-medium">Out of stock</span>
        ) : (
          <span>{row.stock} units</span>
        ),
    },
  ];

  // ---- Actions using the real Button component ----
  const singleAction = [
    {
      label: 'Edit',
      variant: 'outline',
      size: 'sm',
      icon: <EditIcon />,
      onClick: (row) => logEvent(`Edit clicked for ${row.name}`),
    },
  ];

  const multiActions = [
    {
      label: 'Edit',
      variant: 'outline',
      size: 'sm',
      icon: <EditIcon />,
      onClick: (row) => logEvent(`Edit clicked for ${row.name}`),
    },
    {
      label: 'Suspend',
      variant: 'warning',
      size: 'sm',
      show: (row) => row.status === 'active',
      onClick: (row) => {
        setUsers((prev) => prev.map((u) => (u.id === row.id ? { ...u, status: 'suspended' } : u)));
        logEvent(`Suspended ${row.name}`);
      },
    },
    {
      label: 'Delete',
      variant: 'danger',
      size: 'sm',
      icon: <TrashIcon />,
      onClick: (row) => {
        setUsers((prev) => prev.filter((u) => u.id !== row.id));
        logEvent(`Deleted ${row.name}`);
      },
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Table Component Test
          </h1>
          <p className="text-lg text-gray-600">
            Interactive testing interface for all table variants and features
          </p>
          <div className="mt-4 p-4 bg-blue-100 rounded-lg inline-block">
            <p className="text-blue-800 font-medium">
              Activity: {activityLog}
            </p>
          </div>
        </div>

        {/* Basic Table Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Basic Table</h2>
          <Table columns={basicColumns} data={users} />
        </section>

        {/* Sortable Columns Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Sortable Columns</h2>
          <p className="text-sm text-gray-600 mb-4">Click a header to sort. Click again to reverse, a third time to clear.</p>
          <Table columns={sortableColumns} data={users} />
        </section>

        {/* Custom Cell Renderers Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Custom Cell Renderers</h2>
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">Status badges</h3>
              <Table columns={statusColumns} data={users} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">Formatted price &amp; stock</h3>
              <Table columns={productColumns} data={PRODUCTS} />
            </div>
          </div>
        </section>

        {/* Row Actions Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Row Actions</h2>
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">Single action</h3>
              <Table
                columns={statusColumns}
                data={users}
                actions={singleAction}
                ActionButton={Button}
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">
                Multiple actions (conditional + destructive)
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                "Suspend" only appears for active users. "Delete" removes the row. Uses your real{' '}
                <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">Button</code> component
                via <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">ActionButton</code>.
              </p>
              <Table
                columns={statusColumns}
                data={users}
                actions={multiActions}
                ActionButton={Button}
              />
              <button
                onClick={resetUsers}
                className="mt-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg transition-colors text-sm"
              >
                Reset Data
              </button>
            </div>
          </div>
        </section>

        {/* Row Selection Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Row Selection</h2>
          <Table
            columns={statusColumns}
            data={users}
            selectable
            selectedKeys={selected}
            onSelectionChange={setSelected}
          />
          <p className="mt-4 text-sm text-gray-600">
            {selected.length > 0
              ? `${selected.length} row${selected.length > 1 ? 's' : ''} selected: ${selected.join(', ')}`
              : 'No rows selected'}
          </p>
        </section>

        {/* Pagination Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Pagination</h2>
          <p className="text-sm text-gray-600 mb-4">8 rows, paginated 3 per page.</p>
          <Table columns={sortableColumns} data={users} pageSize={3} />
        </section>

        {/* Style Variants Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Style Variants</h2>
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">Bordered + compact, no stripes</h3>
              <Table
                columns={basicColumns}
                data={users.slice(0, 4)}
                bordered
                compact
                striped={false}
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">No hover highlight</h3>
              <Table columns={basicColumns} data={users.slice(0, 4)} hoverable={false} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">Clickable rows</h3>
              <Table
                columns={basicColumns}
                data={users.slice(0, 4)}
                onRowClick={(row) => logEvent(`Row clicked: ${row.name}`)}
              />
            </div>
          </div>
        </section>

        {/* Loading & Empty States Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Loading &amp; Empty States</h2>
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">Loading</h3>
              <div className="flex flex-wrap gap-4 mb-4">
                <button
                  onClick={toggleLoadingDemo}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                >
                  Trigger 2s Loading State
                </button>
              </div>
              <Table columns={basicColumns} data={users.slice(0, 3)} loading={isLoading} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">Empty</h3>
              <div className="flex flex-wrap gap-4 mb-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showEmpty}
                    onChange={(e) => setShowEmpty(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Show empty state</span>
                </label>
              </div>
              <Table
                columns={basicColumns}
                data={showEmpty ? [] : users.slice(0, 3)}
                emptyMessage="No users found. Try adjusting your filters."
              />
            </div>
          </div>
        </section>

        {/* Combined Features Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Combined Features</h2>
          <p className="text-sm text-gray-600 mb-4">
            Sortable + selectable + actions + pagination + bordered, all together.
          </p>
          <Table
            columns={sortableColumns}
            data={users}
            actions={multiActions}
            ActionButton={Button}
            selectable
            selectedKeys={selected}
            onSelectionChange={setSelected}
            pageSize={4}
            bordered
          />
        </section>

        {/* Accessibility Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Accessibility Features</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>Sortable headers are keyboard-clickable and expose sort direction via a visual indicator.</p>
            <p>Selection checkboxes include descriptive aria-labels ("Select row N", "Select all rows").</p>
            <p>Invalid/error states on individual cells can be composed via custom column `render` functions.</p>
            <p>The table wrapper scrolls horizontally on narrow viewports instead of breaking layout.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default TableTest;