import { useMemo, useState } from 'react';
import Card from '../../../../components/common/Card';
import Table from '../../../../components/common/tables';
import Button from '../../../../components/common/Buttons';
import Badge from '../../../../components/common/Badge';
import Switch from '../../../../components/common/Switch';
import Avatar from '../../../../components/common/Avatar';
import Modal from '../../../../components/common/Modal';
import EmptyState from '../../../../components/common/EmptyState';
import BulkActionBar from '../../../../components/common/BulkActionBar';
import SearchInput from '../../../../components/common/SearchInput';
import { useToast } from '../../../../components/common/Toast';
import { filterBySearch } from '../../../../utils/searchFilter';
import { useBlogs } from '../hooks/useBlogs';
import { getBlogByIdAdmin } from '../api/blogApi';
import BlogForm from '../components/BlogForm';
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
const DocIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

// Published but with a publish date still ahead = scheduled.
const isScheduled = (blog) => blog.status === 'A' && blog.publishedAt && new Date(blog.publishedAt) > new Date();

const filterBlogs = (blogs, term) =>
  filterBySearch(blogs, term, (blog) => [blog.title, blog.category, blog.authorName, (blog.tags || []).join(' ')]);

const BlogsPage = () => {
  const {
    blogs, total, hasMore, loading, loadingMore, error, mutating,
    loadMore, createBlog, editBlog, removeBlog, toggleStatus, bulkToggleStatus, bulkRemoveBlogs,
  } = useBlogs();
  const toast = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [formModal, setFormModal] = useState({ open: false, mode: 'add', blog: null });
  const [opening, setOpening] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState(null);

  const visibleBlogs = useMemo(() => filterBlogs(blogs, searchTerm), [blogs, searchTerm]);

  const openAddModal = () => {
    setSelectedIds([]);
    setFormModal({ open: true, mode: 'add', blog: null });
  };

  // The list leaves the (large) HTML body out, so the full post is fetched for editing.
  const openEditModal = async (blog) => {
    setSelectedIds([]);
    setOpening(true);
    try {
      const full = await getBlogByIdAdmin(blog._id);
      setFormModal({ open: true, mode: 'edit', blog: full });
    } catch (err) {
      toast.error(err.message || 'Could not open this post');
    } finally {
      setOpening(false);
    }
  };
  const closeFormModal = () => setFormModal({ open: false, mode: 'add', blog: null });

  const handleFormSubmit = async (fields, coverImage) => {
    const success =
      formModal.mode === 'edit'
        ? await editBlog(formModal.blog._id, fields, coverImage)
        : await createBlog(fields, coverImage);
    if (success) closeFormModal();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const success = await removeBlog(deleteTarget._id);
    if (success) setDeleteTarget(null);
  };

  // --- Bulk actions ----------------------------------------------------------
  const selectedBlogs = useMemo(() => blogs.filter((b) => selectedIds.includes(b._id)), [blogs, selectedIds]);
  const publishEligibleIds = useMemo(() => selectedBlogs.filter((b) => b.status === 'I').map((b) => b._id), [selectedBlogs]);
  const draftEligibleIds = useMemo(() => selectedBlogs.filter((b) => b.status === 'A').map((b) => b._id), [selectedBlogs]);

  const handleBulkPublish = async () => {
    setBulkAction('publish');
    await bulkToggleStatus(publishEligibleIds, 'A');
    setBulkAction(null);
    setSelectedIds([]);
  };
  const handleBulkDraft = async () => {
    setBulkAction('draft');
    await bulkToggleStatus(draftEligibleIds, 'I');
    setBulkAction(null);
    setSelectedIds([]);
  };
  const handleConfirmBulkDelete = async () => {
    setBulkAction('delete');
    await bulkRemoveBlogs(selectedIds);
    setBulkAction(null);
    setBulkDeleteConfirmOpen(false);
    setSelectedIds([]);
  };

  const bulkActions = [
    {
      key: 'publish',
      label: `Publish (${publishEligibleIds.length})`,
      variant: theme.button.primary,
      onClick: handleBulkPublish,
      loading: bulkAction === 'publish',
      disabled: mutating,
      hidden: publishEligibleIds.length === 0,
    },
    {
      key: 'draft',
      label: `Move to Drafts (${draftEligibleIds.length})`,
      variant: theme.button.secondary,
      onClick: handleBulkDraft,
      loading: bulkAction === 'draft',
      disabled: mutating,
      hidden: draftEligibleIds.length === 0,
    },
    {
      key: 'delete',
      label: `Delete (${selectedIds.length})`,
      variant: theme.button.danger,
      onClick: () => setBulkDeleteConfirmOpen(true),
      disabled: mutating,
      hidden: selectedIds.length === 0,
    },
  ];

  const columns = useMemo(
    () => [
      {
        key: 'title',
        label: 'Post',
        render: (row) => (
          <div className="flex items-center gap-3">
            {row.coverImage ? (
              <Avatar src={row.coverImage} name={row.title} shape="square" size="sm" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                <DocIcon />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`font-medium ${theme.text.heading} truncate max-w-xs`}>{row.title}</span>
                {row.isFeatured && (
                  <Badge variant={theme.badge.featured} size="sm">Featured</Badge>
                )}
              </div>
              <span className={`text-xs ${theme.text.muted}`}>/blog/{row.slug} · {row.readTimeMinutes} min read</span>
            </div>
          </div>
        ),
      },
      { key: 'category', label: 'Category', render: (row) => row.category || '—' },
      {
        key: 'publishedAt',
        label: 'Publish Date',
        render: (row) => (
          <div>
            <div>{formatDate(row.publishedAt)}</div>
            {isScheduled(row) && <Badge variant="blue" size="sm">Scheduled</Badge>}
          </div>
        ),
      },
      {
        key: 'status',
        label: 'Published',
        align: 'center',
        render: (row) => (
          <div className="flex items-center justify-center">
            <Switch
              checked={row.status === 'A'}
              onChange={() => toggleStatus(row)}
              disabled={mutating}
              color={theme.switch.color}
              aria-label={`Toggle published for ${row.title}`}
            />
          </div>
        ),
      },
    ],
    [mutating, toggleStatus]
  );

  const actions = [
    { label: 'Edit', icon: <PencilIcon />, variant: theme.button.secondary, onClick: openEditModal, disabled: () => opening },
    { label: 'Delete', icon: <TrashIcon />, variant: theme.button.danger, onClick: setDeleteTarget },
  ];

  return (
    <div className="max-w-8xl mx-auto p-6">
      <Card
        title={<span className="font-bold">Blog</span>}
        subtitle="Write the articles shown on your storefront blog"
        headerActions={
          <Button variant={theme.button.primary} leftIcon={<PlusIcon />} onClick={openAddModal}>
            Add Post
          </Button>
        }
      >
        {error && (
          <p className={`mb-4 text-sm ${theme.alert.error.text} ${theme.alert.error.background} border ${theme.alert.error.border} rounded-lg px-4 py-2`}>
            {error}
          </p>
        )}

        <SearchInput
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search by title, category, author or tag"
          ariaLabel="Search blog posts"
          matchCount={visibleBlogs.length}
          totalCount={blogs.length}
          itemLabel="posts"
        />

        <BulkActionBar selectedCount={selectedIds.length} onClear={() => setSelectedIds([])} actions={bulkActions} />

        <Table
          columns={columns}
          data={visibleBlogs}
          keyField="_id"
          actions={selectedIds.length > 0 ? [] : actions}
          selectable
          selectedKeys={selectedIds}
          onSelectionChange={setSelectedIds}
          loading={loading}
          pageSize={10}
          resetPageOn={searchTerm}
          emptyComponent={
            <EmptyState
              title={searchTerm ? 'No posts match your search' : 'No blog posts yet'}
              description={searchTerm ? 'Try a different word.' : 'Write your first post to show it on your storefront blog.'}
              action={
                searchTerm ? null : (
                  <Button variant={theme.button.primary} leftIcon={<PlusIcon />} onClick={openAddModal}>
                    Add Post
                  </Button>
                )
              }
            />
          }
        />

        {hasMore && (
          <div className="mt-4 flex justify-center">
            <Button variant={theme.button.secondary} onClick={loadMore} loading={loadingMore}>
              Load more posts ({blogs.length} of {total})
            </Button>
          </div>
        )}
      </Card>

      <Modal
        isOpen={formModal.open}
        onClose={closeFormModal}
        title={formModal.mode === 'edit' ? 'Edit Post' : 'Add Post'}
        size="xl"
      >
        <BlogForm
          mode={formModal.mode}
          initialValues={formModal.blog || {}}
          onSubmit={handleFormSubmit}
          onCancel={closeFormModal}
          submitting={mutating}
        />
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Post"
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
          <span className={`font-medium ${theme.text.heading}`}>{deleteTarget?.title}</span>? This action cannot be undone.
        </p>
      </Modal>

      <Modal
        isOpen={bulkDeleteConfirmOpen}
        onClose={() => setBulkDeleteConfirmOpen(false)}
        title="Delete Posts"
        size="sm"
        footer={
          <>
            <Button variant={theme.button.ghost} onClick={() => setBulkDeleteConfirmOpen(false)} disabled={mutating}>
              Cancel
            </Button>
            <Button variant={theme.button.danger} onClick={handleConfirmBulkDelete} loading={mutating}>
              Delete
            </Button>
          </>
        }
      >
        <p className={`text-sm ${theme.text.body}`}>
          Are you sure you want to delete <span className={`font-medium ${theme.text.heading}`}>{selectedIds.length}</span> post{selectedIds.length === 1 ? '' : 's'}? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
};

export default BlogsPage;
