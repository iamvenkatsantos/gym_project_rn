import type { Profile } from '@/features/auth/types';
import type { Booking, GymClass } from '@/features/bookings/types';
import type { Membership, MembershipPlan } from '@/features/memberships/types';
import type { TrainerSession, TrainerWithAvailability } from '@/features/trainers/types';
import type { Workout } from '@/features/workouts/types';

/**
 * In-memory stand-in for Supabase, used when EXPO_PUBLIC_SUPABASE_* isn't set.
 * Data resets on every reload.
 */

export const MOCK_GYM_ID = 'gym-1';
const GYM_ID = MOCK_GYM_ID;
const DAY = 24 * 60 * 60 * 1000;

function daysFromToday(days: number) {
  return new Date(Date.now() + days * DAY).toISOString().slice(0, 10);
}

const GYM_NAME = 'CoreFit Anna Nagar';

export const mockProfiles: Profile[] = [
  {
    id: 'u-member',
    fullName: 'Maya Member',
    gyms: [{ gymId: GYM_ID, gymName: GYM_NAME, role: 'member' }],
  },
  {
    id: 'u-trainer',
    fullName: 'Tom Trainer',
    // Trains at one branch and works out as a member at another.
    gyms: [
      { gymId: GYM_ID, gymName: GYM_NAME, role: 'trainer' },
      { gymId: 'gym-2', gymName: 'CoreFit Velachery', role: 'member' },
    ],
  },
  {
    id: 'u-owner',
    fullName: 'Olivia Owner',
    gyms: [{ gymId: GYM_ID, gymName: GYM_NAME, role: 'owner' }],
  },
];

export const mockWorkouts: Workout[] = [
  {
    id: 'w-1',
    trainerId: 'u-trainer',
    title: 'Full body starter',
    description: 'A balanced session for your first weeks in the gym.',
    level: 'beginner',
    durationMinutes: 45,
    exercises: [
      { name: 'Goblet squat', sets: 3, reps: 12 },
      { name: 'Push-up', sets: 3, reps: 10 },
      { name: 'Dumbbell row', sets: 3, reps: 12 },
    ],
  },
  {
    id: 'w-2',
    trainerId: 'u-trainer',
    title: 'Lower body strength',
    description: 'Heavy compound lifts for legs and glutes.',
    level: 'intermediate',
    durationMinutes: 60,
    exercises: [
      { name: 'Back squat', sets: 5, reps: 5 },
      { name: 'Romanian deadlift', sets: 4, reps: 8 },
      { name: 'Walking lunge', sets: 3, reps: 12 },
    ],
  },
];

const classTemplates = [
  { title: 'HIIT Express', hour: 7, durationMinutes: 30, capacity: 12 },
  { title: 'Strength Fundamentals', hour: 12, durationMinutes: 60, capacity: 8 },
  { title: 'Spin & Burn', hour: 18, durationMinutes: 45, capacity: 20 },
  { title: 'Mobility Flow', hour: 19, durationMinutes: 45, capacity: 15 },
];

