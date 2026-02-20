export interface SkillLevel {
  level: number;
  description: string;
}

export interface HeroSkill {
  name: string;
  category: string;
  type: 'normal' | 'active' | 'global' | 'exclusive';
  levels?: SkillLevel[];
  effect?: string;
}

export interface Hero {
  id: string;
  name: string;
  rarity: 'blue' | 'purple' | 'gold' | 'legendary';
  type: string;
  globalPassive: boolean;
  description: string;
  image: string;
  skills?: HeroSkill[];
}

export const heroes: Hero[] = [
  {
    id: 'athena',
    name: 'Athena',
    rarity: 'blue',
    type: 'Gathering',
    globalPassive: true,
    description:
      "She is a gathering hero but also one with a global passive so you don't really use her after a certain point and you actually only want her for the global skill.",
    image: '/images/heroes/athena2.png',
    skills: [
      {
        name: 'Bullet Upgrade',
        category: 'Normal Attack Boost',
        type: 'normal',
        levels: [
          { level: 1, description: 'Increase damage factor by an additional 30.' },
          { level: 2, description: 'Increase damage factor by an additional 30.' },
          { level: 3, description: 'Increase damage factor by an additional 30.' },
          { level: 4, description: 'Increase damage factor by an additional 40.' },
          { level: 5, description: 'Increase damage factor by an additional 70.' },
        ],
      },
      {
        name: 'Pistol Shooting',
        category: 'Active Skill',
        type: 'active',
        levels: [
          { level: 1, description: 'Increase damage factor by an additional 60.' },
          { level: 2, description: 'Increase damage factor by an additional 60.' },
          { level: 3, description: 'Increase damage factor by an additional 60.' },
          { level: 4, description: 'Increase damage factor by an additional 80.' },
          { level: 5, description: 'Increase damage factor by an additional 140.' },
        ],
      },
      {
        name: 'Gathering Master: Electricity',
        category: 'Global Effect',
        type: 'global',
        levels: [
          { level: 1, description: 'Electricity Gathering speed +3%' },
          { level: 2, description: 'Gathering speed +3%' },
          { level: 3, description: 'Electricity Gathering speed +3%' },
          { level: 4, description: 'Electricity Gathering speed +3%' },
          { level: 5, description: 'Gathering speed +5%' },
        ],
      },
      {
        name: 'Faction Attack',
        category: 'Exclusive Talent',
        type: 'exclusive',
        effect: 'Increases Hero ATK of faction Guard of Order by 5%',
      },
    ],
  },
];
