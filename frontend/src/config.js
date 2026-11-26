export const STORE_NAME = 'Atelier';
export const CURRENCY = 'TND';

// keep in sync with the backend (order.controller.js)
export const FREE_SHIPPING_OVER = 100;
export const SHIPPING_FEE = 7;

export const formatPrice = (n) => `${Number(n || 0).toFixed(2)} ${CURRENCY}`;

// ask Cloudinary for a smaller version of an image (other hosts are left untouched)
export const img = (url, width) =>
  url && url.includes('res.cloudinary.com') ? url.replace('/upload/', `/upload/w_${width},c_limit/`) : url;