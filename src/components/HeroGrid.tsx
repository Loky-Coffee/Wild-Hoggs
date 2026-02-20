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

  useEffect(() => {
    if (!selected) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [selected]);

  useEffect(() => {
    document.body.style.overflow = selected ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selected]);

  return (
    <div>
      {/* ── Hero Grid ── */}
      <div className="hg-grid">
        {heroes.map((hero) => (
          <button
            key={hero.id}
            type="button"
            className={`hg-card rarity-${hero.rarity}${selected?.id === hero.id ? ' active' : ''}`}
            onClick={() => open(hero)}
            aria-label={hero.name}
          >
            <img
              src={hero.image}
              alt={hero.name}
              className="hg-card-img"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {/* ── Split-Screen Modal ── */}
      {selected && (
        <div className="hg-backdrop" onClick={close}>
          <div className="hg-split" onClick={(e) => e.stopPropagation()}>

            {/* Left — portrait */}
            <div className="hg-split-img-col">
              <img
                src={selected.image}
                alt={selected.name}
                className="hg-split-img"
              />
            </div>

            {/* Right — info */}
            <div className="hg-split-info-col">
              <button className="hg-close" onClick={close} type="button" aria-label="Close">✕</button>

              <div className="hg-hero-header">
                <h2 className="hg-hero-name">{selected.name}</h2>
                <div className="hg-hero-tags">
                  <span className={`hg-rarity-badge hg-rarity-${selected.rarity}`}>
                    {RARITY_LABEL[selected.rarity]}
                  </span>
                  <span className="hg-tag">{selected.type}</span>
                  {selected.globalPassive && (
                    <span className="hg-tag hg-tag-green">Global Passive</span>
                  )}
                </div>
              </div>

              <hr className="hg-divider" />

              <p className="hg-desc">{selected.description}</p>

              <hr className="hg-divider" />

              {/* Skills section — ready for future content */}
              <div className="hg-skills-section">
                <h3 className="hg-skills-title">Skills</h3>
                {selected.skills && selected.skills.length > 0 ? (
                  <div className="hg-skills-list">
                    {selected.skills.map((skill) => (
                      <div key={skill.name} className={`hg-skill hg-skill-${skill.type}`}>
                        <div className="hg-skill-header">
                          <span className="hg-skill-name">{skill.name}</span>
                          <span className="hg-skill-type">{skill.type}</span>
                        </div>
                        <p className="hg-skill-desc">{skill.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="hg-skills-empty">Skills coming soon...</p>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
