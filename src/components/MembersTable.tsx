import { useState, useMemo } from 'preact/hooks';
import type { Member } from '../data/members';
import './MembersTable.css';

interface MembersTableProps {
  members: Member[];
  lang: 'de' | 'en';
}

type SortField = 'name' | 'rank' | 'hqLevel' | 'power' | 'joinedDate';
type SortDirection = 'asc' | 'desc';

const rankOrder = { R5: 5, R4: 4, R3: 3, R2: 2, R1: 1 };

export default function MembersTable({ members, lang }: MembersTableProps) {
  const [sortField, setSortField] = useState<SortField>('rank');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterRank, setFilterRank] = useState<string>('all');
  const [filterActive, setFilterActive] = useState<string>('all');

  const t = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      de: {
        name: 'Name',
        rank: 'Rang',
        role: 'Rolle',
        hq: 'HQ Level',
        power: 'Power',
        specialization: 'Spezialisierung',
        joined: 'Beigetreten',
        active: 'Aktiv',
        filterRank: 'Nach Rang filtern',
        filterActive: 'Nach Status filtern',
        all: 'Alle',
        yes: 'Ja',
        no: 'Nein',
        Tank: 'Panzer',
        Missile: 'Raketen',
        Aircraft: 'Flugzeug',
      },
      en: {
        name: 'Name',
        rank: 'Rank',
        role: 'Role',
        hq: 'HQ Level',
        power: 'Power',
        specialization: 'Specialization',
        joined: 'Joined',
        active: 'Active',
        filterRank: 'Filter by Rank',
        filterActive: 'Filter by Status',
        all: 'All',
        yes: 'Yes',
        no: 'No',
        Tank: 'Tank',
        Missile: 'Missile',
        Aircraft: 'Aircraft',
      },
    };
    return translations[lang][key] || key;
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredAndSortedMembers = useMemo(() => {
    let filtered = [...members];

    if (filterRank !== 'all') {
      filtered = filtered.filter((m) => m.rank === filterRank);
    }

    if (filterActive !== 'all') {
      filtered = filtered.filter((m) =>
        filterActive === 'active' ? m.active : !m.active
      );
    }

    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'rank':
          comparison = rankOrder[a.rank] - rankOrder[b.rank];
          break;
        case 'hqLevel':
          comparison = a.hqLevel - b.hqLevel;
          break;
        case 'power':
          comparison = a.power - b.power;
          break;
        case 'joinedDate':
          comparison = a.joinedDate.getTime() - b.joinedDate.getTime();
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [members, sortField, sortDirection, filterRank, filterActive]);

  const formatPower = (power: number) => {
    if (power >= 1000000) {
      return `${(power / 1000000).toFixed(1)}M`;
    }
    if (power >= 1000) {
      return `${(power / 1000).toFixed(1)}K`;
    }
    return power.toString();
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="members-table-container">
      <div className="filters">
        <div className="filter-group">
          <label htmlFor="rank-filter">{t('filterRank')}:</label>
          <select
            id="rank-filter"
            value={filterRank}
            onChange={(e) => setFilterRank((e.target as HTMLSelectElement).value)}
          >
            <option value="all">{t('all')}</option>
            <option value="R5">R5</option>
            <option value="R4">R4</option>
            <option value="R3">R3</option>
            <option value="R2">R2</option>
            <option value="R1">R1</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="active-filter">{t('filterActive')}:</label>
          <select
            id="active-filter"
            value={filterActive}
            onChange={(e) => setFilterActive((e.target as HTMLSelectElement).value)}
          >
            <option value="all">{t('all')}</option>
            <option value="active">{t('active')}</option>
            <option value="inactive">{lang === 'de' ? 'Inaktiv' : 'Inactive'}</option>
          </select>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="members-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('rank')} className="sortable">
                {t('rank')} {sortField === 'rank' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('name')} className="sortable">
                {t('name')} {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th>{t('role')}</th>
              <th onClick={() => handleSort('hqLevel')} className="sortable">
                {t('hq')} {sortField === 'hqLevel' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('power')} className="sortable">
                {t('power')} {sortField === 'power' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th>{t('specialization')}</th>
              <th onClick={() => handleSort('joinedDate')} className="sortable">
                {t('joined')} {sortField === 'joinedDate' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th>{t('active')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedMembers.map((member) => (
              <tr key={member.name} className={!member.active ? 'inactive' : ''}>
                <td>
                  <span className={`rank-badge rank-${member.rank.toLowerCase()}`}>
                    {member.rank}
                  </span>
                </td>
                <td className="member-name">{member.name}</td>
                <td>{member.role || '-'}</td>
                <td>{member.hqLevel}</td>
                <td className="power">{formatPower(member.power)}</td>
                <td>{member.specialization ? t(member.specialization) : '-'}</td>
                <td>{formatDate(member.joinedDate)}</td>
                <td>
                  <span className={`status-badge ${member.active ? 'active' : 'inactive'}`}>
                    {member.active ? t('yes') : t('no')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mobile-cards">
        {filteredAndSortedMembers.map((member) => (
          <div key={member.name} className={`member-card ${!member.active ? 'inactive' : ''}`}>
            <div className="card-header">
              <span className={`rank-badge rank-${member.rank.toLowerCase()}`}>
                {member.rank}
              </span>
              <h3>{member.name}</h3>
              <span className={`status-badge ${member.active ? 'active' : 'inactive'}`}>
                {member.active ? t('yes') : t('no')}
              </span>
            </div>
            <div className="card-body">
              {member.role && (
                <div className="card-row">
                  <span className="label">{t('role')}:</span>
                  <span className="value">{member.role}</span>
                </div>
              )}
              <div className="card-row">
                <span className="label">{t('hq')}:</span>
                <span className="value">{member.hqLevel}</span>
              </div>
              <div className="card-row">
                <span className="label">{t('power')}:</span>
                <span className="value power">{formatPower(member.power)}</span>
              </div>
              {member.specialization && (
                <div className="card-row">
                  <span className="label">{t('specialization')}:</span>
                  <span className="value">{t(member.specialization)}</span>
                </div>
              )}
              <div className="card-row">
                <span className="label">{t('joined')}:</span>
                <span className="value">{formatDate(member.joinedDate)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
