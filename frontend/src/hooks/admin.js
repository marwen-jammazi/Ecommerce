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

// ---------- dashboard ----------
export const useDash = (name, params = {}) =>
  useQuery({
    queryKey: ['dash', name, params],
    queryFn: () => api(`/admin/dashboard/${name}?${qs(params)}`),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    retry: false,
  });

// ---------- orders ----------
export const useAdminOrders = (params) =>
  useQuery({
    queryKey: ['orders', 'admin', params],
    queryFn: () => api(`/orders?${qs(params)}`),
    placeholderData: keepPreviousData,
  });

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    // both names are sent so it works with either spelling on the server
    mutationFn: ({ id, status }) => api(`/orders/${id}/status`, { method: 'PUT', body: { status, orderStatus: status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['dash'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// ---------- users ----------
export const useAdminUsers = (params) =>
  useQuery({
    queryKey: ['users', params],
    queryFn: () => api(`/users?${qs(params)}`),
    placeholderData: keepPreviousData,
  });

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => api(`/users/${id}`, { method: 'PUT', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

// ---------- reviews ----------
export const useAdminReviews = (params) =>
  useQuery({
    queryKey: ['reviews', 'admin', params],
    queryFn: () => api(`/reviews?${qs(params)}`),
    placeholderData: keepPreviousData,
  });

export function useDeleteReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api(`/reviews/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews'] });
      qc.invalidateQueries({ queryKey: ['products'] }); // rating averages changed
      qc.invalidateQueries({ queryKey: ['product'] });
    },
  });
}