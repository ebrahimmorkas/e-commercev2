import { useEffect, useMemo, useState } from 'react';
import Table from '../../../../components/common/tables';
import Badge from '../../../../components/common/Badge';
import EmptyState from '../../../../components/common/EmptyState';
import Spinner from '../../../../components/common/Spinner';
import SearchInput from '../../../../components/common/SearchInput';
import { getAllUsersAdmin } from '../api/customerApi';
import { filterBySearch } from '../../../../utils/searchFilter';
import theme from '../theme/theme';

const filterAgents = (agents, term) => filterBySearch(agents, term, (a) => [a.name, a.username, a.email, a.phone_no, a.whatsapp_no]);

/**
 * The store's delivery agents shown on the Customers page - read-only; they are
 * created and managed on the Delivery Agents page.
 */
const DeliveryAgentsReadOnlyList = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let cancelled = false;
    getAllUsersAdmin('deliveryAgent')
      .then((data) => {
        if (!cancelled) setAgents(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load delivery agents');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => filterAgents(agents, searchTerm), [agents, searchTerm]);

  const columns = [
    {
      key: 'name',
      label: 'Delivery Agent',
      render: (row) => (
        <div className="min-w-0">
          <p className={`font-medium truncate ${theme.text.heading}`}>{row.name}</p>
          <p className={`text-xs truncate ${theme.text.muted}`}>@{row.username}</p>
        </div>
      ),
    },
    {
      key: 'contact',
      label: 'Contact',
      render: (row) => (
        <div className="min-w-0">
          <p className={`text-sm truncate ${theme.text.body}`}>{row.email}</p>
          <p className={`text-xs truncate ${theme.text.muted}`}>{row.phone_no}</p>
        </div>
      ),
    },
    { key: 'role', label: 'Role', align: 'center', render: () => <Badge variant="purple" size="sm">delivery agent</Badge> },
    {
      key: 'status',
      label: 'Status',
      align: 'center',
      render: (row) => <Badge variant={row.status === 'A' ? theme.badge.active : theme.badge.inactive} size="sm">{row.status === 'A' ? 'Active' : 'Inactive'}</Badge>,
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <>
      <p className={`mb-3 text-xs ${theme.text.muted}`}>Delivery agents are added, edited and removed on the Delivery Agents page.</p>
      {error && (
        <p className={`mb-4 text-sm ${theme.alert.error.text} ${theme.alert.error.background} border ${theme.alert.error.border} rounded-lg px-4 py-2`}>{error}</p>
      )}
      {agents.length === 0 ? (
        <EmptyState title="No delivery agents" description="Add delivery agents on the Delivery Agents page." />
      ) : (
        <>
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search name, username, email or phone…"
            ariaLabel="Search delivery agents"
            matchCount={filtered.length}
            totalCount={agents.length}
            itemLabel="agents"
          />
          <Table columns={columns} data={filtered} keyField="_id" pageSize={20} resetPageOn={searchTerm} />
        </>
      )}
    </>
  );
};

export default DeliveryAgentsReadOnlyList;
