import { useState, useEffect, useMemo } from 'preact/hooks';
import type { Hero, HeroSkill, HeroRole, HeroFaction } from '../data/heroes';
import { RARITY_COLOR, RARITY_SESSION, FACTIONS } from '../data/heroes';
import './HeroGrid.css';

const SYM = '/images/heroes/symbols';
const rarityIcon  = (r: string)  => `${SYM}/${r.toLowerCase()}.webp`;
const factionIcon = (f: string)  => `${SYM}/${f}.webp`;
const roleIcon    = (r: string)  => `${SYM}/${r}.webp`;

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
              <span className={`hg-rarity-badge hg-rarity-${RARITY_COLOR[hero.rarity]}`}>
                <img src={rarityIcon(hero.rarity)} alt={hero.rarity} className="hg-badge-icon" />
                {hero.rarity}
              </span>
              <span className="hg-tag">
                <img src={factionIcon(hero.faction)} alt={hero.faction} className="hg-badge-icon" />
                {FACTIONS[hero.faction].name}
              </span>
              <span className="hg-tag hg-tag-role">
                <img src={roleIcon(hero.role)} alt={hero.role} className="hg-badge-icon" />
                {hero.role.charAt(0).toUpperCase() + hero.role.slice(1)}
              </span>
              {hero.globalPassive && (
                <span className="hg-tag hg-tag-green">Global Passive</span>
              )}
            </div>
          </div>

          <hr className="hg-divider" />
          {hero.description && <p className="hg-desc">{hero.description}</p>}
          <p className="hg-faction-focus">{FACTIONS[hero.faction].focus}</p>
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

/* ── Rarity sort order (higher = stronger) ── */
const RARITY_ORDER: Record<string, number> = {
  'S9': 12, 'S8': 11, 'S7': 10, 'S6': 9, 'S5': 8,
  'S4': 7,  'S3': 6,  'S2': 5,  'S1': 4,
  'S':  3,  'A':  2,  'B':  1,
};

const FACTION_ORDER: Record<string, number> = {
  'blood-rose':     0,
  'wings-of-dawn':  1,
  'guard-of-order': 2,
};

/* ── Filter chip helpers ── */
function toggle<T>(set: T[], val: T): T[] {
  return set.includes(val) ? set.filter(v => v !== val) : [...set, val];
}

const SESSIONS   = [0, 1, 2, 3, 4];
const ROLES      = ['attack', 'support', 'defense'] as HeroRole[];
const FACTIONS_LIST = ['blood-rose', 'wings-of-dawn', 'guard-of-order'] as HeroFaction[];

const ROLE_LABEL: Record<HeroRole, string>       = { attack: 'Attack', support: 'Support', defense: 'Defense' };
const FACTION_LABEL: Record<HeroFaction, string> = {
  'blood-rose':     'Blood Rose',
  'wings-of-dawn':  'Wings of Dawn',
  'guard-of-order': 'Guard of Order',
};

/* ── Main grid ── */
export default function HeroGrid({ heroes }: Props) {
  const [selected,      setSelected]      = useState<Hero | null>(null);
  const [filterSession, setFilterSession] = useState<number[]>([]);
  const [filterRole,    setFilterRole]    = useState<HeroRole[]>([]);
  const [filterFaction, setFilterFaction] = useState<HeroFaction[]>([]);

  const close = () => setSelected(null);

  const filtered = useMemo(() => heroes
    .filter(h => {
      if (filterSession.length && !filterSession.includes(RARITY_SESSION[h.rarity])) return false;
      if (filterRole.length    && !filterRole.includes(h.role))                       return false;
      if (filterFaction.length && !filterFaction.includes(h.faction))                 return false;
      return true;
    })
    .sort((a, b) => {
      const byRarity = RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity];
      if (byRarity !== 0) return byRarity;
      return FACTION_ORDER[a.faction] - FACTION_ORDER[b.faction];
    }),
  [heroes, filterSession, filterRole, filterFaction]);

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

  const anyFilter = filterSession.length || filterRole.length || filterFaction.length;

  return (
    <div>
      {/* ── Filter bar ── */}
      <div className="hg-filters">

        <div className="hg-filter-group">
          <span className="hg-filter-label">Session</span>
          <div className="hg-chips">
            {SESSIONS.map(s => (
              <button
                key={s}
                type="button"
                className={`hg-chip hg-chip-session${filterSession.includes(s) ? ' active' : ''}`}
                onClick={() => setFilterSession(prev => toggle(prev, s))}
                title={`Session ${s}`}
              >
                <span className="hg-session-circle">{s}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="hg-filter-group">
          <span className="hg-filter-label">Role</span>
          <div className="hg-chips">
            {ROLES.map(r => (
              <button
                key={r}
                type="button"
                className={`hg-chip hg-chip-role hg-chip-icon-only${filterRole.includes(r) ? ' active' : ''}`}
                onClick={() => setFilterRole(prev => toggle(prev, r))}
                title={ROLE_LABEL[r]}
              >
                <img src={roleIcon(r)} alt={ROLE_LABEL[r]} className="hg-chip-icon-lg" />
              </button>
            ))}
          </div>
        </div>

        <div className="hg-filter-group">
          <span className="hg-filter-label">Faction</span>
          <div className="hg-chips">
            {FACTIONS_LIST.map(f => (
              <button
                key={f}
                type="button"
                className={`hg-chip hg-chip-faction hg-chip-icon-only hg-chip-${f}${filterFaction.includes(f) ? ' active' : ''}`}
                onClick={() => setFilterFaction(prev => toggle(prev, f))}
                title={FACTION_LABEL[f]}
              >
                <img src={factionIcon(f)} alt={FACTION_LABEL[f]} className="hg-chip-icon-lg" />
              </button>
            ))}
          </div>
        </div>

        {anyFilter ? (
          <button
            type="button"
            className="hg-clear-btn"
            onClick={() => { setFilterSession([]); setFilterRole([]); setFilterFaction([]); }}
          >
            ✕ Clear
          </button>
        ) : null}
      </div>

      <p className="hg-count">{filtered.length} / {heroes.length} heroes</p>

      {/* ── Grid ── */}
      <div className="hg-grid">
        {filtered.map((hero) => (
          <button
            key={hero.id}
            type="button"
            className={`hg-card faction-${hero.faction}${selected?.id === hero.id ? ' active' : ''}`}
            onClick={() => setSelected(hero)}
            aria-label={hero.name}
          >
            <img src={hero.image} alt={hero.name} className="hg-card-img" loading="lazy" />

            <img src={rarityIcon(hero.rarity)} alt={hero.rarity} className="hg-card-rarity" />

            <div className="hg-card-duo">
              <img src={factionIcon(hero.faction)} alt={hero.faction} className="hg-card-duo-icon" />
              <div className="hg-card-duo-line" />
              <img src={roleIcon(hero.role)} alt={hero.role} className="hg-card-duo-icon" />
            </div>

            {(!hero.skills || hero.skills.length === 0) && (
              <span className="hg-card-missing" title="Skills missing">!</span>
            )}
          </button>
        ))}
      </div>

      {selected && <HeroModal hero={selected} onClose={close} />}
    </div>
  );
}
