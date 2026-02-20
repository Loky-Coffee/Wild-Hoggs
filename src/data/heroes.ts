export interface HeroSkill {
  name: string;
  description: string;
  type: 'active' | 'passive' | 'global';
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
    id: 'guard-of-order',
    name: 'Guard of Order',
    rarity: 'blue',
    type: 'Gathering',
    globalPassive: true,
    description:
      "She is a gathering hero but also one with a global passive so you don't really use her after a certain point and you actually only want her for the global skill.",
    image: '/images/heroes/athena2.png',
    skills: [],
  },
];
