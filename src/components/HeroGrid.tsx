import { useState, useEffect } from 'preact/hooks';
import type { Hero } from '../data/heroes';
import './HeroGrid.css';

interface Props {
  heroes: Hero[];
}

const RARITY_LABEL: Record<string, string> = {
  blue:      'Blue',
  purple:    'Purple',
  gold:      'Gold',
  legendary: 'Legendary',
};

export default function HeroGrid({ heroes }: Props) {
  const [selected, setSelected] = useState<Hero | null>(null);

  const open  = (hero: Hero) => setSelected(hero);
  const close = () => setSelected(null);

  // Close on Escape key
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = selected ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selected]);

  return (
    <div>
      {/* ── Hero Grid ── */}
      <div className="hero-grid">
        {heroes.map((hero) => (
          <button
            key={hero.id}
            type="button"
            className={`hero-card rarity-${hero.rarity}${selected?.id === hero.id ? ' active' : ''}`}
            onClick={() => open(hero)}
            aria-label={hero.name}
          >
            <div className="hero-card-img-wrap">
              <img
                src={hero.image}
                alt={hero.name}
                className="hero-card-img"
                loading="lazy"
              />
            </div>

            <div className="hero-card-overlay">
              <span className={`rarity-badge rarity-badge-${hero.rarity}`}>
                {RARITY_LABEL[hero.rarity]}
              </span>
              <span className="hero-card-name">{hero.name}</span>
              <span className="hero-card-type">{hero.type}</span>
            </div>

            {/* shimmer on hover */}
            <div className="hero-card-shimmer" />
          </button>
        ))}
      </div>

      {/* ── Detail Modal ── */}
      {selected && (
        <div
          className="hero-modal-backdrop"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label={selected.name}
        >
          <div
            className="hero-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="hero-modal-close"
              onClick={close}
              aria-label="Close"
            >
              ✕
            </button>

            {/* Portrait */}
            <div className="hero-modal-img-col">
              <div className={`hero-modal-img-frame rarity-frame-${selected.rarity}`}>
                <img
                  src={selected.image}
                  alt={selected.name}
                  className="hero-modal-img"
                />
              </div>
            </div>

            {/* Info */}
            <div className="hero-modal-info">
              <div className="hero-modal-top">
                <h2 className="hero-modal-name">{selected.name}</h2>
                <div className="hero-modal-tags">
                  <span className={`rarity-badge rarity-badge-${selected.rarity}`}>
                    {RARITY_LABEL[selected.rarity]}
                  </span>
                  <span className="hero-tag">{selected.type}</span>
                  {selected.globalPassive && (
                    <span className="hero-tag hero-tag-global">Global Passive</span>
                  )}
                </div>
              </div>

              <hr className="hero-modal-divider" />

              <p className="hero-modal-desc">{selected.description}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
