import { useMemo, useState } from 'react';
import Card from '../../../../components/common/Card';
import Table from '../../../../components/common/tables';
import Button from '../../../../components/common/Buttons';
import Badge from '../../../../components/common/Badge';
import Switch from '../../../../components/common/Switch';
import Avatar from '../../../../components/common/Avatar';
import Modal from '../../../../components/common/Modal';
import EmptyState from '../../../../components/common/EmptyState';
import { useBanners } from '../hooks/useBanners';
import { useBannerLookups } from '../hooks/useBannerLookups';
import BannerForm from '../components/BannerForm';
import theme from '../theme/theme';

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);
const PencilIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);
const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);
const PlayIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M6 4l10 6-10 6V4z" clipRule="evenodd" />
  </svg>
);

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const BannersPage = () => {
  const { banners, loading, error, mutating, createBanner, editBanner, removeBanner, toggleStatus } = useBanners();
  const { companyMaster } = useBannerLookups();

  const [formModal, setFormModal] = useState({ open: false, mode: 'add', banner: null });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const openAddModal = () => setFormModal({ open: true, mode: 'add', banner: null });
  const openEditModal = (banner) => setFormModal({ open: true, mode: 'edit', banner });
  const closeFormModal = () => setFormModal({ open: false, mode: 'add', banner: null });

  const handleFormSubmit = async (fields, media) => {
    const success =
      formModal.mode === 'edit'
        ? await editBanner(formModal.banner._id, fields, media)
        : await createBanner(fields, media);
    if (success) closeFormModal();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const success = await removeBanner(deleteTarget._id);
    if (success) setDeleteTarget(null);
  };

  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: 'Banner',
        render: (row) => (
          <div className="flex items-center gap-3">
            {row.image ? (
              <Avatar src={row.image} name={row.name} shape="square" size="sm" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                <PlayIcon />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-medium ${theme.text.heading}`}>{row.name}</span>
                {row.isDefault && (
                  <Badge variant={theme.badge.default} size="sm">
                    Default
                  </Badge>
                )}
              </div>
              <Badge variant={row.image ? theme.badge.image : theme.badge.video} size="sm">
                {row.image ? 'Image' : 'Video'}
              </Badge>
            </div>
          </div>
        ),
      },
      { key: 'startDate', label: 'Start Date', render: (row) => formatDate(row.startDate) },
      { key: 'endDate', label: 'End Date', render: (row) => formatDate(row.endDate) },
      { key: 'precedence', label: 'Precedence', align: 'center' },
      {
        key: 'status',
        label: 'Status',
        align: 'center',
        render: (row) => (
          <div className="flex items-center justify-center">
            <Switch
              checked={row.status === 'A'}
              onChange={() => toggleStatus(row)}
              disabled={mutating}
              color={theme.switch.color}
              aria-label={`Toggle status for ${row.name}`}
            />
          </div>
        ),
      },
    ],
    [mutating, toggleStatus]
  );

  const actions = [
    {
      label: 'Edit',
      icon: <PencilIcon />,
      variant: theme.button.secondary,
      onClick: openEditModal,
    },
    {
      label: 'Delete',
      icon: <TrashIcon />,
      variant: theme.button.danger,
      onClick: setDeleteTarget,
    },
  ];

  return (
    <div className="max-w-8xl mx-auto p-6">
      <Card
        title={<span className="font-bold">Banners</span>}
        subtitle="Manage the image and video banners shown on your storefront"
        headerActions={
          <Button variant={theme.button.primary} leftIcon={<PlusIcon />} onClick={openAddModal}>
            Add Banner
          </Button>
        }
      >
        {error && (
          <p
            className={`mb-4 text-sm ${theme.alert.error.text} ${theme.alert.error.background} border ${theme.alert.error.border} rounded-lg px-4 py-2`}
          >
            {error}
          </p>
        )}

        <Table
          columns={columns}
          data={banners}
          keyField="_id"
          actions={actions}
          loading={loading}
          pageSize={10}
          emptyComponent={
            <EmptyState
              title="No banners yet"
              description="Create your first banner to show on your storefront."
              action={
                <Button variant={theme.button.primary} leftIcon={<PlusIcon />} onClick={openAddModal}>
                  Add Banner
                </Button>
              }
            />
          }
        />
      </Card>

      <Modal
        isOpen={formModal.open}
        onClose={closeFormModal}
        title={formModal.mode === 'edit' ? 'Edit Banner' : 'Add Banner'}
        size="lg"
      >
        <BannerForm
          mode={formModal.mode}
          initialValues={formModal.banner || {}}
          companyMaster={companyMaster}
          onSubmit={handleFormSubmit}
          onCancel={closeFormModal}
          submitting={mutating}
        />
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Banner"
        size="sm"
        footer={
          <>
            <Button variant={theme.button.ghost} onClick={() => setDeleteTarget(null)} disabled={mutating}>
              Cancel
            </Button>
            <Button variant={theme.button.danger} onClick={handleConfirmDelete} loading={mutating}>
              Delete
            </Button>
          </>
        }
      >
        <p className={`text-sm ${theme.text.body}`}>
          Are you sure you want to delete{' '}
          <span className={`font-medium ${theme.text.heading}`}>{deleteTarget?.name}</span>? This action cannot be
          undone.
        </p>
      </Modal>
    </div>
  );
};

export default BannersPage;
