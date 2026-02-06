import { useState } from 'preact/hooks';
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

  return (
    <div>
      <div className="sort-controls">
        <label htmlFor="sort-select">{t('members.sortBy')}:</label>
        <select
          id="sort-select"
          value={sortBy}
          onChange={(e) => setSortBy((e.target as HTMLSelectElement).value as SortOption)}
        >
          <option value="name">{t('members.sortName')}</option>
          <option value="gender">{t('members.sortGender')}</option>
          <option value="level-high">{t('members.sortLevelHigh')}</option>
          <option value="level-low">{t('members.sortLevelLow')}</option>
        </select>
      </div>

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
