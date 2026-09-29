import { useCallback, useEffect, useState } from 'react';
import Table from '../../../../components/common/tables';
import Badge from '../../../../components/common/Badge';
import Button from '../../../../components/common/Buttons';
import Modal from '../../../../components/common/Modal';
import Pagination from '../../../../components/common/Pagination';
import Spinner from '../../../../components/common/Spinner';
import EmptyState from '../../../../components/common/EmptyState';
import { getSentEmails, getSentEmail } from '../api/sendEmailApi';
import theme from '../theme/theme';

const PAGE_SIZE = 20;
const STATUS_LABELS = { SENDING: 'Sending', COMPLETED: 'Completed', STOPPED: 'Stopped' };

const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : '');

// "all customers" / "3 customer(s) + group VIP + 2 typed address(es)"
const describeSelection = (selection = {}) => {
  const parts = [];
  if (selection.allCustomers) parts.push('All customers');
  if (selection.customerCount) parts.push(`${selection.customerCount} customer(s)`);
  if (selection.groupNames?.length) parts.push(`group ${selection.groupNames.join(', ')}`);
  if (selection.externalEmailCount) parts.push(`${selection.externalEmailCount} typed address(es)`);
  return parts.join(' + ');
};

/** One sent email: body, files and every recipient's result. */
const SentEmailDetail = ({ sentEmail }) => (
  <div className="space-y-5 text-sm">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <p><span className={theme.text.muted}>Sent by:</span> {sentEmail.sentByName || '-'}</p>
      <p><span className={theme.text.muted}>When:</span> {formatDateTime(sentEmail.createdAt)}</p>
      <p><span className={theme.text.muted}>To:</span> {describeSelection(sentEmail.recipientSelection)}</p>
      <p>
        <span className={theme.text.muted}>Result:</span> {sentEmail.sentCount} sent, {sentEmail.failedCount} failed, {sentEmail.skippedCount} skipped
      </p>
      {(sentEmail.ccList?.length > 0 || sentEmail.bccList?.length > 0) && (
        <p className="sm:col-span-2">
          <span className={theme.text.muted}>Extra CC/BCC:</span> {[...sentEmail.ccList, ...sentEmail.bccList].join(', ')}
        </p>
      )}
      {sentEmail.stoppedReason && <p className={`sm:col-span-2 ${theme.text.error}`}>Stopped: {sentEmail.stoppedReason}</p>}
      {sentEmail.resumeCount > 0 && (
        <p className={`sm:col-span-2 ${theme.text.muted}`}>
          A server restart interrupted this send; it carried on automatically afterwards.
        </p>
      )}
    </div>

    <div>
      <p className={`font-medium mb-1 ${theme.text.heading}`}>{sentEmail.subject}</p>
      {/* Sandboxed so the stored HTML can't run scripts in the admin panel. */}
      <iframe title="Email body" sandbox="" srcDoc={sentEmail.htmlBody} className="w-full h-64 border border-gray-200 rounded" />
    </div>

    {(sentEmail.attachments.length > 0 || sentEmail.images.length > 0) && (
      <div>
        <p className={`font-medium mb-1 ${theme.text.heading}`}>Files</p>
        <ul className="space-y-1">
          {[...sentEmail.attachments.map((f) => ({ ...f, kind: 'Attachment' })), ...sentEmail.images.map((f) => ({ ...f, kind: 'Image' }))].map((f, i) => (
            <li key={`${f.name}-${i}`}>
              {f.kind}: {f.url ? <a href={f.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{f.name}</a> : f.name}
              <span className={`ml-2 text-xs ${theme.text.muted}`}>
                {f.source === 'LIBRARY' ? 'from Company Settings' : f.available === false ? 'no longer available' : 'uploaded for this email'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    )}

    <div>
      <p className={`font-medium mb-1 ${theme.text.heading}`}>Recipients ({sentEmail.recipients.length})</p>
      <div className="max-h-64 overflow-y-auto border border-gray-100 rounded divide-y divide-gray-100">
        {sentEmail.recipients.map((r) => (
          <div key={r.email} className="flex items-center justify-between gap-3 px-3 py-1.5">
            <span className="truncate">{r.name ? `${r.name} - ` : ''}{r.email}</span>
            <span className="flex items-center gap-2 shrink-0">
              {r.error && <span className={`text-xs ${theme.text.error} max-w-xs truncate`} title={r.error}>{r.error}</span>}
              <Badge variant={theme.badge[r.status] || 'gray'} size="sm">{r.status}</Badge>
            </span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/**
 * History tab: every email sent from this module, newest first.
 * @param {number} props.refreshKey - bump to reload (e.g. after sending)
 */
const SentEmailHistory = ({ refreshKey = 0 }) => {
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const applyResult = useCallback((result) => {
    setData({ items: result?.items || [], total: result?.total || 0 });
    setError('');
  }, []);
  const applyError = useCallback((err) => setError(err.message || 'Could not load the history'), []);

  // The Refresh button.
  const load = useCallback(async (pageToLoad) => {
    try {
      applyResult(await getSentEmails(pageToLoad, PAGE_SIZE));
    } catch (err) {
      applyError(err);
    }
  }, [applyResult, applyError]);

  // On page change / after a send - state is only set once the request settles.
  useEffect(() => {
    let cancelled = false;
    getSentEmails(page, PAGE_SIZE)
      .then((result) => !cancelled && applyResult(result))
      .catch((err) => !cancelled && applyError(err))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page, refreshKey, applyResult, applyError]);

  const openDetail = async (row) => {
    setDetailLoading(true);
    setDetail({ subject: row.subject });
    try {
      setDetail(await getSentEmail(row._id));
    } catch (err) {
      setDetail({ subject: row.subject, loadError: err.message || 'Could not load this email' });
    } finally {
      setDetailLoading(false);
    }
  };

  const columns = [
    { key: 'createdAt', label: 'Sent', render: (row) => formatDateTime(row.createdAt) },
    { key: 'subject', label: 'Subject', render: (row) => <span className={`font-medium ${theme.text.heading}`}>{row.subject}</span> },
    { key: 'to', label: 'To', render: (row) => <span className={theme.text.body}>{describeSelection(row.recipientSelection)} ({row.recipientCount})</span> },
    {
      key: 'result',
      label: 'Result',
      render: (row) => (
        <span className={theme.text.body}>
          {row.sentCount} sent{row.failedCount ? `, ${row.failedCount} failed` : ''}{row.skippedCount ? `, ${row.skippedCount} skipped` : ''}
        </span>
      ),
    },
    {
      key: 'sendStatus',
      label: 'Status',
      render: (row) => <Badge variant={theme.badge[row.sendStatus] || 'gray'} size="sm">{STATUS_LABELS[row.sendStatus] || row.sendStatus}</Badge>,
    },
    { key: 'sentByName', label: 'Sent by', render: (row) => <span className={theme.text.body}>{row.sentByName || '-'}</span> },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        {error ? <p className={`text-sm ${theme.text.error}`}>{error}</p> : <span />}
        <Button variant={theme.button.secondary} size="sm" onClick={() => load(page)}>
          Refresh
        </Button>
      </div>
      <Table
        columns={columns}
        data={data.items}
        keyField="_id"
        actions={[{ label: 'View', variant: theme.button.secondary, onClick: openDetail }]}
        emptyComponent={<EmptyState title="Nothing sent yet" description="Emails you send from the Compose tab appear here." />}
      />
      {data.total > PAGE_SIZE && (
        <Pagination currentPage={page} totalItems={data.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
      )}

      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={detail?.subject || 'Sent email'} size="xl">
        {detailLoading || !detail ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : detail.loadError ? (
          <p className={`text-sm ${theme.text.error}`}>{detail.loadError}</p>
        ) : (
          <SentEmailDetail sentEmail={detail} />
        )}
      </Modal>
    </div>
  );
};

export default SentEmailHistory;
