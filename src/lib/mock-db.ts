import type { Profile } from '@/features/auth/types';
import type { Booking, GymClass } from '@/features/bookings/types';
import type { TrainerLink, TrainerRequest } from '@/features/coaching/types';
import type { GymInvite, GymPerson } from '@/features/members/types';
import type { Membership, MembershipPlan } from '@/features/memberships/types';
import type { AppNotification } from '@/features/notifications/types';
import type { WorkoutLog } from '@/features/progress/types';
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

function person(
  id: string,
  fullName: string,
  role: GymPerson['role'],
  joinedDaysAgo: number,
  status: GymPerson['status'] = 'active',
): GymPerson {
  const email = `${fullName.split(' ')[0].toLowerCase()}@example.com`;
  return { id, fullName, email, role, status, joinedAt: daysFromToday(-joinedDaysAgo) };
}

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
    id: 'u-supervisor',
    fullName: 'Sam Supervisor',
    gyms: [{ gymId: GYM_ID, gymName: GYM_NAME, role: 'supervisor' }],
  },
  {
    id: 'u-owner',
    fullName: 'Olivia Owner',
    gyms: [{ gymId: GYM_ID, gymName: GYM_NAME, role: 'owner' }],
  },
];

/** Everyone at the demo gym, as the owner's People screen shows them. */
export const mockPeople: GymPerson[] = [
  person('u-owner', 'Olivia Owner', 'owner', 400),
  person('u-supervisor', 'Sam Supervisor', 'supervisor', 390),
  person('u-trainer', 'Tom Trainer', 'trainer', 380),
  person('u-trainer-2', 'Divya Raman', 'trainer', 200),
  person('u-member', 'Maya Member', 'member', 120),
  person('u-member-2', 'Arjun Kumar', 'member', 100),
  person('u-member-3', 'Priya Sharma', 'member', 93),
  person('u-member-4', 'Leo Martins', 'member', 28),
  person('u-member-5', 'Rahul Verma', 'member', 60, 'suspended'),
];

export const mockInvites: GymInvite[] = [
  {
    id: 'inv-1',
    email: 'karthik.s@example.com',
    role: 'member',
    createdAt: new Date(Date.now() - 2 * DAY).toISOString(),
  },
];

/** Demo accounts that exist but aren't at the gym yet, so inviting them adds them at once. */
export const mockAccounts: { id: string; fullName: string; email: string }[] = [
  { id: 'u-sneha', fullName: 'Sneha Iyer', email: 'sneha@example.com' },
];

function link(memberId: string, trainerId: string, daysAgo: number): TrainerLink {
  const name = (id: string) => mockPeople.find((p) => p.id === id)!.fullName;
  return {
    memberId,
    memberName: name(memberId),
    trainerId,
    trainerName: name(trainerId),
    assignedAt: daysFromToday(-daysAgo),
  };
}

/** Who trains whom. Maya has two trainers; Priya and Leo have none yet. */
export const mockTrainerLinks: TrainerLink[] = [
  link('u-member', 'u-trainer', 90),
  link('u-member', 'u-trainer-2', 30),
  link('u-member-2', 'u-trainer', 80),
];

export const mockTrainerRequests: TrainerRequest[] = [
  {
    id: 'req-1',
    memberId: 'u-member-3',
    memberName: 'Priya Sharma',
    trainerId: 'u-trainer-2',
    trainerName: 'Divya Raman',
    needs: ['Mobility', 'Injury recovery'],
    comments: 'Recovering from a knee strain, evenings work best.',
    status: 'pending',
    response: '',
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    resolvedAt: null,
  },
];

export const mockNotifications: AppNotification[] = [
  {
    id: 'n-1',
    recipientId: 'u-trainer',
    senderName: 'Sam Supervisor',
    kind: 'message',
    title: 'Please schedule a class',
    body: 'Members are asking for a Saturday morning strength class.',
    classId: null,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    readAt: null,
  },
  {
    id: 'n-2',
    recipientId: 'u-member',
    senderName: 'Sam Supervisor',
    kind: 'trainer_assigned',
    title: 'Meet your trainer',
    body: 'Divya Raman is now your trainer.',
    classId: null,
    createdAt: new Date(Date.now() - 30 * DAY).toISOString(),
    readAt: null,
  },
  ...['u-supervisor', 'u-owner'].map((recipientId) => ({
    id: `n-req-${recipientId}`,
    recipientId,
    senderName: 'Priya Sharma',
    kind: 'trainer_request' as const,
    title: 'Trainer request',
    body: 'Priya Sharma asked for a trainer: Mobility, Injury recovery.',
    classId: null,
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    readAt: null,
  })),
];

const prescribe = (
  exerciseId: string,
  name: string,
  sets: number,
  reps: number,
  targetWeightKg: number | null = null,
  restSeconds = 90,
) => ({ exerciseId, name, sets, reps, targetWeightKg, restSeconds });

