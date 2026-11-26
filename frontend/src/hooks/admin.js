import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api/client.js';

const qs = (o) =>
  new URLSearchParams(Object.entries(o).filter(([, v]) => v !== '' && v != null)).toString();

// products and categories are cached on the server and in the shop screens, so refresh both after a change
function useRefresh() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['products'] });
    qc.invalidateQueries({ queryKey: ['product'] });
    qc.invalidateQueries({ queryKey: ['categories'] });
  };
}

export const useAdminProducts = (params) =>
  useQuery({
    queryKey: ['products', 'admin', params],
    queryFn: () => api(`/products?${qs({ ...params, includeInactive: 1 })}`),
    placeholderData: keepPreviousData,
  });

export function useProductActions() {
  const refresh = useRefresh();
  const opts = { onSuccess: refresh };
  const create = useMutation({ mutationFn: (body) => api('/products', { method: 'POST', body }), ...opts });
  const update = useMutation({ mutationFn: ({ id, body }) => api(`/products/${id}`, { method: 'PUT', body }), ...opts });
  const remove = useMutation({ mutationFn: (id) => api(`/products/${id}`, { method: 'DELETE' }), ...opts });
  return { create, update, remove };
}

export function useCategoryActions() {
  const refresh = useRefresh();
  const opts = { onSuccess: refresh };
  const create = useMutation({ mutationFn: (name) => api('/categories', { method: 'POST', body: { name } }), ...opts });
  const update = useMutation({ mutationFn: ({ id, name }) => api(`/categories/${id}`, { method: 'PUT', body: { name } }), ...opts });
  const remove = useMutation({ mutationFn: (id) => api(`/categories/${id}`, { method: 'DELETE' }), ...opts });
  return { create, update, remove };
}

// uploads one image to the backend (which sends it to Cloudinary) and returns { url, publicId }
export async function uploadImage(file) {
  const send = (field) => {
    const fd = new FormData();
    fd.append(field, file);
    return api('/uploads/image', { method: 'POST', body: fd });
  };
  let res;
  try {
    res = await send('image');
  } catch (e) {
    // a different multipart field name on the server shows up as an "unexpected field" error
    if (!(e instanceof ApiError) || !/unexpected|field/i.test(e.message)) throw e;
    res = await send('file');
  }
  const d = res.data || res;
  const url = d.url || d.secure_url;
  if (!url) throw new ApiError('Upload worked but no image address came back', 500);
  return { url, publicId: d.publicId || d.public_id };
}