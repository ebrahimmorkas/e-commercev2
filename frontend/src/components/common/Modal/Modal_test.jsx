import React, { useState } from 'react';
import Modal from './Modal';
import Button from '../Buttons';
import InputField from '../InputField';
import { validations } from '../../../utils/index';

/**
 * Interactive testing component for Modal
 * Demonstrates sizing, header/footer options, focus/scroll behavior,
 * and common real-world patterns (confirmation dialog, form-in-modal, full-screen)
 */
const ModalTest = () => {
  const [activityLog, setActivityLog] = useState('Interact with a modal below to see events here.');
  const logEvent = (msg) => setActivityLog(msg);

  // ---- Configurable live-preview modal ----
  const [previewOpen, setPreviewOpen] = useState(false);
  const [config, setConfig] = useState({
    title: 'Modal Title',
    size: 'md',
    closeOnOverlayClick: true,
    closeOnEsc: true,
    showCloseButton: true,
    hideHeader: false,
    centered: true,
    longContent: false,
    withFooter: true,
  });

  const handleConfigChange = (key, value) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  // ---- Confirmation dialog pattern ----
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [itemDeleted, setItemDeleted] = useState(false);

  // ---- Form-in-modal pattern ----
  const [formOpen, setFormOpen] = useState(false);
  const [formValues, setFormValues] = useState({ name: '', email: '' });

  // ---- Full-screen pattern ----
  const [fullScreenOpen, setFullScreenOpen] = useState(false);

  const closePreview = () => {
    setPreviewOpen(false);
    logEvent('Preview modal closed');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Modal Component Test
          </h1>
          <p className="text-lg text-gray-600">
            Interactive testing interface for all modal variants and features
          </p>
          <div className="mt-4 p-4 bg-blue-100 rounded-lg inline-block">
            <p className="text-blue-800 font-medium">
              Activity: {activityLog}
            </p>
          </div>
        </div>

        {/* Live Preview + Customization */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Live Preview &amp; Customization</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Trigger */}
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Adjust the controls on the right, then open the modal to see them applied.
              </p>
              <Button
                variant="primary"
                onClick={() => {
                  setPreviewOpen(true);
                  logEvent('Preview modal opened');
                }}
              >
                Open Configured Modal
              </Button>
            </div>

            {/* Controls */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                <input
                  type="text"
                  value={config.title}
                  onChange={(e) => handleConfigChange('title', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Size</label>
                <select
                  value={config.size}
                  onChange={(e) => handleConfigChange('size', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                  <option value="xl">Extra Large</option>
                  <option value="full">Full Screen</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  ['closeOnOverlayClick', 'Close on overlay click'],
                  ['closeOnEsc', 'Close on Esc key'],
                  ['showCloseButton', 'Show close button'],
                  ['hideHeader', 'Hide header'],
                  ['centered', 'Centered'],
                  ['longContent', 'Long scrollable content'],
                  ['withFooter', 'Show footer'],
                ].map(([key, labelText]) => (
                  <label key={key} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config[key]}
                      onChange={(e) => handleConfigChange(key, e.target.checked)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">{labelText}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <Modal
            isOpen={previewOpen}
            onClose={closePreview}
            title={config.title}
            size={config.size}
            closeOnOverlayClick={config.closeOnOverlayClick}
            closeOnEsc={config.closeOnEsc}
            showCloseButton={config.showCloseButton}
            hideHeader={config.hideHeader}
            centered={config.centered}
            footer={
              config.withFooter && (
                <>
                  <Button variant="ghost" onClick={closePreview}>
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={closePreview}>
                    Confirm
                  </Button>
                </>
              )
            }
          >
            {config.longContent ? (
              <div className="space-y-4">
                {Array.from({ length: 15 }).map((_, i) => (
                  <p key={i} className="text-gray-600">
                    Paragraph {i + 1}. This content is intentionally long to demonstrate that the
                    modal body scrolls independently while the header and footer stay fixed.
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">
                This is the modal body. Its content, size, and behavior are all driven by the
                controls on the left.
              </p>
            )}
          </Modal>
        </section>

        {/* Common Patterns */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Common Patterns</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Confirmation dialog */}
            <div className="p-4 border border-gray-200 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Confirmation Dialog</h3>
              <p className="text-sm text-gray-600 mb-4">
                Small, danger-styled modal pattern for destructive actions.
              </p>
              <Button
                variant="danger"
                onClick={() => {
                  setConfirmOpen(true);
                  setItemDeleted(false);
                }}
              >
                Delete Item
              </Button>
            </div>

            {/* Form in modal */}
            <div className="p-4 border border-gray-200 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Form Inside Modal</h3>
              <p className="text-sm text-gray-600 mb-4">
                Reuses the InputField component and its validators inside the modal body.
              </p>
              <Button variant="outline" onClick={() => setFormOpen(true)}>
                New Contact
              </Button>
            </div>

            {/* Full screen */}
            <div className="p-4 border border-gray-200 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Full-Screen Modal</h3>
              <p className="text-sm text-gray-600 mb-4">
                Uses <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">size="full"</code> for
                immersive content.
              </p>
              <Button variant="secondary" onClick={() => setFullScreenOpen(true)}>
                Open Full-Screen
              </Button>
            </div>
          </div>

          {/* Confirmation Modal */}
          <Modal
            isOpen={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            title="Delete item?"
            size="sm"
            footer={
              <>
                <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setConfirmOpen(false);
                    setItemDeleted(true);
                    logEvent('Item deleted via confirmation dialog');
                  }}
                >
                  Delete
                </Button>
              </>
            }
          >
            <p className="text-gray-600">
              This action cannot be undone. Are you sure you want to permanently delete this item?
            </p>
          </Modal>
          {itemDeleted && (
            <p className="mt-4 text-sm text-green-700 bg-green-50 inline-block px-3 py-1.5 rounded-lg">
              Item deleted.
            </p>
          )}

          {/* Form Modal */}
          <Modal
            isOpen={formOpen}
            onClose={() => setFormOpen(false)}
            title="New Contact"
            size="md"
            footer={
              <>
                <Button variant="ghost" onClick={() => setFormOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setFormOpen(false);
                    logEvent(`Contact saved: ${formValues.name || '(no name)'}`);
                  }}
                >
                  Save Contact
                </Button>
              </>
            }
          >
            <div className="space-y-4">
              <InputField
                label="Full Name"
                name="name"
                placeholder="Jane Doe"
                required
                value={formValues.name}
                onChange={(e) => setFormValues((prev) => ({ ...prev, name: e.target.value }))}
              />
              <InputField
                label="Email"
                name="email"
                type="email"
                placeholder="jane@example.com"
                required
                validations={[validations.email]}
                value={formValues.email}
                onChange={(e) => setFormValues((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
          </Modal>

          {/* Full-Screen Modal */}
          <Modal
            isOpen={fullScreenOpen}
            onClose={() => setFullScreenOpen(false)}
            title="Full-Screen Modal"
            size="full"
          >
            <p className="text-gray-600">
              Full-screen modals are useful for immersive flows like image previews, onboarding, or
              complex multi-step forms that need maximum space.
            </p>
          </Modal>
        </section>

        {/* No Header / Bare Modal */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Bare Modal (No Header)</h2>
          <p className="text-sm text-gray-600 mb-4">
            Use <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs">hideHeader</code> for fully
            custom content, e.g. an image lightbox.
          </p>
          <BareModalDemo />
        </section>

        {/* Accessibility Section */}
        <section className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Accessibility Features</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>Rendered via a React portal into <code>document.body</code>, so it's never clipped by a parent's overflow or z-index.</p>
            <p>Uses <code>role="dialog"</code> and <code>aria-modal="true"</code>, with <code>aria-labelledby</code> wired to the title when present.</p>
            <p>Focus moves into the modal on open and returns to the triggering element on close; Tab/Shift+Tab is trapped within the modal.</p>
            <p>Escape key and backdrop click both close the modal by default and can be disabled independently.</p>
            <p>Background scroll is locked while the modal is open.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

/**
 * Small standalone demo for the hideHeader / bare modal pattern
 */
const BareModalDemo = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open Bare Modal
      </Button>
      <Modal isOpen={open} onClose={() => setOpen(false)} hideHeader size="sm">
        <div className="text-center py-4">
          <p className="text-gray-800 font-medium mb-4">No header, fully custom body.</p>
          <Button variant="primary" onClick={() => setOpen(false)}>
            Got it
          </Button>
        </div>
      </Modal>
    </>
  );
};

export default ModalTest;
