import { useMemo } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const qs = (o) =>
  new URLSearchParams(Object.entries(o).filter(([, v]) => v !== '' && v != null)).toString();

export const useCategories = () =>
  useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await api('/categories')).data,
    staleTime: 10 * 60_000,
  });

// resolves to { data: [...products], pagination }
export const useProducts = (params) =>
  useQuery({
    queryKey: ['products', params],
    queryFn: () => api(`/products?${qs(params)}`),
    placeholderData: keepPreviousData,
  });

export const useProduct = (idOrSlug) =>
  useQuery({
    queryKey: ['product', idOrSlug],
    queryFn: async () => (await api(`/products/${encodeURIComponent(idOrSlug)}`)).data,
    enabled: !!idOrSlug,
  });

export const useReviews = (productId, page = 1) =>
  useQuery({
    queryKey: ['reviews', productId, page],
    queryFn: () => api(`/products/${productId}/reviews?page=${page}&limit=5`),
    enabled: !!productId,
    placeholderData: keepPreviousData,
  });

export function useCart() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['cart'],
    queryFn: async () => (await api('/cart')).data,
    enabled: !!user,
  });
}

export function useCartActions() {
  const qc = useQueryClient();
  const set = (res) => qc.setQueryData(['cart'], res.data);

  const add = useMutation({
    mutationFn: ({ productId, quantity = 1 }) => api('/cart/items', { method: 'POST', body: { productId, quantity } }),
    onSuccess: set,
  });
  const update = useMutation({
    mutationFn: ({ productId, quantity }) => api(`/cart/items/${productId}`, { method: 'PUT', body: { quantity } }),
    onSuccess: set,
  });
  const remove = useMutation({
    mutationFn: (productId) => api(`/cart/items/${productId}`, { method: 'DELETE' }),
    onSuccess: set,
  });
  return { add, update, remove };
}

export function useLikes() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ['likes'],
    queryFn: async () => (await api('/me/likes')).data,
    enabled: !!user,
  });
  const ids = useMemo(() => new Set((q.data || []).map((p) => p._id)), [q.data]);

  const toggle = useMutation({
    mutationFn: ({ id, liked }) => api(`/products/${id}/like`, { method: liked ? 'DELETE' : 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['likes'] }),
  });

  return { ids, products: q.data || [], loading: q.isLoading, toggle };
}