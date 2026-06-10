import { useState } from 'react';
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Search, Trash2, Edit2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { AxiosError } from 'axios';
import { usersApi, rolesApi, type User, type CreateUserDto, type UpdateUserDto } from '@/api/endpoints';
import { toast } from '@/store/toastStore';
import { SkeletonTable } from '@/components/Skeleton';

const statusBadge: Record<string, string> = {
  ACTIVE: 'badge-green',
  INACTIVE: 'badge-gray',
  SUSPENDED: 'badge-red',
  PENDING: 'badge-yellow',
};

function UserModal({
  user,
  currentRoleId,
  onClose,
  onSave,
  saving,
}: {
  user?: User;
  currentRoleId?: string;
  onClose: () => void;
  onSave: (data: CreateUserDto | UpdateUserDto, roleId?: string) => void;
  saving?: boolean;
}) {
  const [form, setForm] = useState({
    email: user?.email ?? '',
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    status: user?.status ?? 'ACTIVE',
    roleId: currentRoleId ?? '',
  });

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesApi.list(),
  });
  const roles = rolesData?.data ?? [];

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: '100%', maxWidth: 440, margin: '1rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginBottom: '1.25rem', fontWeight: 600 }}>
          {user ? 'Edit User' : 'Create User'}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {!user && (
            <input className="input" placeholder="Email" type="email" autoComplete="off"
              value={form.email} onChange={(e) => set('email', e.target.value)} />
          )}
          <input className="input" placeholder="First name" autoComplete="off" value={form.firstName}
            onChange={(e) => set('firstName', e.target.value)} />
          <input className="input" placeholder="Last name" autoComplete="off" value={form.lastName}
            onChange={(e) => set('lastName', e.target.value)} />
          {user && (
            <select className="input" value={form.status}
              onChange={(e) => set('status', e.target.value)}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="PENDING">Pending</option>
            </select>
          )}
          <select className="input" value={form.roleId}
            onChange={(e) => set('roleId', e.target.value)}>
            <option value="">{user ? 'No role' : 'No role (assign later)'}</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={saving}
            onClick={() => onSave(
              user
                ? { firstName: form.firstName, lastName: form.lastName, status: form.status as UpdateUserDto['status'] }
                : { email: form.email, firstName: form.firstName, lastName: form.lastName },
              form.roleId || undefined,
            )}
          >
            {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : (user ? 'Save' : 'Create')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function UsersPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<'create' | User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search],
    queryFn: () => usersApi.list({ page, limit: 10, search: search || undefined }),
    placeholderData: (prev) => prev,
  });

  const users = data?.data.data ?? [];
  const total = data?.data.meta.total ?? 0;
  const totalPages = data?.data.meta.totalPages ?? 1;

  const roleQueries = useQueries({
    queries: users.map((u) => ({
      queryKey: ['user-roles', u.id],
      queryFn: () => rolesApi.userRoles(u.id),
      staleTime: 30_000,
    })),
  });
  const userRoleMap: Record<string, { id: string; name: string; allIds: string[] } | undefined> = {};
  users.forEach((u, i) => {
    const assignments = roleQueries[i]?.data?.data;
    userRoleMap[u.id] = assignments?.[0]
      ? {
          id: assignments[0].roleId,
          name: assignments[0].roleName,
          allIds: assignments.map((a) => a.roleId),
        }
      : undefined;
  });

  const createMutation = useMutation({
    mutationFn: async ({ dto, roleId }: { dto: CreateUserDto; roleId?: string }) => {
      const res = await usersApi.create(dto);
      if (roleId) await usersApi.assignRole(res.data.id, roleId);
      return res;
    },
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      setModal(null);
      toast.success(`User ${res.data.email} created`);
    },
    onError: (err: unknown) => {
      const msg = (err as AxiosError<{ message: string }>)?.response?.data?.message;
      toast.error(msg || 'Failed to create user');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, dto, roleId, prevRoleIds }: {
      id: string; dto: UpdateUserDto; roleId?: string; prevRoleIds?: string[];
    }) => {
      const res = await usersApi.update(id, dto);
      const prev = prevRoleIds ?? [];
      // Revoke every role that is not the selected one (also cleans up duplicates)
      for (const oldId of prev) {
        if (oldId !== roleId) await rolesApi.revoke(id, oldId);
      }
      if (roleId && !prev.includes(roleId)) {
        await usersApi.assignRole(id, roleId);
      }
      return res;
    },
    onSuccess: (_res, vars) => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      void qc.invalidateQueries({ queryKey: ['user-roles', vars.id] });
      setModal(null);
      toast.success('User updated successfully');
    },
    onError: (err: unknown) => {
      const msg = (err as AxiosError<{ message: string }>)?.response?.data?.message;
      toast.error(msg || 'Failed to update user');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deleted');
    },
    onError: (err: unknown) => {
      const msg = (err as AxiosError<{ message: string }>)?.response?.data?.message;
      toast.error(msg || 'Failed to delete user');
    },
  });

  const handleSave = (data: CreateUserDto | UpdateUserDto, roleId?: string) => {
    if (modal === 'create') {
      createMutation.mutate({ dto: data as CreateUserDto, roleId });
    } else if (modal && typeof modal === 'object') {
      updateMutation.mutate({
        id: modal.id,
        dto: data as UpdateUserDto,
        roleId,
        prevRoleIds: userRoleMap[modal.id]?.allIds,
      });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Users <span className="text-muted text-sm">({total})</span></h1>
        <button className="btn btn-primary" onClick={() => setModal('create')}>
          <UserPlus size={15} /> New User
        </button>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={15} style={{ position: 'absolute', left: 10, color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ paddingLeft: 32 }}
            type="search"
            name="users-table-filter"
            placeholder="Search by name or email..."
            autoComplete="one-time-code"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <SkeletonTable rows={6} cols={6} />
        ) : users.length === 0 ? (
          <p className="text-muted text-sm" style={{ padding: '1rem 0' }}>No users found.</p>
        ) : (
          <>
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Role</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.firstName} {u.lastName}</td>
                      <td className="text-sm">{u.email}</td>
                      <td>
                        <span className={`badge ${statusBadge[u.status] ?? 'badge-gray'}`}>
                          {u.status}
                        </span>
                      </td>
                      <td>
                        {userRoleMap[u.id]
                          ? <span className="badge badge-blue">{userRoleMap[u.id]!.name}</span>
                          : <span className="text-muted text-sm">—</span>}
                      </td>
                      <td className="text-sm text-muted">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setModal(u)}
                            title="Edit user"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            disabled={deleteMutation.isPending}
                            onClick={() => setDeleteTarget(u)}
                            title="Delete user"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-sm text-muted">{page} / {totalPages}</span>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {modal && (
        <UserModal
          user={modal !== 'create' ? modal : undefined}
          currentRoleId={modal !== 'create' ? userRoleMap[modal.id]?.id : undefined}
          onClose={() => setModal(null)}
          onSave={handleSave}
          saving={isSaving}
        />
      )}

      {deleteTarget && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="card"
            style={{ maxWidth: 400, width: '100%', margin: '1rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Eliminar usuario</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              ¿Deseas eliminar a{' '}
              <strong>{deleteTarget.firstName} {deleteTarget.lastName}</strong>?
              Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-danger"
                disabled={deleteMutation.isPending}
                onClick={() => { deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null); }}
              >
                {deleteMutation.isPending
                  ? <span className="spinner" style={{ width: 14, height: 14 }} />
                  : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
