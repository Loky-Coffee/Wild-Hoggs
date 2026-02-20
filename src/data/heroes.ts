export interface Hero {
  id: string;
  name: string;
  rarity: 'blue' | 'purple' | 'gold' | 'legendary';
  role: string;
  type: string;
  globalPassive: boolean;
  description: string;
  image: string;
}

export const heroes: Hero[] = [
  {
    id: 'guard-of-order-1',
    name: 'Guard of Order',
    rarity: 'blue',
    role: 'Guard of Order',
    type: 'Gathering',
    globalPassive: true,
    description: 'She is a gathering hero but also one with a global passive so you don\'t really use her after a certain point and you actually only want her for the global skill.',
    image: '/images/heroes/athena1.png',
  },
  {
    id: 'guard-of-order-2',
    name: 'Guard of Order',
    rarity: 'blue',
    role: 'Guard of Order',
    type: 'Gathering',
    globalPassive: true,
    description: 'She is a gathering hero but also one with a global passive so you don\'t really use her after a certain point and you actually only want her for the global skill.',
    image: '/images/heroes/athena2.png',
  },
  {
    id: 'guard-of-order-3',
    name: 'Guard of Order',
    rarity: 'blue',
    role: 'Guard of Order',
    type: 'Gathering',
    globalPassive: true,
    description: 'She is a gathering hero but also one with a global passive so you don\'t really use her after a certain point and you actually only want her for the global skill.',
    image: '/images/heroes/athena3.png',
  },
];
