import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldPlus, Trash2 } from 'lucide-react';
import type { AxiosError } from 'axios';
import { rolesApi, type Role, type CreateRoleDto } from '@/api/endpoints';
import { toast } from '@/store/toastStore';
import { Skeleton } from '@/components/Skeleton';

function RoleModal({
  onClose,
  onSave,
  saving,
}: {
  onClose: () => void;
  onSave: (dto: CreateRoleDto) => void;
  saving?: boolean;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }} onClick={onClose}>
      <div className="card" style={{ width: '100%', maxWidth: 400, margin: '1rem' }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginBottom: '1.25rem', fontWeight: 600 }}>Create Role</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input className="input" placeholder="Role name" value={name}
            onChange={(e) => setName(e.target.value)} />
          <textarea className="input" placeholder="Description" value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ resize: 'vertical', minHeight: 80 }} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => onSave({ name, description })}
            disabled={!name.trim() || saving}
          >
            {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RoleSkeleton() {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <Skeleton width={120} height={16} style={{ marginBottom: 8 }} />
          <Skeleton width={200} height={12} />
        </div>
        <Skeleton width={80} height={22} borderRadius={999} />
      </div>
    </div>
  );
}

export function RolesPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesApi.list(),
  });
  const roles: Role[] = data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (dto: CreateRoleDto) => rolesApi.create(dto),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['roles'] });
      setShowModal(false);
      toast.success(`Role "${res.data.name}" created`);
    },
    onError: (err: unknown) => {
      const msg = (err as AxiosError<{ message: string }>)?.response?.data?.message;
      toast.error(msg || 'Failed to create role');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => rolesApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Role deleted');
    },
    onError: (err: unknown) => {
      const msg = (err as AxiosError<{ message: string }>)?.response?.data?.message;
      toast.error(msg || 'Failed to delete role');
    },
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Roles</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <ShieldPlus size={15} /> New Role
        </button>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[1, 2, 3, 4].map((i) => <RoleSkeleton key={i} />)}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {roles.map((role) => (
            <div key={role.id} className="card" style={{ cursor: 'pointer' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                onClick={() => setExpanded(expanded === role.id ? null : role.id)}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{role.name}</div>
                  <div className="text-muted text-sm">{role.description}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge badge-blue">{role.permissions?.length ?? 0} permissions</span>
                  {!role.isSystem && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(role); }}
                      title="Delete role"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>

              {expanded === role.id && role.permissions && role.permissions.length > 0 && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                    PERMISSIONS
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {role.permissions.map((p) => (
                      <span key={p.id} className="badge badge-gray">
                        {p.resource}:{p.action}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          {roles.length === 0 && (
            <p className="text-muted text-sm">No roles found.</p>
          )}
        </div>
      )}

      {showModal && (
        <RoleModal
          onClose={() => setShowModal(false)}
          onSave={(dto) => createMutation.mutate(dto)}
          saving={createMutation.isPending}
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
            <h2 style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Eliminar rol</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              ¿Deseas eliminar el rol <strong>"{deleteTarget.name}"</strong>?
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
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
