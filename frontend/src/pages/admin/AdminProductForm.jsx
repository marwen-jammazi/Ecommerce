import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { uploadImage, useProductActions } from '../../hooks/admin.js';
import { useCategories, useProduct } from '../../hooks/data.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Close } from '../../components/Icons.jsx';
import { img } from '../../config.js';

const EMPTY = { name: '', description: '', category: '', price: '', discountPrice: '', stock: '0', isActive: true, images: [] };
const MAX_IMAGES = 6;

export default function AdminProductForm() {
  const { id } = useParams();
  const editing = !!id;
  const navigate = useNavigate();
  const toast = useToast();
  const fileRef = useRef(null);
  const { data: cats = [] } = useCategories();
  const { data: existing, isLoading } = useProduct(editing ? id : null);
  const { create, update } = useProductActions();

  const [f, setF] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [uploading, setUploading] = useState(0);

  useEffect(() => {
    if (!existing) return;
    setF({
      name: existing.name || '',
      description: existing.description || '',
      category: existing.category?._id || existing.category || '',
      price: String(existing.price ?? ''),
      discountPrice: existing.discountPrice != null ? String(existing.discountPrice) : '',
      stock: String(existing.stock ?? 0),
      isActive: existing.isActive !== false,
      images: (existing.images || []).map((i) => ({ url: i.url, publicId: i.publicId })),
    });
  }, [existing]);

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const addFiles = async (files) => {
    const room = MAX_IMAGES - f.images.length;
    const picked = [...files].slice(0, Math.max(room, 0));
    if (files.length > picked.length) toast(`Up to ${MAX_IMAGES} images per product`, 'info');
    for (const file of picked) {
      if (!file.type.startsWith('image/')) {
        toast(`${file.name} is not an image`, 'error');
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast(`${file.name} is larger than 5 MB`, 'error');
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const uploaded = await uploadImage(file);
        setF((s) => ({ ...s, images: [...s.images, uploaded] }));
      } catch (e) {
        toast(`Upload failed: ${e.message}`, 'error');
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeImage = (i) => setF((s) => ({ ...s, images: s.images.filter((_, k) => k !== i) }));
  const makeCover = (i) =>
    setF((s) => {
      const imgs = [...s.images];
      const [it] = imgs.splice(i, 1);
      return { ...s, images: [it, ...imgs] };
    });

  const validate = () => {
    const e = {};
    if (!f.name.trim()) e.name = 'Name is required';
    if (!f.description.trim()) e.description = 'Description is required';
    if (!f.category) e.category = 'Choose a category';
    if (f.price === '' || Number(f.price) < 0) e.price = 'Enter a price of 0 or more';
    if (f.discountPrice !== '' && !(Number(f.discountPrice) >= 0 && Number(f.discountPrice) < Number(f.price)))
      e.discountPrice = 'Must be lower than the price';
    if (!Number.isInteger(Number(f.stock)) || Number(f.stock) < 0) e.stock = 'Whole number, 0 or more';
    return e;
  };

  const submit = (ev) => {
    ev.preventDefault();
    setFormError('');
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;

    const body = {
      name: f.name.trim(),
      description: f.description.trim(),
      category: f.category,
      price: Number(f.price),
      stock: Number(f.stock),
      isActive: f.isActive,
      images: f.images,
    };
    if (f.discountPrice !== '') body.discountPrice = Number(f.discountPrice);

    const done = (res) => {
      const saved = res?.data;
      if (saved && Array.isArray(saved.images) && saved.images.length < f.images.length) {
        toast('Saved, but the images were not kept by the server', 'error');
      } else {
        toast(editing ? 'Product updated' : 'Product created', 'success');
      }
      navigate('/admin/products');
    };
    const fail = (err) => {
      if (err.details && typeof err.details === 'object') {
        const m = {};
        for (const d of Array.isArray(err.details) ? err.details : Object.values(err.details)) {
          const k = d.path?.[0] ?? d.field;
          if (k) m[k] = d.message;
        }
        setErrors(m);
      }
      setFormError(err.message);
    };

    if (editing) update.mutate({ id, body }, { onSuccess: done, onError: fail });
    else create.mutate(body, { onSuccess: done, onError: fail });
  };

  if (editing && isLoading)
    return (
      <div className="center">
        <span className="spinner" aria-label="Loading" />
      </div>
    );

  const saving = create.isPending || update.isPending;

  return (
    <>
      <div className="admin-head">
        <h1>{editing ? 'Edit product' : 'New product'}</h1>
        <Link to="/admin/products" className="btn slim">
          Back
        </Link>
      </div>

      <form className="glass panel admin-form form-grid" onSubmit={submit} noValidate>
        {cats.length === 0 && (
          <p className="notice">
            There are no categories yet. <Link to="/admin/categories">Create one first</Link>, a product needs a category.
          </p>
        )}

        <label className="field span2">
          <span className="label">Name</span>
          <input className="input" value={f.name} onChange={set('name')} maxLength={150} />
          {errors.name && <span className="error">{errors.name}</span>}
        </label>

        <label className="field span2">
          <span className="label">Description</span>
          <textarea className="input" rows={5} value={f.description} onChange={set('description')} />
          {errors.description && <span className="error">{errors.description}</span>}
        </label>

        <label className="field">
          <span className="label">Category</span>
          <select className="input" value={f.category} onChange={set('category')}>
            <option value="">Choose...</option>
            {cats.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
          {errors.category && <span className="error">{errors.category}</span>}
        </label>

        <label className="field">
          <span className="label">Stock</span>
          <input className="input" type="number" min="0" step="1" inputMode="numeric" value={f.stock} onChange={set('stock')} />
          {errors.stock && <span className="error">{errors.stock}</span>}
        </label>

        <label className="field">
          <span className="label">Price (TND)</span>
          <input className="input" type="number" min="0" step="0.01" inputMode="decimal" value={f.price} onChange={set('price')} />
          {errors.price && <span className="error">{errors.price}</span>}
        </label>

        <label className="field">
          <span className="label">Discount price (optional)</span>
          <input className="input" type="number" min="0" step="0.01" inputMode="decimal" value={f.discountPrice} onChange={set('discountPrice')} />
          {errors.discountPrice && <span className="error">{errors.discountPrice}</span>}
        </label>

        <div className="field span2">
          <span className="label">Images ({f.images.length}/{MAX_IMAGES}), the first one is the cover</span>
          <div className="imgs">
            {f.images.map((im, i) => (
              <figure key={im.url} className={i === 0 ? 'cover' : ''}>
                <img src={img(im.url, 240)} alt={`Product ${i + 1}`} />
                <button type="button" className="x" aria-label={`Remove image ${i + 1}`} onClick={() => removeImage(i)}>
                  <Close width="14" height="14" />
                </button>
                {i > 0 && (
                  <button type="button" className="mk" onClick={() => makeCover(i)}>
                    Make cover
                  </button>
                )}
              </figure>
            ))}
            {uploading > 0 && (
              <div className="uploading">
                <span className="spinner" aria-label="Uploading" />
              </div>
            )}
            {f.images.length + uploading < MAX_IMAGES && (
              <label className="drop">
                <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
                <span>Add images</span>
                <small>JPG, PNG or WebP, up to 5 MB</small>
              </label>
            )}
          </div>
        </div>

        <label className="check span2">
          <input type="checkbox" checked={f.isActive} onChange={set('isActive')} />
          <span>Visible in the shop</span>
        </label>

        {formError && <p className="error span2">{formError}</p>}

        <div className="span2 form-actions">
          <button className="btn btn-primary" disabled={saving || uploading > 0}>
            {saving ? 'Saving...' : editing ? 'Save changes' : 'Create product'}
          </button>
          <Link to="/admin/products" className="btn">
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}