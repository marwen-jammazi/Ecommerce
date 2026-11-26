// kind: 'order' | 'payment'
export default function StatusBadge({ status, kind = 'order' }) {
  const text = kind === 'payment' ? `Payment ${String(status).toLowerCase()}` : status;
  return <span className={`status ${kind} s-${String(status).toLowerCase()}`}>{text}</span>;
}