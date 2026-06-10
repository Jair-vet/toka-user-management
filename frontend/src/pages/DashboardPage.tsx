import { useQuery } from '@tanstack/react-query';
import { Users, Shield, ScrollText, Bot } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { usersApi, rolesApi, auditApi } from '@/api/endpoints';
import { SkeletonCard, SkeletonTable } from '@/components/Skeleton';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div style={{
        width: 48, height: 48, borderRadius: 10,
        background: `${color}22`, display: 'flex', alignItems: 'center',
        justifyContent: 'center', color, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{value}</div>
        <div className="text-muted text-sm">{label}</div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuthStore();

  const { data: usersData, isLoading: loadingUsers } = useQuery({
    queryKey: ['users-count'],
    queryFn: () => usersApi.list({ limit: 1 }),
  });

  const { data: rolesData, isLoading: loadingRoles } = useQuery({
    queryKey: ['roles-count'],
    queryFn: () => rolesApi.list(),
  });

  const { data: auditData, isLoading: loadingAudit } = useQuery({
    queryKey: ['audit-recent'],
    queryFn: () => auditApi.events({ limit: 10 }),
  });

  const recentEvents = auditData?.data.data ?? [];
  const statsLoading = loadingUsers || loadingRoles;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <span className="text-muted text-sm">
          Welcome back, {user?.given_name ?? user?.name ?? 'User'}
        </span>
      </div>

      <div className="stats-grid" style={{ marginBottom: '2rem' }}>
        {statsLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard
              icon={<Users size={22} />}
              label="Total Users"
              value={usersData?.data.meta.total ?? 0}
              color="#6366f1"
            />
            <StatCard
              icon={<Shield size={22} />}
              label="Roles"
              value={Array.isArray(rolesData?.data) ? rolesData.data.length : 0}
              color="#0ea5e9"
            />
            <StatCard
              icon={<ScrollText size={22} />}
              label="Audit Events"
              value={auditData?.data.meta.total ?? 0}
              color="#22c55e"
            />
            <StatCard
              icon={<Bot size={22} />}
              label="AI Agent"
              value="Online"
              color="#f59e0b"
            />
          </>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem' }}>Recent Activity</h2>
        {loadingAudit ? (
          <SkeletonTable rows={5} cols={4} />
        ) : recentEvents.length === 0 ? (
          <p className="text-muted text-sm">No recent events.</p>
        ) : (
          <div className="table-responsive"><table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Actor</th>
                <th>Resource</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {recentEvents.map((ev) => (
                <tr key={ev.id}>
                  <td>
                    <span className="badge badge-blue">{ev.action}</span>
                  </td>
                  <td className="text-sm">{ev.actorEmail ?? ev.actor}</td>
                  <td className="text-sm">{ev.resource} / {ev.resourceId}</td>
                  <td className="text-sm text-muted">
                    {new Date(ev.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
