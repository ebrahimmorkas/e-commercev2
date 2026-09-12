import { useMemo } from 'react';
import Card from '../../../../components/common/Card';
import Table from '../../../../components/common/tables';
import Badge from '../../../../components/common/Badge';
import EmptyState from '../../../../components/common/EmptyState';
import { useAbandonedCarts } from '../hooks/useAbandonedCarts';
import theme from '../theme/theme';

const formatDateTime = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatTimeAgo = (value) => {
  if (!value) return '—';
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
};

const AbandonedCartsPage = () => {
  const { carts, loading, error } = useAbandonedCarts();

  const columns = useMemo(
    () => [
      {
        key: 'userName',
        label: 'Customer',
        render: (row) => (
          <div>
            <span className={`block font-medium ${theme.text.heading}`}>{row.userName || 'Unknown'}</span>
            <span className={`block text-xs ${theme.text.muted}`}>{row.userEmail || '—'}</span>
          </div>
        ),
      },
      { key: 'userPhone', label: 'Phone', render: (row) => row.userPhone || '—' },
      {
        key: 'itemCount',
        label: 'Items',
        align: 'center',
        render: (row) => (
          <Badge variant={theme.badge.itemCount} size="sm">
            {row.itemCount}
          </Badge>
        ),
      },
      { key: 'lastProductAddedAt', label: 'Last Activity', sortable: true, render: (row) => formatDateTime(row.lastProductAddedAt) },
      {
        key: 'abandonedAt',
        label: 'Abandoned',
        sortable: true,
        render: (row) => (
          <span title={formatDateTime(row.abandonedAt)} className={theme.text.body}>
            {formatTimeAgo(row.abandonedAt)}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <div className="max-w-8xl mx-auto p-6">
      <Card
        title={<span className="font-bold">Abandoned Carts</span>}
        subtitle="Customers who added items to their cart but did not check out. Updates live - no need to refresh."
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
          data={carts}
          keyField="_id"
          loading={loading}
          pageSize={10}
          emptyComponent={
            <EmptyState
              title="No abandoned carts"
              description="Carts that go quiet past your configured reflection time will show up here automatically."
            />
          }
        />
      </Card>
    </div>
  );
};

export default AbandonedCartsPage;
