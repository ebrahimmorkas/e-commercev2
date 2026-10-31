import { useState } from 'react';
import Card from '../../../../components/common/Card';
import Table from '../../../../components/common/tables';
import Button from '../../../../components/common/Buttons';
import Badge from '../../../../components/common/Badge';
import Tabs from '../../../../components/common/Tabs';
import EmptyState from '../../../../components/common/EmptyState';
import Spinner from '../../../../components/common/Spinner';
import Pagination from '../../../../components/common/Pagination';
import BulkActionBar from '../../../../components/common/BulkActionBar';
import SearchInput from '../../../../components/common/SearchInput';
import LiveIndicator from '../../../realtime/LiveIndicator';
import { useAdminReviews } from '../hooks/useAdminReviews';
import { Stars } from '../components/Stars';
import ReviewDetailModal from '../components/ReviewDetailModal';
import ReviewActionModal from '../components/ReviewActionModal';
import { STATUS_TABS, SORT_OPTIONS, RATING_OPTIONS } from '../constants';
import { formatDate, getStatusBadge, canApprove, canReject } from '../utils/formatAdminReview';
import theme from '../theme/theme';

const selectClass = `${theme.input} sm:w-auto bg-white`;

const StatusBadges = ({ review }) => {
  const badge = getStatusBadge(review);
  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant={badge.variant} size="sm">
        {badge.label}
      </Badge>
      {review.hasPendingChanges && (
        <Badge variant={theme.badge.pendingChanges} size="sm">
          Edit waiting
        </Badge>
      )}
    </div>
  );
};

const ReviewSummary = ({ review }) => (
  <div className="min-w-0 max-w-md">
    <Stars value={review.rating} />
    {review.title && <p className={`mt-0.5 text-sm font-medium truncate ${theme.text.heading}`}>{review.title}</p>}
    {review.comment && <p className={`text-sm line-clamp-2 break-words ${theme.text.body}`}>{review.comment}</p>}
    {review.images?.length > 0 && (
      <p className={`text-xs ${theme.text.muted}`}>
        {review.images.length} photo{review.images.length === 1 ? '' : 's'}
      </p>
    )}
  </div>
);

/**
 * Admin Reviews module: every customer review for the vendor, with filters,
 * live updates, and the actions the vendor's switches allow - delete always;
 * edit when review editing is on; approve/reject when approval is on.
 */
