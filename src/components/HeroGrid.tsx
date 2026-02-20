import { useState, useEffect } from 'preact/hooks';
import type { Hero, HeroSkill } from '../data/heroes';
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

const TYPE_COLOR: Record<HeroSkill['type'], string> = {
  normal:    'skill-normal',
  active:    'skill-active',
  global:    'skill-global',
  exclusive: 'skill-exclusive',
};

const TYPE_LABEL: Record<HeroSkill['type'], string> = {
  normal:    'Normal Attack',
  active:    'Active',
  global:    'Global',
  exclusive: 'Exclusive',
};

/* ── Skill accordion (self-contained state) ── */
function SkillAccordion({ skills }: { skills: HeroSkill[] }) {
  const [open, setOpen] = useState<number>(0);

  const toggle = (i: number) => setOpen((prev) => (prev === i ? -1 : i));

  return (
    <div className="hg-skills-list">
      {skills.map((skill, i) => {
        const isOpen = open === i;
        return (
          <div key={skill.name} className={`hg-skill-item ${TYPE_COLOR[skill.type]}`}>
            <button
              type="button"
              className="hg-skill-header"
              onClick={() => toggle(i)}
              aria-expanded={isOpen}
            >
              <div className="hg-skill-header-left">
                <span className="hg-skill-name">{skill.name}</span>
                <span className={`hg-skill-cat-badge ${TYPE_COLOR[skill.type]}-badge`}>
                  {TYPE_LABEL[skill.type]}
                </span>
              </div>
              <span className={`hg-skill-chevron${isOpen ? ' open' : ''}`}>›</span>
            </button>

            {isOpen && (
              <div className="hg-skill-body">
                <p className="hg-skill-category-label">{skill.category}</p>

                {skill.effect && (
                  <p className="hg-skill-effect">{skill.effect}</p>
                )}

                {skill.levels && (
                  <div className="hg-skill-levels">
                    {skill.levels.map((l) => (
                      <div key={l.level} className="hg-skill-level-row">
                        <span className="hg-skill-lv">Lv.{l.level}</span>
                        <span className="hg-skill-lv-desc">{l.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Modal (split-screen) ── */
function HeroModal({ hero, onClose }: { hero: Hero; onClose: () => void }) {
  return (
    <div className="hg-backdrop" onClick={onClose}>
      <div className="hg-split" onClick={(e) => e.stopPropagation()}>

        {/* Left — portrait */}
        <div className="hg-split-img-col">
          <img src={hero.image} alt={hero.name} className="hg-split-img" />
        </div>

        {/* Right — info */}
        <div className="hg-split-info-col">
          <button className="hg-close" onClick={onClose} type="button" aria-label="Close">✕</button>

          <div className="hg-hero-header">
            <h2 className="hg-hero-name">{hero.name}</h2>
            <div className="hg-hero-tags">
              <span className={`hg-rarity-badge hg-rarity-${hero.rarity}`}>
                {RARITY_LABEL[hero.rarity]}
              </span>
              <span className="hg-tag">{hero.type}</span>
              {hero.globalPassive && (
                <span className="hg-tag hg-tag-green">Global Passive</span>
              )}
            </div>
          </div>

          <hr className="hg-divider" />
          <p className="hg-desc">{hero.description}</p>
          <hr className="hg-divider" />

          <div className="hg-skills-section">
            <h3 className="hg-skills-title">Skills</h3>
            {hero.skills && hero.skills.length > 0
              ? <SkillAccordion skills={hero.skills} />
              : <p className="hg-skills-empty">Skills coming soon...</p>
            }
          </div>
        </div>

      </div>
    </div>
  );
}

/* ── Main grid ── */
export default function HeroGrid({ heroes }: Props) {
  const [selected, setSelected] = useState<Hero | null>(null);

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
      <div className="hg-grid">
        {heroes.map((hero) => (
          <button
            key={hero.id}
            type="button"
            className={`hg-card rarity-${hero.rarity}${selected?.id === hero.id ? ' active' : ''}`}
            onClick={() => setSelected(hero)}
            aria-label={hero.name}
          >
            <img src={hero.image} alt={hero.name} className="hg-card-img" loading="lazy" />
          </button>
        ))}
      </div>

      {selected && <HeroModal hero={selected} onClose={close} />}
    </div>
  );
}
