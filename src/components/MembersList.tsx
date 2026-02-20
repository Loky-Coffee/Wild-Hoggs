import { useState, useMemo } from 'preact/hooks';
import type { Member } from '../data/members';
import { useTranslations } from '../i18n/utils';
import type { TranslationData } from '../i18n/index';

interface Props {
  members: Member[];
  lang: 'en' | 'de';
  translationData: TranslationData;
}

type SortOption = 'name' | 'gender' | 'level-high' | 'level-low';

export default function MembersList({ members, lang, translationData }: Props) {
  const t = useTranslations(translationData);
  const [sortBy, setSortBy] = useState<SortOption>('name');

  // Level statistics
  const levelStats = useMemo(() => {
    const counts: Record<number, number> = {};
    let total = 0;
    for (const m of members) {
      counts[m.level] = (counts[m.level] || 0) + 1;
      total += m.level;
    }
    const avg = members.length > 0 ? (total / members.length).toFixed(1) : '0';
    const levels = Object.keys(counts).map(Number).sort((a, b) => a - b);
    return { counts, avg, levels };
  }, [members]);

  // All levels visible by default
  const [hiddenLevels, setHiddenLevels] = useState<Set<number>>(new Set());

  const toggleLevel = (level: number) => {
    setHiddenLevels(prev => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  };

  const sortedMembers = useMemo(() =>
    [...members]
      .filter(m => !hiddenLevels.has(m.level))
      .sort((a, b) => {
        switch (sortBy) {
          case 'name':       return a.name.localeCompare(b.name);
          case 'gender': {
            if (a.gender === b.gender) return a.name.localeCompare(b.name);
            const order = { '♀': 0, '♂': 1, '–': 2 };
            return order[a.gender] - order[b.gender];
          }
          case 'level-high': return b.level - a.level || a.name.localeCompare(b.name);
          case 'level-low':  return a.level - b.level || a.name.localeCompare(b.name);
          default:           return 0;
        }
      }),
    [members, sortBy, hiddenLevels]
  );

  const visibleCount = sortedMembers.length;

  return (
    <div className="members-layout">

      {/* ── Level Statistics Panel ── */}
      <div className="level-stats-panel">
        <div className="avg-level-box">
          <span className="avg-label">{t('members.avgLevel')}</span>
          <span className="avg-value">{levelStats.avg}</span>
        </div>
        <div className="level-filter-section">
          <span className="level-filter-label">{t('members.filterByLevel')}</span>
          <div className="level-chips">
            {levelStats.levels.map(level => {
              const count = levelStats.counts[level];
              const hidden = hiddenLevels.has(level);
              const id = `lvl-cb-${level}`;
              return (
                <label key={level} htmlFor={id} className={`level-chip${hidden ? ' off' : ''}`}>
                  <input
                    id={id}
                    type="checkbox"
                    checked={!hidden}
                    onChange={() => toggleLevel(level)}
                    className="level-checkbox-hidden"
                  />
                  <span className="chip-level">{t('members.sortLevel')} {level}</span>
                  <span className="chip-count">{count}</span>
                </label>
              );
            })}
          </div>
        </div>
        <div className="members-sort-row">
          <span className="sort-row-label">{t('members.sortBy')}</span>
          <div className="sort-chips">
            {([
              { value: 'name',       label: t('members.sortName') },
              { value: 'gender',     label: t('members.sortGender') },
              { value: 'level-high', label: `HQ ↓` },
              { value: 'level-low',  label: `HQ ↑` },
            ] as { value: SortOption; label: string }[]).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`sort-chip${sortBy === value ? ' active' : ''}`}
                onClick={() => setSortBy(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="visible-count">
            {visibleCount} / {members.length}
          </span>
        </div>
      </div>

      {/* ── Member Grid ── */}
      <div className="members-grid">
        {sortedMembers.map((member) => (
          <div key={member.name} className="member-card">
            <div className="member-gender">{member.gender}</div>
            <div className="member-name">{member.name}</div>
            <div className="member-level">
              <span className="level-label">{t('members.sortLevel')}</span>
              <span className="level-value">{member.level}</span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
