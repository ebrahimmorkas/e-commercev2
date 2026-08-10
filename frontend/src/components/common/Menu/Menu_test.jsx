import React, { useState } from 'react';
import Menu from './Menu';
import Button from '../Buttons';

const KebabIcon = () => (
  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 8a2 2 0 100-4 2 2 0 000 4zm0 6a2 2 0 100-4 2 2 0 000 4zm0 6a2 2 0 100-4 2 2 0 000 4z" />
  </svg>
);

const EditIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const DuplicateIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

/**
 * Interactive testing component for Menu
 * Demonstrates kebab-menu trigger, alignment, icons, dividers,
 * danger items, disabled items, and per-row menus in a list
 */
const MenuTest = () => {
  const [activityLog, setActivityLog] = useState('Select a menu item below to see events here.');
  const logEvent = (msg) => setActivityLog(msg);

  const baseItems = [
    { key: 'edit', label: 'Edit', icon: <EditIcon />, onClick: () => logEvent('Edit selected') },
    { key: 'duplicate', label: 'Duplicate', icon: <DuplicateIcon />, onClick: () => logEvent('Duplicate selected') },
    { key: 'archive', label: 'Archive', disabled: true, onClick: () => logEvent('Archive selected') },
    { divider: true },
    { key: 'delete', label: 'Delete', icon: <TrashIcon />, danger: true, onClick: () => logEvent('Delete selected') },
  ];

  const rows = ['Invoice #1042', 'Invoice #1043', 'Invoice #1044'];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Menu Component Test
          </h1>
          <p className="text-lg text-gray-600">
            Interactive testing interface for the popover / action menu
          </p>
          <div className="mt-4 p-4 bg-blue-100 rounded-lg inline-block">
            <p className="text-blue-800 font-medium">
              Activity: {activityLog}
            </p>
          </div>
        </div>

        {/* Basic kebab menu */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Kebab Menu (Icons, Divider, Danger, Disabled)</h2>
          <Menu
            trigger={<Button isIconOnly ariaLabel="More options" variant="ghost"><KebabIcon /></Button>}
            items={baseItems}
          />
        </section>

        {/* Alignment */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Alignment</h2>
          <div className="flex justify-between max-w-md">
            <Menu
              align="left"
              trigger={<Button variant="outline" size="sm">Left-aligned</Button>}
              items={baseItems.filter((i) => !i.divider)}
            />
            <Menu
              align="right"
              trigger={<Button variant="outline" size="sm">Right-aligned</Button>}
              items={baseItems.filter((i) => !i.divider)}
            />
          </div>
        </section>

        {/* Per-row menus in a list (common real-world pattern) */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Per-Row Menus in a List</h2>
          <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg">
            {rows.map((row) => (
              <div key={row} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-gray-700">{row}</span>
                <Menu
                  align="right"
                  trigger={<Button isIconOnly ariaLabel={`Actions for ${row}`} variant="ghost" size="sm"><KebabIcon /></Button>}
                  items={[
                    { key: 'view', label: 'View', onClick: () => logEvent(`View "${row}"`) },
                    { key: 'download', label: 'Download PDF', onClick: () => logEvent(`Download "${row}"`) },
                    { divider: true },
                    { key: 'void', label: 'Void invoice', danger: true, onClick: () => logEvent(`Voided "${row}"`) },
                  ]}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Accessibility Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Accessibility Features</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>The trigger gets <code>aria-haspopup="menu"</code> and <code>aria-expanded</code> automatically; the panel uses <code>role="menu"</code>/<code>"menuitem"</code>.</p>
            <p>Arrow Up/Down move a highlighted selection, Enter/Space activates it, and Escape or an outside click closes the menu.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default MenuTest;
