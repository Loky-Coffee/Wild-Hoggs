import { useState, useRef, useEffect } from 'preact/hooks';
import './HeroInfoShowcase.css';

const IMGS = [
  '/images/heroes/athena1.png',
  '/images/heroes/athena2.png',
  '/images/heroes/athena3.png',
];
const img = (n: number) => IMGS[(n - 1) % 3];

const NAME = 'Guard of Order';
const TYPE = 'Gathering';
const DESC =
  "She is a gathering hero but also one with a global passive so you don't really use her after a certain point and you actually only want her for the global skill.";

/* ── Shared hero info block ── */
function HeroInfo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`hi-info${compact ? ' hi-compact' : ''}`}>
      <div className="hi-header">
        <h2 className="hi-name">{NAME}</h2>
        <span className="hi-badge">Blue</span>
      </div>
      <div className="hi-tags">
        <span className="hi-tag">{TYPE}</span>
        <span className="hi-tag hi-tag-green">Global Passive</span>
      </div>
      {!compact && <p className="hi-desc">{DESC}</p>}
    </div>
  );
}

function Num({ n }: { n: number }) {
  return <span className="sc-num">{n}</span>;
}

/* ── Flip card (special HTML) ── */
function FlipCard({ n, label }: { n: number; label: string }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div className="sc-item">
      <div
        className={`sc-flip-wrap${flipped ? ' flipped' : ''}`}
        onClick={() => setFlipped((f) => !f)}
        role="button"
        tabIndex={0}
      >
        <Num n={n} />
        <div className="sc-flip-inner">
          <div className="sc-flip-front">
            <img src={img(n)} alt={NAME} className="sc-img" />
          </div>
          <div className="sc-flip-back">
            <span className="hi-badge" style={{ alignSelf: 'center' }}>Blue</span>
            <h3 className="hi-name">{NAME}</h3>
            <div className="hi-tags" style={{ justifyContent: 'center' }}>
              <span className="hi-tag">{TYPE}</span>
              <span className="hi-tag hi-tag-green">Global Passive</span>
            </div>
            <p className="hi-desc hi-desc-sm">{DESC}</p>
          </div>
        </div>
      </div>
      <div className="sc-item-label"><strong>4.</strong> 3D Flip</div>
    </div>
  );
}