const ReviewsPage = () => {
  const {
    filters,
    setFilter,
    resetFilters,
    searchText,
    setSearchText,
    page,
    setPage,
    reviews,
    counts,
    permissions,
    pagination,
    error,
    loading,
    busy,
    refresh,
    approve,
    reject,
    remove,
  } = useAdminReviews();

  const [selectedIds, setSelectedIds] = useState([]);
  const [openReviewId, setOpenReviewId] = useState(null);
  const [bulkAction, setBulkAction] = useState(null);

  // Selection is per page - ids no longer on screen are simply ignored.
  const selectedReviews = reviews.filter((review) => selectedIds.includes(review._id));
  const selectedKeys = selectedReviews.map((review) => review._id);
  const approvable = selectedReviews.filter(canApprove);
  const rejectable = selectedReviews.filter(canReject);
  const deletable = selectedReviews.filter((review) => !review.isDeleted);
  const canModerate = !!permissions?.canApproveReject;

  const bulkTargets = { approve: approvable, reject: rejectable, delete: deletable }[bulkAction] || [];

  const confirmBulk = async (reason) => {
    const ids = bulkTargets.map((review) => review._id);
    const action = bulkAction;
    const ok = action === 'approve' ? await approve(ids) : action === 'reject' ? await reject(ids, reason) : await remove(ids);
    setBulkAction(null);
    if (ok) setSelectedIds([]);
  };

  const bulkActions = [
    { key: 'approve', label: `Approve (${approvable.length})`, variant: theme.button.success, onClick: () => setBulkAction('approve'), hidden: !canModerate || approvable.length === 0, disabled: busy },
    { key: 'reject', label: `Reject (${rejectable.length})`, variant: theme.button.outline, onClick: () => setBulkAction('reject'), hidden: !canModerate || rejectable.length === 0, disabled: busy },
    { key: 'delete', label: `Delete (${deletable.length})`, variant: theme.button.danger, onClick: () => setBulkAction('delete'), hidden: deletable.length === 0, disabled: busy },
  ];

  const columns = [
    { key: 'review', label: 'Review', render: (review) => <ReviewSummary review={review} /> },
    {
      key: 'product',
      label: 'Product',
      render: (review) => <span className={`text-sm ${theme.text.body}`}>{review.product?.name || '—'}</span>,
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (review) => (
        <div className="min-w-0">
          <p className={`text-sm ${theme.text.body}`}>{review.customer?.name || '—'}</p>
          {review.customer?.email && <p className={`text-xs truncate ${theme.text.muted}`}>{review.customer.email}</p>}
        </div>
      ),
    },
    { key: 'status', label: 'Status', render: (review) => <StatusBadges review={review} /> },
    { key: 'createdAt', label: 'Posted', render: (review) => <span className={`text-sm whitespace-nowrap ${theme.text.subheading}`}>{formatDate(review.createdAt)}</span> },
  ];

  const rowActions = selectedKeys.length > 0 ? [] : [{ label: 'View', variant: theme.button.secondary, onClick: (review) => setOpenReviewId(review._id) }];

  const tabs = STATUS_TABS.map((tab) => ({ key: tab.key, label: `${tab.label} (${counts[tab.key] ?? 0})` }));
  const hasFilters = filters.search || filters.rating || filters.fromDate || filters.toDate || filters.status !== 'all';
  const totalPages = pagination?.totalPages || 0;

  const moderationNote = permissions
    ? [
        permissions.canApproveReject ? 'New reviews and edits wait for your approval.' : 'Reviews go live as soon as customers post them.',
        permissions.canEdit ? 'You can edit reviews.' : null,
      ]
        .filter(Boolean)
        .join(' ')
    : '';

  return (
    <div className="max-w-8xl mx-auto p-4 sm:p-6">
      <Card title={<span className="font-bold">Reviews</span>} subtitle={moderationNote || "Customers' product reviews"} headerActions={<LiveIndicator />}>
        <Tabs
          items={tabs}
          value={filters.status}
          onChange={(status) => setFilter({ status })}
          variant="line"
          className="mb-4 overflow-x-auto"
        />

        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <SearchInput
            value={searchText}
            onChange={setSearchText}
            placeholder="Search customer name, email or product…"
            ariaLabel="Search reviews"
            className="mb-0 lg:mb-4 lg:flex-1"
          />
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <select aria-label="Rating" className={selectClass} value={filters.rating} onChange={(e) => setFilter({ rating: e.target.value })}>
              {RATING_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select aria-label="Sort" className={selectClass} value={filters.sort} onChange={(e) => setFilter({ sort: e.target.value })}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              aria-label="Posted from"
              className={selectClass}
              value={filters.fromDate}
              max={filters.toDate || undefined}
              onChange={(e) => setFilter({ fromDate: e.target.value })}
            />
            <span className={`text-sm ${theme.text.muted}`}>to</span>
            <input
              type="date"
              aria-label="Posted to"
              className={selectClass}
              value={filters.toDate}
              min={filters.fromDate || undefined}
              onChange={(e) => setFilter({ toDate: e.target.value })}
            />
            {hasFilters && (
              <Button variant={theme.button.ghost} size="sm" onClick={resetFilters}>
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className={`mb-4 flex flex-wrap items-center justify-between gap-2 text-sm ${theme.alert.error.text} ${theme.alert.error.background} border ${theme.alert.error.border} rounded-lg px-4 py-2`}>
            <span>{error}</span>
            <Button variant={theme.button.ghost} size="sm" onClick={refresh}>
              Retry
            </Button>
          </div>
        )}

        {loading && reviews.length === 0 ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : reviews.length === 0 ? (
          <EmptyState
            title={hasFilters ? 'No reviews match these filters' : 'No reviews yet'}
            description={hasFilters ? 'Try a different filter or search.' : 'Reviews customers post on delivered orders will show up here.'}
            action={
              hasFilters && (
                <Button variant={theme.button.secondary} onClick={resetFilters}>
                  Clear filters
                </Button>
              )
            }
          />
        ) : (
          <div className={loading ? 'opacity-60 transition-opacity' : ''}>
            <BulkActionBar selectedCount={selectedKeys.length} onClear={() => setSelectedIds([])} actions={bulkActions} />

            <div className="hidden md:block">
              <Table
                columns={columns}
                data={reviews}
                keyField="_id"
                actions={rowActions}
                selectable
                selectedKeys={selectedKeys}
                onSelectionChange={setSelectedIds}
              />
            </div>

            {/* Mobile: cards */}
            <div className="md:hidden space-y-3">
              {reviews.map((review) => (
                <div key={review._id} className={`rounded-xl border p-3 ${theme.panel.border}`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1"
                      aria-label="Select review"
                      checked={selectedKeys.includes(review._id)}
                      onChange={(e) =>
                        setSelectedIds((prev) => (e.target.checked ? [...prev, review._id] : prev.filter((id) => id !== review._id)))
                      }
                    />
                    <button type="button" className="min-w-0 flex-1 text-left cursor-pointer" onClick={() => setOpenReviewId(review._id)}>
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium truncate ${theme.text.heading}`}>{review.product?.name || 'Product'}</p>
                        <StatusBadges review={review} />
                      </div>
                      <p className={`text-xs ${theme.text.muted}`}>
                        {review.customer?.name || 'Customer'} · {formatDate(review.createdAt)}
                      </p>
                      <div className="mt-1">
                        <ReviewSummary review={review} />
                      </div>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-4 flex justify-center">
                <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} size="sm" />
              </div>
            )}
          </div>
        )}
      </Card>

      {openReviewId && <ReviewDetailModal reviewId={openReviewId} onClose={() => setOpenReviewId(null)} onChanged={refresh} />}
      {bulkAction && (
        <ReviewActionModal action={bulkAction} count={bulkTargets.length} busy={busy} onConfirm={confirmBulk} onClose={() => setBulkAction(null)} />
      )}
    </div>
  );
};

export default ReviewsPage;
