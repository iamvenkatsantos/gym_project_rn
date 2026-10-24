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

function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

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

export const mockClasses: GymClass[] = [
  {
    id: 'c-1',
    trainerId: 'u-trainer',
    trainerName: 'Tom Trainer',
    title: 'HIIT Express',
    startsAt: hoursFromNow(3),
    durationMinutes: 30,
    capacity: 12,
    bookedCount: 9,
  },
  {
    id: 'c-2',
    trainerId: 'u-trainer',
    trainerName: 'Tom Trainer',
    title: 'Strength Fundamentals',
    startsAt: hoursFromNow(26),
    durationMinutes: 60,
    capacity: 8,
    bookedCount: 8,
  },
  {
    id: 'c-3',
    trainerId: 'u-trainer',
    trainerName: 'Tom Trainer',
    title: 'Mobility Flow',
    startsAt: hoursFromNow(50),
    durationMinutes: 45,
    capacity: 15,
    bookedCount: 4,
  },
];

export const mockBookings: Booking[] = [
  { id: 'b-1', classId: 'c-3', memberId: 'u-member', status: 'booked', gymClass: mockClasses[2] },
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