function atHour(daysAhead: number, hour: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

/** A week of classes; booked counts vary so full and nearly full classes show up. */
export const mockClasses: GymClass[] = Array.from({ length: 7 }, (_, day) =>
  classTemplates.map((template, i) => ({
    id: `c-${day}-${i}`,
    trainerId: 'u-trainer',
    trainerName: 'Tom Trainer',
    title: template.title,
    startsAt: atHour(day, template.hour),
    durationMinutes: template.durationMinutes,
    capacity: template.capacity,
    bookedCount: Math.min(template.capacity, (day * 3 + i * 5) % (template.capacity + 3)),
  })),
).flat();

const bookedClass = mockClasses.find((c) => c.id === 'c-1-3')!;
bookedClass.bookedCount += 1;

export const mockBookings: Booking[] = [
  {
    id: 'b-1',
    classId: bookedClass.id,
    memberId: 'u-member',
    status: 'booked',
    gymClass: bookedClass,
  },
];

export const mockPlans: MembershipPlan[] = [
  { id: 'p-1', name: 'Monthly', priceCents: 149900, currency: 'INR', durationDays: 30 },
  { id: 'p-2', name: 'Quarterly', priceCents: 399900, currency: 'INR', durationDays: 90 },
  { id: 'p-3', name: 'Annual', priceCents: 1299900, currency: 'INR', durationDays: 365 },
];

export const mockMemberships: Membership[] = [
  {
    id: 'm-1',
    memberId: 'u-member',
    memberName: 'Maya Member',
    plan: mockPlans[0],
    startsOn: daysFromToday(-25),
    endsOn: daysFromToday(5),
  },
  {
    id: 'm-2',
    memberId: 'u-member-2',
    memberName: 'Arjun Kumar',
    plan: mockPlans[2],
    startsOn: daysFromToday(-100),
    endsOn: daysFromToday(265),
  },
  {
    id: 'm-3',
    memberId: 'u-member-3',
    memberName: 'Priya Sharma',
    plan: mockPlans[1],
    startsOn: daysFromToday(-93),
    endsOn: daysFromToday(-3),
  },
  {
    id: 'm-4',
    memberId: 'u-member-4',
    memberName: 'Leo Martins',
    plan: mockPlans[0],
    startsOn: daysFromToday(-28),
    endsOn: daysFromToday(2),
  },
];

const weekdays = [1, 2, 3, 4, 5, 6];

export const mockTrainers: TrainerWithAvailability[] = [
  {
    id: 'u-trainer',
    fullName: 'Tom Trainer',
    bio: 'Strength coach focused on safe technique and steady progress.',
    specialties: ['Strength', 'Fat loss'],
    sessionMinutes: 60,
    availability: weekdays.flatMap((weekday) => [
      { weekday, startTime: '07:00', endTime: '11:00' },
      { weekday, startTime: '17:00', endTime: '20:00' },
    ]),
  },
  {
    id: 'u-trainer-2',
    fullName: 'Divya Raman',
    bio: 'Mobility and yoga, great for beginners and recovery days.',
    specialties: ['Mobility', 'Yoga', 'Beginners'],
    sessionMinutes: 45,
    availability: [0, 2, 4, 6].map((weekday) => ({
      weekday,
      startTime: '06:00',
      endTime: '10:30',
    })),
  },
];

function nextWeekdayAt(weekday: number, hour: number) {
  const date = new Date();
  date.setDate(date.getDate() + ((weekday - date.getDay() + 7) % 7 || 7));
  date.setHours(hour, 0, 0, 0);
  return date;
}

const sessionStart = nextWeekdayAt(2, 8);

export const mockSessions: TrainerSession[] = [
  {
    id: 's-1',
    gymId: GYM_ID,
    trainerId: 'u-trainer',
    trainerName: 'Tom Trainer',
    memberId: 'u-member',
    memberName: 'Maya Member',
    startsAt: sessionStart.toISOString(),
    endsAt: new Date(sessionStart.getTime() + 60 * 60 * 1000).toISOString(),
    status: 'booked',
  },
  {
    id: 's-2',
    gymId: GYM_ID,
    trainerId: 'u-trainer',
    trainerName: 'Tom Trainer',
    memberId: 'u-member-2',
    memberName: 'Arjun Kumar',
    startsAt: nextWeekdayAt(2, 9).toISOString(),
    endsAt: nextWeekdayAt(2, 10).toISOString(),
    status: 'booked',
  },
];

let nextId = 100;
export function mockId(prefix: string) {
  nextId += 1;
  return `${prefix}-${nextId}`;
}

/**
 * Simulates a network response: adds latency so loading states are visible, and
 * returns a copy so later mutations of the mock data don't leak into the cache.
 */
/** Mock content only exists for the first gym; other gyms come back empty. */
export function forGym<T>(gymId: string, items: T[]): T[] {
  return gymId === MOCK_GYM_ID ? items : [];
}

export function delay<T>(value: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), ms));
}
