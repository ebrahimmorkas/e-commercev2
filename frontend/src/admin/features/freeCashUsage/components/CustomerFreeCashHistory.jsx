import { useEffect, useMemo, useState } from 'react';
import Table from '../../../../components/common/tables';
import Badge from '../../../../components/common/Badge';
import Spinner from '../../../../components/common/Spinner';
import EmptyState from '../../../../components/common/EmptyState';
import { getCustomerFreeCashHistory } from '../api/freeCashUsageApi';
import { EVENT_LABELS, GRANT_STATE_LABELS } from '../constants';
import theme from '../theme/theme';

const formatDateTime = (dateValue) => {
  if (!dateValue) return '—';
  return new Date(dateValue).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDate = (dateValue) => {
  if (!dateValue) return '—';
  return new Date(dateValue).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

// What happened, in words - the order it was used on, and what became of the rest.
const describeEvent = (event, formatMoney) => {
  const order = event.orderNumber ? `order #${event.orderNumber}` : 'an order';
  switch (event.type) {
    case 'ASSIGNED':
      return 'Free Cash assigned to the customer.';
    case 'USED':
      if (event.remainderOutcome === 'REMOVED') {
        return `Used on ${order}. The remaining ${formatMoney(event.removedAmount)} was removed (not kept).`;
      }
      if (event.remainderOutcome === 'REMAINED') {
        return `Used on ${order}. The remaining ${formatMoney(event.balanceAfter)} stayed with the customer.`;
      }
      return `Used on ${order}. Nothing was left over.`;
    case 'REFUNDED':
      return `Given back for the return of ${order}.`;
    case 'REVOKED':
      return `Revoked${event.byName ? ` by ${event.byName}` : ' by the store'}.`;
    case 'RESTORED':
      return `Given back to the customer${event.byName ? ` by ${event.byName}` : ''} after being revoked.`;
    case 'EXPIRED':
      return event.reason === 'REPLACED'
        ? 'Expired - replaced by a newer Free Cash (your store does not allow more than one at a time).'
        : 'Expired - the Free Cash reached its end date with this amount unused.';
    default:
      return '';
  }
};

/**
 * One customer's Free Cash: what they can spend right now, every Free Cash
 * they were given (and where each stands), and the full history across all of
 * them - assigned, used (on which order, and whether the rest stayed or was
 * removed), refunded, revoked, expired.
 *
 * @param {Object} props
 * @param {string} props.userId
 * @param {(amount: number) => string} props.formatMoney - Store currency formatter
 */
const CustomerFreeCashHistory = ({ userId, formatMoney }) => {
  const [state, setState] = useState({ userId: null, data: null, error: '' });

  useEffect(() => {
    let cancelled = false;
    getCustomerFreeCashHistory(userId)
      .then((data) => {
        if (!cancelled) setState({ userId, data, error: '' });
      })
      .catch((err) => {
        if (!cancelled) setState({ userId, data: null, error: err.message || 'Failed to load the Free Cash history' });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const freeCashColumns = useMemo(
    () => [
      {
        key: 'freeCashName',
        label: 'Free Cash',
        render: (row) => <span className={`font-medium ${theme.text.heading}`}>{row.freeCashName}</span>,
      },
      { key: 'issuedDate', label: 'Assigned on', render: (row) => formatDate(row.issuedDate) },
      {
        key: 'validity',
        label: 'Valid',
        render: (row) => (
          <span className="whitespace-nowrap">
            {formatDate(row.startDate)} – {formatDate(row.endDate)}
          </span>
        ),
      },
      { key: 'amount', label: 'Given', align: 'right', render: (row) => formatMoney(row.amount) },
      { key: 'usedAmount', label: 'Used', align: 'right', render: (row) => formatMoney(row.usedAmount) },
      {
        key: 'activeAmount',
        label: 'Active now',
        align: 'right',
        render: (row) => (
          <span className={`font-semibold ${row.activeAmount > 0 ? theme.text.active : theme.text.muted}`}>
            {formatMoney(row.activeAmount)}
          </span>
        ),
      },
      {
        key: 'state',
        label: 'Status',
        align: 'center',
        render: (row) => (
          <Badge variant={theme.grantState[row.state] || 'gray'} size="sm">
            {GRANT_STATE_LABELS[row.state] || row.state}
          </Badge>
        ),
      },
    ],
    [formatMoney]
  );

  const eventColumns = useMemo(
    () => [
      { key: 'date', label: 'Date', render: (row) => <span className="whitespace-nowrap">{formatDateTime(row.date)}</span> },
      {
        key: 'type',
        label: 'What happened',
        render: (row) => (
          <Badge variant={theme.event[row.type]?.badge || 'gray'} size="sm">
            {EVENT_LABELS[row.type] || row.type}
          </Badge>
        ),
      },
      { key: 'freeCashName', label: 'Free Cash' },
      {
        key: 'amount',
        label: 'Amount',
        align: 'right',
        render: (row) => (
          <span className={`font-semibold whitespace-nowrap ${theme.event[row.type]?.number || ''}`}>
            {theme.event[row.type]?.sign || ''}
            {formatMoney(row.amount)}
          </span>
        ),
      },
      { key: 'details', label: 'Details', render: (row) => <span className="break-words">{describeEvent(row, formatMoney)}</span> },
      {
        key: 'balanceAfter',
        label: 'Left after',
        align: 'right',
        render: (row) => <span className="whitespace-nowrap">{formatMoney(row.balanceAfter)}</span>,
      },
    ],
    [formatMoney]
  );

  if (state.userId !== userId) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (state.error) {
    return (
      <p
        className={`text-sm ${theme.alert.error.text} ${theme.alert.error.background} border ${theme.alert.error.border} rounded-lg px-4 py-2`}
      >
        {state.error}
      </p>
    );
  }

  const { customer, activeFreeCash, freeCash = [], events = [] } = state.data || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
        <div className="min-w-0">
          <p className={`font-medium ${theme.text.heading}`}>
            {customer?.name || '—'}
            {customer?.status === 'I' && (
              <Badge variant="gray" size="sm" className="ml-2">
                Inactive
              </Badge>
            )}
          </p>
          <p className={`text-sm ${theme.text.body}`}>
            {customer?.email || '—'}
            {customer?.phone_no ? ` · ${customer.phone_no}` : ''}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-xs font-medium uppercase tracking-wide ${theme.text.body}`}>Active Free Cash</p>
          <p className={`text-2xl font-bold ${activeFreeCash > 0 ? theme.text.active : theme.text.heading}`}>
            {formatMoney(activeFreeCash || 0)}
          </p>
        </div>
      </div>

      {freeCash.length === 0 ? (
        <EmptyState
          size="sm"
          title="No Free Cash yet"
          description="This customer has not been given any Free Cash, so there is no history to show."
        />
      ) : (
        <>
          <div>
            <h4 className={`mb-2 text-sm font-semibold uppercase tracking-wide ${theme.text.body}`}>Free Cash given</h4>
            <Table columns={freeCashColumns} data={freeCash} keyField="userFreeCashId" />
          </div>

          <div>
            <h4 className={`mb-2 text-sm font-semibold uppercase tracking-wide ${theme.text.body}`}>
              History (newest first)
            </h4>
            <Table
              columns={eventColumns}
              data={events}
              getRowKey={(row, index) => `${row.userFreeCashId}-${row.type}-${index}`}
              pageSize={15}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default CustomerFreeCashHistory;
