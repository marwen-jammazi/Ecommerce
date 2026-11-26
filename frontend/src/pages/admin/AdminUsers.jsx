import { useState } from 'react';
import { useAdminUsers, useUpdateUser } from '../../hooks/admin.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import Pagination from '../../components/Pagination.jsx';

export default function AdminUsers() {
  const toast = useToast();
  const { user: me } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const { data, isLoading, isError, error } = useAdminUsers({ page, limit: 12, search });
  const update = useUpdateUser();
  const [confirm, setConfirm] = useState(null); // { id, kind }

  const list = data?.data || [];
  const meId = me?.id || me?._id;

  const run = (u, body, okMsg) =>
    update.mutate(
      { id: u._id, body },
      {
        onSuccess: () => {
          setConfirm(null);
          toast(okMsg, 'success');
        },
        onError: (e) => toast(e.message, 'error'),
      }
    );

  return (
    <>
      <div className="admin-head">
        <h1>Users</h1>
      </div>
      <div className="admin-filters one">
        <input className="input" type="search" placeholder="Search by name or email" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} aria-label="Search users" />
      </div>

      {isLoading && (
        <div className="center">
          <span className="spinner" aria-label="Loading" />
        </div>
      )}
      {isError && <p className="error">Could not load users ({error?.message}).</p>}
      {!isLoading && !isError && list.length === 0 && (
        <div className="empty glass">
          <p>No users found.</p>
        </div>
      )}

      {list.length > 0 && (
        <ul className="admin-list glass users">
          {list.map((u) => {
            const self = u._id === meId;
            const isAdmin = u.role === 'admin';
            const key = (k) => confirm && confirm.id === u._id && confirm.kind === k;
            return (
              <li key={u._id} className={u.isBlocked ? 'is-hidden' : ''}>
                <div className="info">
                  <span className="name">
                    {u.name} {self && <span className="meta">(you)</span>}
                  </span>
                  <span className="meta">{u.email}</span>
                </div>
                <div className="num">
                  <span className={`status ${isAdmin ? 'order s-shipped' : 'order s-pending'}`}>{isAdmin ? 'Admin' : 'Customer'}</span>
                  {u.isBlocked && <span className="status order s-cancelled">Blocked</span>}
                </div>
                <div className="actions">
                  {self ? (
                    <span className="meta">Your own account</span>
                  ) : key('block') ? (
                    <>
                      <button className="chip danger" disabled={update.isPending} onClick={() => run(u, { isBlocked: !u.isBlocked }, u.isBlocked ? 'User unblocked' : 'User blocked')}>
                        Confirm
                      </button>
                      <button className="chip" onClick={() => setConfirm(null)}>
                        Keep
                      </button>
                    </>
                  ) : key('role') ? (
                    <>
                      <button className="chip danger" disabled={update.isPending} onClick={() => run(u, { role: isAdmin ? 'user' : 'admin' }, isAdmin ? 'Admin rights removed' : 'User is now an admin')}>
                        Confirm
                      </button>
                      <button className="chip" onClick={() => setConfirm(null)}>
                        Keep
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="chip" onClick={() => setConfirm({ id: u._id, kind: 'role' })}>
                        {isAdmin ? 'Remove admin' : 'Make admin'}
                      </button>
                      <button className="chip" onClick={() => setConfirm({ id: u._id, kind: 'block' })}>
                        {u.isBlocked ? 'Unblock' : 'Block'}
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {data?.pagination && <Pagination page={data.pagination.page} pages={data.pagination.pages} onChange={setPage} />}
    </>
  );
}