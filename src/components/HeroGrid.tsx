import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import type { Hero, HeroSkill, HeroRole, HeroFaction, HeroRarity } from '../data/heroes';
import { useTranslations } from '../i18n/utils';
import type { TranslationData } from '../i18n/index';
import { RARITY_COLOR, RARITY_SESSION, FACTIONS } from '../data/heroes';
import './HeroGrid.css';

const SYM = '/images/heroes/symbols';
const rarityIcon  = (r: string)  => `${SYM}/${r.toLowerCase()}.webp`;
const factionIcon = (f: string)  => `${SYM}/${f}.webp`;
const roleIcon    = (r: string)  => `${SYM}/${r}.webp`;

/**
 * Bild mit AVIF-Fassung und WebP als Rückfallebene.
 *
 * Neben jeder .webp liegt eine gleichnamige .avif (siehe make-avif.js). Wer
 * AVIF kann, lädt die kleinere Datei; alle anderen bekommen weiterhin die
 * WebP. Zusammen spart das rund ein Drittel der Bilddaten dieser Seite.
 *
 * Das <picture> steht per `display: contents` nicht im Layout — die CSS-Regeln
 * greifen unverändert am <img>.
 */
function Pic({ src, alt, className, width, height, onError }: {
  src: string; alt: string; className?: string;
  width?: number; height?: number;
  onError?: (e: Event) => void;
}) {
  return (
    <picture class="hg-pic">
      <source srcSet={src.replace(/\.webp$/, '.avif')} type="image/avif" />
      <img
        src={src}
        alt={alt}
        className={className}
        width={width}
        height={height}
        loading="lazy"
        onError={onError}
      />
    </picture>
  );
}

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
                {skill.stars != null && (
                  <span className="hg-skill-stars">
                    {Array.from({ length: 5 }, (_, i) => (
                      <span key={i} className={i < skill.stars! ? 'hg-star hg-star-filled' : 'hg-star hg-star-empty'}>
                        {i < skill.stars! ? '★' : '☆'}
                      </span>
                    ))}
                  </span>
                )}
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
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement;

    // Focus first focusable element inside dialog
    const focusable = () => dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusable()?.[0]?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const els = focusable();
      if (!els || els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      prevFocus?.focus();
    };
  }, [onClose]);

  return (
    <div className="hg-backdrop" onClick={onClose}>
      <div
        className="hg-split"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hg-hero-modal-title"
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >

        {/* Left — portrait */}
        <div className="hg-split-img-col">
          <Pic src={hero.image} alt={hero.name} className="hg-split-img" width={400} height={600} onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }} />
        </div>

        {/* Right — info */}
        <div className="hg-split-info-col">
          <button className="hg-close" onClick={onClose} type="button" aria-label="Close">✕</button>

          <div className="hg-hero-header">
            <h2 className="hg-hero-name" id="hg-hero-modal-title">{hero.name}</h2>
            <div className="hg-hero-tags">
              <span className={`hg-rarity-badge hg-rarity-${RARITY_COLOR[hero.rarity]}`}>
                <Pic src={rarityIcon(hero.rarity)} alt={hero.rarity} className="hg-badge-icon" width={16} height={16} />
                {hero.rarity}
              </span>
              <span className="hg-tag">
                <Pic src={factionIcon(hero.faction)} alt={FACTIONS[hero.faction].name} className="hg-badge-icon" width={16} height={16} />
                {FACTIONS[hero.faction].name}
              </span>
              <span className="hg-tag hg-tag-role">
                <Pic src={roleIcon(hero.role)} alt={hero.role} className="hg-badge-icon" width={16} height={16} />
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

const SESSIONS      = [0, 1, 2, 3, 4];
const ROLES         = ['attack', 'support', 'defense'] as HeroRole[];
const FACTIONS_LIST = Object.keys(FACTIONS) as HeroFaction[];
const RARITIES      = ['B', 'A', 'S', 'S1', 'S2', 'S3', 'S4'] as HeroRarity[];

const ROLE_LABEL: Record<HeroRole, string> = { attack: 'Attack', support: 'Support', defense: 'Defense' };

