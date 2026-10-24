import type { Profile } from '@/features/auth/types';
import type { Booking, GymClass } from '@/features/bookings/types';
import type { Membership, MembershipPlan } from '@/features/memberships/types';
import type { Workout } from '@/features/workouts/types';

/**
 * In-memory stand-in for Supabase, used when EXPO_PUBLIC_SUPABASE_* isn't set.
 * Data resets on every reload.
 */

const GYM_ID = 'gym-1';
const DAY = 24 * 60 * 60 * 1000;

function daysFromToday(days: number) {
  return new Date(Date.now() + days * DAY).toISOString().slice(0, 10);
}

export const mockProfiles: Profile[] = [
  { id: 'u-member', gymId: GYM_ID, fullName: 'Maya Member', role: 'member' },
  { id: 'u-trainer', gymId: GYM_ID, fullName: 'Tom Trainer', role: 'trainer' },
  { id: 'u-owner', gymId: GYM_ID, fullName: 'Olivia Owner', role: 'owner' },
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
  { id: 'p-1', name: 'Monthly', priceCents: 4900, currency: 'USD', durationDays: 30 },
  { id: 'p-2', name: 'Quarterly', priceCents: 12900, currency: 'USD', durationDays: 90 },
  { id: 'p-3', name: 'Annual', priceCents: 44900, currency: 'USD', durationDays: 365 },
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

let nextId = 100;
export function mockId(prefix: string) {
  nextId += 1;
  return `${prefix}-${nextId}`;
}

/**
 * Simulates a network response: adds latency so loading states are visible, and
 * returns a copy so later mutations of the mock data don't leak into the cache.
 */
export function delay<T>(value: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(value)), ms));
}
