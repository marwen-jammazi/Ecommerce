import { formatPrice } from '../config.js';

export default function Price({ price, discountPrice, size = '' }) {
  const hasDiscount = discountPrice != null && discountPrice < price;
  return (
    <span className={`price ${size}`}>
      <strong>{formatPrice(hasDiscount ? discountPrice : price)}</strong>
      {hasDiscount && <s>{formatPrice(price)}</s>}
    </span>
  );
}