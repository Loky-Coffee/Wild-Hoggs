import { useState } from 'preact/hooks';
import type { Member } from '../data/members';

interface Props {
  members: Member[];
  lang: 'en' | 'de';
}

type SortOption = 'name' | 'gender' | 'level-high' | 'level-low';

export default function MembersList({ members, lang }: Props) {
  const [sortBy, setSortBy] = useState<SortOption>('name');

  const sortedMembers = [...members].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'gender':
        // Sort order: ♀, ♂, –
        if (a.gender === b.gender) return a.name.localeCompare(b.name);
        const genderOrder = { '♀': 0, '♂': 1, '–': 2 };
        return genderOrder[a.gender] - genderOrder[b.gender];
      case 'level-high':
        return b.level - a.level || a.name.localeCompare(b.name);
      case 'level-low':
        return a.level - b.level || a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });

  const t = {
    sortBy: lang === 'de' ? 'Sortieren nach' : 'Sort by',
    name: lang === 'de' ? 'Name' : 'Name',
    gender: lang === 'de' ? 'Geschlecht' : 'Gender',
    levelHigh: lang === 'de' ? 'Level (hoch-niedrig)' : 'Level (high-low)',
    levelLow: lang === 'de' ? 'Level (niedrig-hoch)' : 'Level (low-high)',
    level: lang === 'de' ? 'Level' : 'Level',
  };

  return (
    <div>
      <div className="sort-controls">
        <label htmlFor="sort-select">{t.sortBy}:</label>
        <select
          id="sort-select"
          value={sortBy}
          onChange={(e) => setSortBy((e.target as HTMLSelectElement).value as SortOption)}
        >
          <option value="name">{t.name}</option>
          <option value="gender">{t.gender}</option>
          <option value="level-high">{t.levelHigh}</option>
          <option value="level-low">{t.levelLow}</option>
        </select>
      </div>

      <div className="members-grid">
        {sortedMembers.map((member) => (
          <div key={member.name} className="member-card">
            <div className="member-gender">{member.gender}</div>
            <div className="member-name">{member.name}</div>
            <div className="member-level">
              <span className="level-label">{t.level}</span>
              <span className="level-value">{member.level}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
