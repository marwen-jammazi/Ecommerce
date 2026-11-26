// Fixed backdrop like the reference: soft gradient plus glass bubbles.
// The dark blurred orbs are drawn by Layout (they scroll away with the top of the page).
export default function Orbs() {
  return (
    <div className="orbs" aria-hidden="true">
      <i className="bubble b1" />
      <i className="bubble b2" />
    </div>
  );
}