import { useState } from 'react';
import { useCategories } from '../../hooks/data.js';
import { useCategoryActions } from '../../hooks/admin.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Trash } from '../../components/Icons.jsx';

export default function AdminCategories() {
  const toast = useToast();
  const { data: cats = [], isLoading } = useCategories();
  const { create, update, remove } = useCategoryActions();
  const [name, setName] = useState('');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [confirming, setConfirming] = useState(null);

  const fail = (e) => toast(e.message, 'error');

  const add = (ev) => {
    ev.preventDefault();
    const n = name.trim();
    if (!n) return;
    create.mutate(n, {
      onSuccess: () => {
        setName('');
        toast('Category created', 'success');
      },
      onError: fail,
    });
  };

  const save = (id) => {
    const n = editName.trim();
    if (!n) return;
    update.mutate(
      { id, name: n },
      {
        onSuccess: () => {
          setEditId(null);
          toast('Category renamed', 'success');
        },
        onError: fail,
      }
    );
  };

  const del = (id) =>
    remove.mutate(id, {
      onSuccess: () => {
        setConfirming(null);
        toast('Category deleted', 'success');
      },
      onError: fail,
    });

  return (
    <>
      <div className="admin-head">
        <h1>Categories</h1>
      </div>

      <form className="glass panel cat-add" onSubmit={add}>
        <input className="input" placeholder="New category name" value={name} onChange={(e) => setName(e.target.value)} aria-label="New category name" maxLength={60} />
        <button className="btn btn-primary" disabled={create.isPending || !name.trim()}>
          Add
        </button>
      </form>

      {isLoading && (
        <div className="center">
          <span className="spinner" aria-label="Loading" />
        </div>
      )}

      {!isLoading && cats.length === 0 && (
        <div className="empty glass">
          <p>No categories yet. Add your first one above.</p>
        </div>
      )}

      {cats.length > 0 && (
        <ul className="admin-list glass cats">
          {cats.map((c) => (
            <li key={c._id}>
              {editId === c._id ? (
                <>
                  <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} aria-label="Category name" autoFocus />
                  <div className="actions">
                    <button className="chip active" onClick={() => save(c._id)} disabled={update.isPending}>
                      Save
                    </button>
                    <button className="chip" onClick={() => setEditId(null)}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="info">
                    <span className="name">{c.name}</span>
                    <span className="meta">{c.slug}</span>
                  </div>
                  <div className="actions">
                    <button
                      className="chip"
                      onClick={() => {
                        setEditId(c._id);
                        setEditName(c.name);
                      }}
                    >
                      Rename
                    </button>
                    {confirming === c._id ? (
                      <>
                        <button className="chip danger" onClick={() => del(c._id)} disabled={remove.isPending}>
                          Confirm
                        </button>
                        <button className="chip" onClick={() => setConfirming(null)}>
                          Keep
                        </button>
                      </>
                    ) : (
                      <button className="btn-icon" aria-label={`Delete ${c.name}`} onClick={() => setConfirming(c._id)}>
                        <Trash width="16" height="16" />
                      </button>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}