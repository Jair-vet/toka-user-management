import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { auditApi, type AuditEvent } from '@/api/endpoints';

const actionBadge = (action: string) => {
  if (action.includes('created') || action.includes('login')) return 'badge-green';
  if (action.includes('deleted') || action.includes('logout')) return 'badge-red';
  if (action.includes('updated') || action.includes('assigned')) return 'badge-blue';
  return 'badge-gray';
};

export function AuditPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    actor: '',
    resource: '',
    action: '',
    from: '',
    to: '',
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['audit', page, filters],
    queryFn: () =>
      auditApi.events({
        page,
        limit: 20,
        actor: filters.actor || undefined,
        resource: filters.resource || undefined,
        action: filters.action || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
      }),
  });

  const events: AuditEvent[] = data?.data.data ?? [];
  const total = data?.data.meta.total ?? 0;
  const totalPages = data?.data.meta.totalPages ?? 1;

  const setFilter = (k: string, v: string) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Audit Log <span className="text-muted text-sm">({total})</span></h1>
        <button className="btn btn-secondary" onClick={() => void refetch()}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
          <input className="input" placeholder="Actor" value={filters.actor}
            onChange={(e) => setFilter('actor', e.target.value)} />
          <input className="input" placeholder="Resource" value={filters.resource}
            onChange={(e) => setFilter('resource', e.target.value)} />
          <input className="input" placeholder="Action" value={filters.action}
            onChange={(e) => setFilter('action', e.target.value)} />
          <input className="input" type="date" value={filters.from}
            onChange={(e) => setFilter('from', e.target.value)} />
          <input className="input" type="date" value={filters.to}
            onChange={(e) => setFilter('to', e.target.value)} />
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <div className="spinner" />
          </div>
        ) : events.length === 0 ? (
          <p className="text-muted text-sm" style={{ padding: '1rem 0' }}>No audit events found.</p>
        ) : (
          <>
            <div className="table-responsive"><table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Resource</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id}>
                    <td className="text-sm text-muted" style={{ whiteSpace: 'nowrap' }}>
                      {new Date(ev.timestamp).toLocaleString()}
                    </td>
                    <td>
                      <span className={`badge ${actionBadge(ev.action)}`}>{ev.action}</span>
                    </td>
                    <td className="text-sm">{ev.actorEmail ?? ev.actor}</td>
                    <td className="text-sm">{ev.resourceId}</td>
                    <td className="text-sm text-muted">{ev.resource}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary btn-sm" disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft size={14} />
                </button>
                <span className="text-sm text-muted">{page} / {totalPages}</span>
                <button className="btn btn-secondary btn-sm" disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