/* ── Main grid ── */
export default function HeroGrid({ heroes, translationData }: { heroes: Hero[]; translationData: TranslationData }) {
  const t = useTranslations(translationData);
  const [selected,      setSelected]      = useState<Hero | null>(null);
  const [search,        setSearch]        = useState('');
  const [filterRarity,  setFilterRarity]  = useState<HeroRarity[]>([]);
  const [filterSession, setFilterSession] = useState<number[]>([]);
  const [filterRole,    setFilterRole]    = useState<HeroRole[]>([]);
  const [filterFaction, setFilterFaction] = useState<HeroFaction[]>([]);

  const close = () => setSelected(null);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim().replace(/\s+/g, ' ');
    return heroes
      .filter(h => {
        if (term) {
          const inName   = h.name.toLowerCase().includes(term);
          const inSkills = h.skills?.some(s =>
            s.name.toLowerCase().includes(term) ||
            s.category.toLowerCase().includes(term) ||
            (s.effect?.toLowerCase().includes(term) ?? false) ||
            (s.levels?.some(l => l.description.toLowerCase().includes(term)) ?? false)
          ) ?? false;
          if (!inName && !inSkills) return false;
        }
        if (filterRarity.length  && !filterRarity.includes(h.rarity))                    return false;
        if (filterSession.length && !filterSession.includes(RARITY_SESSION[h.rarity]))   return false;
        if (filterRole.length    && !filterRole.includes(h.role))                         return false;
        if (filterFaction.length && !filterFaction.includes(h.faction))                   return false;
        return true;
      })
      .sort((a, b) => {
        const byRarity = RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity];
        if (byRarity !== 0) return byRarity;
        const byFaction = FACTION_ORDER[a.faction] - FACTION_ORDER[b.faction];
        if (byFaction !== 0) return byFaction;
        return a.name.localeCompare(b.name);
      });
  }, [heroes, search, filterRarity, filterSession, filterRole, filterFaction]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = selected ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selected]);

  const clearAll = () => {
    setSearch(''); setFilterRarity([]); setFilterSession([]); setFilterRole([]); setFilterFaction([]);
  };
  const anyFilter = search || filterRarity.length || filterSession.length || filterRole.length || filterFaction.length;

  return (
    <div>
      {/* ── Filter bar ── */}
      <div className="hg-filters">

        {/* Session / Role / Search / Faction / Grade */}
        <div className="hg-filter-cols">
          <div className="hg-filter-group">
            <span className="hg-filter-label">{t('heroes.session')}</span>
            <div className="hg-chips">
              {SESSIONS.map(s => (
                <button
                  key={s}
                  type="button"
                  className={`hg-chip hg-chip-session${filterSession.includes(s) ? ' active' : ''}`}
                  onClick={() => setFilterSession(prev => toggle(prev, s))}
                  aria-label={`Session ${s}`}
                >
                  <span className="hg-session-circle">{s}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="hg-filter-group">
            <span className="hg-filter-label">{t('heroes.role')}</span>
            <div className="hg-chips">
              {ROLES.map(r => (
                <button
                  key={r}
                  type="button"
                  className={`hg-chip hg-chip-role hg-chip-icon-only${filterRole.includes(r) ? ' active' : ''}`}
                  onClick={() => setFilterRole(prev => toggle(prev, r))}
                  aria-label={ROLE_LABEL[r]}
                >
                  <Pic src={roleIcon(r)} alt={ROLE_LABEL[r]} className="hg-chip-icon-lg" width={28} height={28} />
                </button>
              ))}
            </div>
          </div>

          {/* Search — middle column */}
          <div className="hg-filter-group hg-filter-group-search">
            <span className="hg-filter-label" id="hg-search-label">{t('heroes.search')}</span>
            <div className="hg-search-row">
              <span className="hg-search-icon">⌕</span>
              <input
                type="text"
                id="hg-search"
                className="hg-search"
                aria-labelledby="hg-search-label"
                placeholder={t('heroes.searchPlaceholder')}
                value={search}
                onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
              />
              {search && (
                <button type="button" className="hg-search-clear" onClick={() => setSearch('')}>✕</button>
              )}
            </div>
          </div>

          <div className="hg-filter-group">
            <span className="hg-filter-label">{t('heroes.faction')}</span>
            <div className="hg-chips">
              {FACTIONS_LIST.map(f => (
                <button
                  key={f}
                  type="button"
                  className={`hg-chip hg-chip-faction hg-chip-icon-only hg-chip-${f}${filterFaction.includes(f) ? ' active' : ''}`}
                  onClick={() => setFilterFaction(prev => toggle(prev, f))}
                  aria-label={FACTIONS[f].name}
                >
                  <Pic src={factionIcon(f)} alt={FACTIONS[f].name} className="hg-chip-icon-lg" width={28} height={28} />
                </button>
              ))}
            </div>
          </div>

          <div className="hg-filter-group">
            <span className="hg-filter-label">{t('heroes.grade')}</span>
            <div className="hg-chips">
              {RARITIES.map(r => (
                <button
                  key={r}
                  type="button"
                  className={`hg-chip hg-chip-rarity hg-chip-rarity-${RARITY_COLOR[r]}${filterRarity.includes(r) ? ' active' : ''}`}
                  onClick={() => setFilterRarity(prev => toggle(prev, r))}
                  aria-label={`Grade ${r}`}
                >
                  <span className="hg-rarity-circle">{r}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {anyFilter ? (
          <button type="button" className="hg-clear-btn" onClick={clearAll}>
            ✕ {t('heroes.clearFilters')}
          </button>
        ) : null}
      </div>

      <p className="hg-count" aria-live="polite" aria-atomic="true">{filtered.length} / {heroes.length} heroes</p>

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
            <Pic src={hero.image} alt={hero.name} className="hg-card-img" width={300} height={450} onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }} />

            <Pic src={rarityIcon(hero.rarity)} alt={hero.rarity} className="hg-card-rarity" width={155} height={155} />

            <div className="hg-card-duo">
              <Pic src={factionIcon(hero.faction)} alt={FACTIONS[hero.faction].name} className="hg-card-duo-icon" width={40} height={40} />
              <div className="hg-card-duo-line" />
              <Pic src={roleIcon(hero.role)} alt={hero.role} className="hg-card-duo-icon" width={40} height={40} />
            </div>

            {(!hero.skills || hero.skills.length === 0) && (
              <span className="hg-card-missing" title={t('heroes.skillsMissing')}>!</span>
            )}
          </button>
        ))}
      </div>

      {selected && createPortal(<HeroModal hero={selected} onClose={close} />, document.body)}
    </div>
  );
}
