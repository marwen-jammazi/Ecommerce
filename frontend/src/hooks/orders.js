import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export const shortId = (id = '') => `#${String(id).slice(-6).toUpperCase()}`;

export function useOrders(page = 1) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['orders', page],
    queryFn: () => api(`/orders/my?page=${page}&limit=8`),
    enabled: !!user,
    placeholderData: keepPreviousData,
  });
}

// opts lets a page add polling, e.g. { refetchInterval: ... }
export function useOrder(id, opts = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['order', id],
    queryFn: async () => (await api(`/orders/${id}`)).data,
    enabled: !!id && !!user,
    ...opts,
  });
}

export function useCreateOrder() {
  return useMutation({
    mutationFn: (body) => api('/orders', { method: 'POST', body }),
  });
}

// provider: 'stripe' | 'flouci'. Resolves to { url } to send the customer to.
export const startPayment = (provider, orderId) =>
  api(`/payments/${provider}/checkout`, { method: 'POST', body: { orderId } });

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api(`/orders/${id}/cancel`, { method: 'PUT' }),
    onSuccess: (_res, id) => {
      qc.invalidateQueries({ queryKey: ['order', id] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['products'] }); // stock came back
    },
  });
}

export function useSubmitReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, rating, comment }) =>
      api(`/products/${productId}/reviews`, { method: 'POST', body: { rating, comment } }),
    onSuccess: (_res, v) => {
      qc.invalidateQueries({ queryKey: ['reviews', v.productId] });
      qc.invalidateQueries({ queryKey: ['product'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}