export const mockWorkouts: Workout[] = [
  {
    id: 'w-1',
    trainerId: 'u-trainer',
    title: 'Full body starter',
    description: 'A balanced session for your first weeks in the gym.',
    level: 'beginner',
    durationMinutes: 45,
    exercises: [
      prescribe('e-goblet-squat', 'Goblet squat', 3, 12, 12),
      prescribe('e-push-up', 'Push-up', 3, 10, null, 60),
      prescribe('e-dumbbell-row', 'Dumbbell row', 3, 12, 14),
      prescribe('e-plank', 'Plank', 3, 30, null, 45),
    ],
    assignedMemberIds: ['u-member'],
  },
  {
    id: 'w-2',
    trainerId: 'u-trainer',
    title: 'Lower body strength',
    description: 'Heavy compound lifts for legs and glutes.',
    level: 'intermediate',
    durationMinutes: 60,
    exercises: [
      prescribe('e-back-squat', 'Back squat', 5, 5, 60, 150),
      prescribe('e-romanian-deadlift', 'Romanian deadlift', 4, 8, 50, 120),
      prescribe('e-walking-lunge', 'Walking lunge', 3, 12),
    ],
    assignedMemberIds: [],
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
    seriesId: `series-${i}`,
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
    amountPaidCents: null,
    paymentMethod: null,
  },
  {
    id: 'm-2',
    memberId: 'u-member-2',
    memberName: 'Arjun Kumar',
    plan: mockPlans[2],
    startsOn: daysFromToday(-100),
    endsOn: daysFromToday(265),
    amountPaidCents: null,
    paymentMethod: null,
  },
  {
    id: 'm-3',
    memberId: 'u-member-3',
    memberName: 'Priya Sharma',
    plan: mockPlans[1],
    startsOn: daysFromToday(-93),
    endsOn: daysFromToday(-3),
    amountPaidCents: null,
    paymentMethod: null,
  },
  {
    id: 'm-4',
    memberId: 'u-member-4',
    memberName: 'Leo Martins',
    plan: mockPlans[0],
    startsOn: daysFromToday(-28),
    endsOn: daysFromToday(2),
    amountPaidCents: null,
    paymentMethod: null,
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

function daysAgoAt(days: number, hour: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

function pastLog(
  days: number,
  title: string,
  sets: WorkoutLog['sets'],
  personId = 'u-member',
): WorkoutLog {
  const completed = daysAgoAt(days, 8);
  return {
    clientId: `log-${personId}-${days}`,
    workoutId: title === 'Full body starter' ? 'w-1' : 'w-2',
    title,
    startedAt: new Date(completed.getTime() - 50 * 60 * 1000).toISOString(),
    completedAt: completed.toISOString(),
    sets,
  };
}

const set = (
  exerciseId: string,
  exerciseName: string,
  setNumber: number,
  reps: number,
  weightKg: number | null,
) => ({
  exerciseId,
  exerciseName,
  setNumber,
  reps,
  weightKg,
});

/** A few weeks of history, keyed by the id of the person who trained. Staff train too. */
export const mockLogs: Record<string, WorkoutLog[]> = {
  'u-member': [
    pastLog(2, 'Lower body strength', [
      set('e-back-squat', 'Back squat', 1, 5, 55),
      set('e-back-squat', 'Back squat', 2, 5, 57.5),
      set('e-back-squat', 'Back squat', 3, 5, 60),
      set('e-romanian-deadlift', 'Romanian deadlift', 1, 8, 50),
      set('e-romanian-deadlift', 'Romanian deadlift', 2, 8, 50),
    ]),
    pastLog(5, 'Full body starter', [
      set('e-goblet-squat', 'Goblet squat', 1, 12, 14),
      set('e-goblet-squat', 'Goblet squat', 2, 12, 14),
      set('e-push-up', 'Push-up', 1, 12, null),
      set('e-push-up', 'Push-up', 2, 10, null),
      set('e-dumbbell-row', 'Dumbbell row', 1, 12, 16),
    ]),
    pastLog(9, 'Lower body strength', [
      set('e-back-squat', 'Back squat', 1, 5, 55),
      set('e-back-squat', 'Back squat', 2, 5, 55),
      set('e-romanian-deadlift', 'Romanian deadlift', 1, 8, 45),
    ]),
    pastLog(16, 'Full body starter', [
      set('e-goblet-squat', 'Goblet squat', 1, 12, 12),
      set('e-push-up', 'Push-up', 1, 10, null),
    ]),
  ],
  'u-member-2': [
    pastLog(
      1,
      'Lower body strength',
      [
        set('e-back-squat', 'Back squat', 1, 5, 70),
        set('e-back-squat', 'Back squat', 2, 5, 70),
        set('e-romanian-deadlift', 'Romanian deadlift', 1, 8, 60),
      ],
      'u-member-2',
    ),
    pastLog(
      6,
      'Full body starter',
      [set('e-goblet-squat', 'Goblet squat', 1, 12, 16), set('e-push-up', 'Push-up', 1, 15, null)],
      'u-member-2',
    ),
  ],
  'u-member-3': [
    pastLog(3, 'Full body starter', [set('e-push-up', 'Push-up', 1, 8, null)], 'u-member-3'),
  ],
  'u-trainer': [
    pastLog(
      2,
      'Lower body strength',
      [set('e-back-squat', 'Back squat', 1, 5, 100), set('e-back-squat', 'Back squat', 2, 5, 100)],
      'u-trainer',
    ),
  ],
  'u-supervisor': [
    pastLog(
      4,
      'Full body starter',
      [set('e-dumbbell-row', 'Dumbbell row', 1, 10, 20)],
      'u-supervisor',
    ),
  ],
  'u-owner': [
    pastLog(1, 'Full body starter', [set('e-goblet-squat', 'Goblet squat', 1, 12, 20)], 'u-owner'),
  ],
};

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
