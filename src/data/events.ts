import { z } from 'zod';

export const EventTypeSchema = z.enum(['Rally', 'War', 'General Trial', 'Marshal Guard', 'Custom']);
export const EventStatusSchema = z.enum(['upcoming', 'ongoing', 'completed']);

export const EventSchema = z.object({
  title: z.string(),
  type: EventTypeSchema,
  date: z.date(),
  time: z.string(),
  description: z.string(),
  participants: z.number().optional(),
  status: EventStatusSchema,
});

export type Event = z.infer<typeof EventSchema>;

export const events: Event[] = [
  {
    title: 'Guild Rally - Zombie Horde',
    type: 'Rally',
    date: new Date('2026-02-05'),
    time: '20:00',
    description: 'Massive rally against zombie horde. All R3+ members required.',
    participants: 15,
    status: 'upcoming',
  },
  {
    title: 'Alliance War Preparation',
    type: 'War',
    date: new Date('2026-02-07'),
    time: '18:00',
    description: 'Strategy meeting for upcoming alliance war. Discord attendance mandatory.',
    status: 'upcoming',
  },
  {
    title: 'General Trial Event',
    type: 'General Trial',
    date: new Date('2026-02-08'),
    time: '14:00',
    description: 'Weekly General Trial. Coordinate your best generals.',
    participants: 20,
    status: 'upcoming',
  },
  {
    title: 'Marshal Guard Defense',
    type: 'Marshal Guard',
    date: new Date('2026-02-10'),
    time: '21:00',
    description: 'Defend our marshals during resource gathering.',
    participants: 10,
    status: 'upcoming',
  },
  {
    title: 'Guild Training Session',
    type: 'Custom',
    date: new Date('2026-02-12'),
    time: '19:30',
    description: 'Training for new members on rally coordination and war tactics.',
    status: 'upcoming',
  },
  {
    title: 'Weekend Rally Marathon',
    type: 'Rally',
    date: new Date('2026-02-15'),
    time: '16:00',
    description: 'Multiple rallies throughout the weekend. Max participation encouraged.',
    participants: 25,
    status: 'upcoming',
  },
  {
    title: 'Alliance War - Red Phoenix',
    type: 'War',
    date: new Date('2026-02-01'),
    time: '20:00',
    description: 'Major alliance war against Red Phoenix guild.',
    participants: 30,
    status: 'completed',
  },
  {
    title: 'Daily Rally',
    type: 'Rally',
    date: new Date('2026-02-02'),
    time: '21:00',
    description: 'Standard evening rally event.',
    participants: 12,
    status: 'ongoing',
  },
];

// Validate all events at build time
events.forEach((event, index) => {
  try {
    EventSchema.parse(event);
  } catch (error) {
    console.error(`Event validation failed at index ${index}:`, error);
    throw error;
  }
});