/* ── Main showcase ── */
export default function HeroInfoShowcase() {
  const [active, setActive] = useState<number | null>(null);
  const [rect, setRect]     = useState<DOMRect | null>(null);

  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const open = (n: number) => {
    const el = cardRefs.current[n];
    if (el) setRect(el.getBoundingClientRect());
    setActive((a) => (a === n ? null : n));
  };
  const close = () => setActive(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // lock body scroll for full-screen panels
  useEffect(() => {
    const locks = [1, 2, 5, 9];
    document.body.style.overflow = locks.includes(active ?? -1) ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [active]);

  const LABELS: Record<number, string> = {
    1: 'Modal zentriert',
    2: 'Drawer rechts',
    3: 'Popover neben Karte',
    5: 'Bottom Sheet',
    6: 'Slide-up auf Karte',
    7: 'Tooltip oben',
    8: 'Kompaktes Popup',
    9: 'Split-Screen',
  };

  const mkCard = (n: number) => (
    <div className="sc-item" key={n}>
      <div
        ref={(el) => { cardRefs.current[n] = el; }}
        className={`sc-card sc-s16${active === n ? ' sc-active' : ''}`}
        onClick={() => open(n)}
        role="button"
        tabIndex={0}
      >
        <Num n={n} />
        <img src={img(n)} alt={NAME} className="sc-img" />

        {/* Style 6: overlay slides up within the card itself */}
        {n === 6 && (
          <div className={`sc-slide-overlay${active === 6 ? ' open' : ''}`}>
            <span className="hi-badge" style={{ alignSelf: 'flex-start' }}>Blue</span>
            <span className="hi-name-sm">{NAME}</span>
            <span className="hi-tag">{TYPE}</span>
            <p className="hi-desc-sm">{DESC}</p>
          </div>
        )}
      </div>
      <div className="sc-item-label"><strong>{n}.</strong> {LABELS[n]}</div>
    </div>
  );

  return (
    <div className="sc-wrap">
      <div className="sc-grid9">
        {mkCard(1)}
        {mkCard(2)}
        {mkCard(3)}
        <FlipCard n={4} label="3D Flip" />
        {mkCard(5)}
        {mkCard(6)}
        {mkCard(7)}
        {mkCard(8)}
        {mkCard(9)}
      </div>

      {/* ── 1: Centered modal with backdrop ── */}
      {active === 1 && (
        <div className="hi-backdrop" onClick={close}>
          <div className="hi-modal" onClick={(e) => e.stopPropagation()}>
            <button className="hi-close" onClick={close}>✕</button>
            <img src={img(1)} alt={NAME} className="hi-modal-img" />
            <HeroInfo />
          </div>
        </div>
      )}

      {/* ── 2: Right drawer ── */}
      {active === 2 && (
        <div className="hi-backdrop hi-backdrop-side" onClick={close}>
          <div className="hi-drawer" onClick={(e) => e.stopPropagation()}>
            <button className="hi-close" onClick={close}>✕</button>
            <img src={img(2)} alt={NAME} className="hi-drawer-img" />
            <HeroInfo />
          </div>
        </div>
      )}

      {/* ── 3: Popover fixed beside card ── */}
      {active === 3 && rect && (
        <>
          <div className="hi-ghost-backdrop" onClick={close} />
          <div
            className="hi-popover"
            style={{
              position: 'fixed',
              top:  `${rect.top}px`,
              left: `${rect.right + 14}px`,
            }}
          >
            <div className="hi-popover-arrow" />
            <img src={img(3)} alt={NAME} className="hi-popover-img" />
            <HeroInfo compact />
          </div>
        </>
      )}

      {/* ── 5: Bottom sheet ── */}
      {active === 5 && (
        <div className="hi-backdrop hi-backdrop-side" onClick={close}>
          <div className="hi-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="hi-sheet-handle" />
            <button className="hi-close" onClick={close}>✕</button>
            <div className="hi-sheet-body">
              <img src={img(2)} alt={NAME} className="hi-sheet-img" />
              <HeroInfo />
            </div>
          </div>
        </div>
      )}

      {/* ── 7: Tooltip above card ── */}
      {active === 7 && rect && (
        <>
          <div className="hi-ghost-backdrop" onClick={close} />
          <div
            className="hi-tooltip"
            style={{
              position: 'fixed',
              top:  `${rect.top - 14}px`,
              left: `${rect.left + rect.width / 2}px`,
              transform: 'translateX(-50%) translateY(-100%)',
            }}
          >
            <HeroInfo compact />
            <div className="hi-tooltip-arrow" />
          </div>
        </>
      )}

      {/* ── 8: Compact popup (small, centered, light backdrop) ── */}
      {active === 8 && (
        <>
          <div className="hi-ghost-backdrop" onClick={close} />
          <div className="hi-compact-popup">
            <button className="hi-close" onClick={close}>✕</button>
            <img src={img(3)} alt={NAME} className="hi-compact-img" />
            <HeroInfo compact />
          </div>
        </>
      )}

      {/* ── 9: Split screen ── */}
      {active === 9 && (
        <div className="hi-backdrop" onClick={close}>
          <div className="hi-split" onClick={(e) => e.stopPropagation()}>
            <button className="hi-close" onClick={close}>✕</button>
            <div className="hi-split-img">
              <img src={img(1)} alt={NAME} className="sc-img" style={{ borderRadius: '14px' }} />
            </div>
            <div className="hi-split-info">
              <HeroInfo />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
