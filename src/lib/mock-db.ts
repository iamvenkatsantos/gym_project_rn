import type { Announcement } from '@/features/announcements/types';
import type { AttendanceDay } from '@/features/attendance/types';
import type { Profile } from '@/features/auth/types';
import type { BodyMeasurement, ProgressPhoto } from '@/features/body/types';
import type { Booking, GymClass } from '@/features/bookings/types';
import type { TrainerLink, TrainerRequest } from '@/features/coaching/types';
import type { MealPlan } from '@/features/diet/types';
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

const GYM_NAME = 'Pulse Fitness Anna Nagar';
/** Both demo gyms are branches of one brand. */
export const MOCK_BRAND_ID = 'brand-1';
const BRAND = { brandId: MOCK_BRAND_ID, brandName: 'Pulse Fitness' };

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
    fullName: 'Nandini Ravi',
    gyms: [{ gymId: GYM_ID, gymName: GYM_NAME, role: 'member', ...BRAND }],
  },
  {
    id: 'u-trainer',
    fullName: 'Karthik Raja',
    // Trains at one branch and works out as a member at another.
    gyms: [
      { gymId: GYM_ID, gymName: GYM_NAME, role: 'trainer', ...BRAND },
      { gymId: 'gym-2', gymName: 'Pulse Fitness Velachery', role: 'member', ...BRAND },
    ],
  },
  {
    id: 'u-supervisor',
    fullName: 'Meena Sundaram',
    gyms: [{ gymId: GYM_ID, gymName: GYM_NAME, role: 'supervisor', ...BRAND }],
  },
  {
    id: 'u-owner',
    fullName: 'Rajesh Kannan',
    // Owns both branches of the brand.
    gyms: [
      { gymId: GYM_ID, gymName: GYM_NAME, role: 'owner', ...BRAND },
      { gymId: 'gym-2', gymName: 'Pulse Fitness Velachery', role: 'owner', ...BRAND },
    ],
  },
];

/** Everyone at the demo gym, as the owner's People screen shows them. */
export const mockPeople: GymPerson[] = [
  person('u-owner', 'Rajesh Kannan', 'owner', 400),
  person('u-supervisor', 'Meena Sundaram', 'supervisor', 390),
  person('u-trainer', 'Karthik Raja', 'trainer', 380),
  person('u-trainer-2', 'Divya Raman', 'trainer', 200),
  person('u-member', 'Nandini Ravi', 'member', 120),
  person('u-member-2', 'Arjun Kumar', 'member', 100),
  person('u-member-3', 'Priya Sharma', 'member', 93),
  person('u-member-4', 'Harish Patel', 'member', 28),
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

/** Who trains whom. Nandini has two trainers; Priya and Harish have none yet. */
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

export const mockAnnouncements: Announcement[] = [
  {
    id: 'a-1',
    senderName: 'Rajesh Kannan',
    audience: 'everyone',
    title: 'Gym closed for the holiday',
    body: 'We are closed on 1 Nov for Diwali and open as usual from 2 Nov, 5 am.',
    createdAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'a-2',
    senderName: 'Meena Sundaram',
    audience: 'staff',
    title: 'Staff meeting on Sunday',
    body: '10 am at the front desk. We will plan the new batch timings.',
    createdAt: new Date(Date.now() - 3 * DAY).toISOString(),
  },
];

export const mockNotifications: AppNotification[] = [
  {
    id: 'n-1',
    recipientId: 'u-trainer',
    senderName: 'Meena Sundaram',
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
    senderName: 'Meena Sundaram',
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
    trainerName: 'Karthik Raja',
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
    trainerName: 'Karthik Raja',
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

export const mockMealPlans: MealPlan[] = [
  {
    id: 'mp-1',
    coachId: 'u-trainer',
    coachName: 'Karthik Raja',
    title: 'Lean muscle, vegetarian',
    notes: 'Drink 3 litres of water a day. Swap paneer for tofu if you like. No sugary drinks.',
    foodType: 'veg',
    targets: { calories: 2300, proteinG: 120, carbsG: 280, fatG: 70 },
    meals: [
      {
        name: 'Breakfast',
        time: '7:30 AM',
        foods: 'Oats with milk, 1 banana, 10 almonds',
        calories: 500,
      },
      { name: 'Mid-morning', time: '11:00 AM', foods: 'Sprouts salad, buttermilk', calories: 250 },
      {
        name: 'Lunch',
        time: '1:30 PM',
        foods: '2 rotis, dal, paneer bhurji, salad',
        calories: 650,
      },
      {
        name: 'Post-workout',
        time: 'After workout',
        foods: 'Whey shake with water, 1 fruit',
        calories: 250,
      },
      {
        name: 'Dinner',
        time: '8:30 PM',
        foods: 'Brown rice, rajma, curd, vegetables',
        calories: 600,
      },
    ],
    assignedMemberIds: ['u-member'],
    updatedAt: new Date(Date.now() - 3 * DAY).toISOString(),
  },
  {
    id: 'mp-2',
    coachId: 'u-trainer',
    coachName: 'Karthik Raja',
    title: 'Fat loss, high protein',
    notes: 'Walk 8,000 steps a day.',
    foodType: 'non_veg',
    targets: { calories: 1800, proteinG: 140, carbsG: 160, fatG: 55 },
    meals: [
      {
        name: 'Breakfast',
        time: '8:00 AM',
        foods: '3 egg whites, 1 whole egg, 2 slices brown bread',
        calories: 400,
      },
      {
        name: 'Lunch',
        time: '1:00 PM',
        foods: 'Grilled chicken, 1 cup rice, salad',
        calories: 600,
      },
      { name: 'Evening snack', time: '5:00 PM', foods: 'Greek yoghurt, green tea', calories: 200 },
      {
        name: 'Dinner',
        time: '8:00 PM',
        foods: 'Fish curry, 2 rotis, sautéed vegetables',
        calories: 600,
      },
    ],
    assignedMemberIds: [],
    updatedAt: new Date(Date.now() - 10 * DAY).toISOString(),
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
    trainerName: 'Karthik Raja',
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
    memberName: 'Nandini Ravi',
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
    memberName: 'Harish Patel',
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
    fullName: 'Karthik Raja',
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
    trainerName: 'Karthik Raja',
    memberId: 'u-member',
    memberName: 'Nandini Ravi',
    startsAt: sessionStart.toISOString(),
    endsAt: new Date(sessionStart.getTime() + 60 * 60 * 1000).toISOString(),
    status: 'booked',
  },
  {
    id: 's-2',
    gymId: GYM_ID,
    trainerId: 'u-trainer',
    trainerName: 'Karthik Raja',
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
    pastLog(1, 'Full body starter', [
      set('e-goblet-squat', 'Goblet squat', 1, 12, 16),
      set('e-goblet-squat', 'Goblet squat', 2, 12, 16),
      set('e-push-up', 'Push-up', 1, 14, null),
      set('e-dumbbell-row', 'Dumbbell row', 1, 12, 18),
    ]),
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

/** A local calendar day, YYYY-MM-DD. The demo gym's day is the phone's day. */
export function mockDay(daysAgo = 0) {
  const d = new Date(Date.now() - daysAgo * DAY);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function visit(
  userId: string,
  role: AttendanceDay['role'],
  daysAgo: number,
  inAt: [number, number],
  outAt: [number, number] | null,
  workouts = 0,
): AttendanceDay & { userId: string } {
  const at = ([h, m]: [number, number]) => {
    const d = new Date(Date.now() - daysAgo * DAY);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  return {
    userId,
    day: mockDay(daysAgo),
    role,
    checkedInAt: at(inAt),
    checkedOutAt: outAt ? at(outAt) : null,
    workouts,
  };
}

/**
 * Check-ins at the demo gym over the past week. Today's are only those well
 * before now, so nobody seems to arrive in the future.
 */
export const mockAttendance: (AttendanceDay & { userId: string })[] = [
  ...[1, 2, 3, 4, 5, 6].flatMap((d) => [
    visit('u-trainer', 'trainer', d, [6, 0], [14, 0]),
    visit('u-trainer-2', 'trainer', d, [14, 0], [21, 0]),
  ]),
  visit('u-member', 'member', 1, [7, 5], [8, 10], 1),
  visit('u-member', 'member', 2, [7, 10], [8, 15], 1),
  visit('u-member', 'member', 5, [18, 0], [19, 5], 1),
  visit('u-member-2', 'member', 1, [6, 30], [7, 40], 1),
  visit('u-member-2', 'member', 3, [6, 35], [7, 30], 1),
  visit('u-member-3', 'member', 4, [19, 0], [20, 0], 1),
  ...(new Date().getHours() >= 8
    ? [
        visit('u-trainer', 'trainer', 0, [6, 0], null),
        visit('u-member-2', 'member', 0, [6, 40], [7, 45], 1),
      ]
    : []),
  ...(new Date().getHours() >= 15 ? [visit('u-trainer-2', 'trainer', 0, [14, 0], null)] : []),
];

/**
 * The rest of the floor: enough members, renewals and check-ins that lists, reports and
 * charts look like a busy gym. A seeded random keeps the numbers the same on every reload.
 */
const rosterNames = [
  'Aditya Menon',
  'Sowmya Raghavan',
  'Vignesh Murugan',
  'Lakshmi Narayanan',
  'Farhan Sheikh',
  'Deepika Reddy',
  'Pradeep Selvam',
  'Keerthana Bala',
  'Manoj Pillai',
  'Shruti Desai',
  'Gokul Prakash',
  'Revathi Mohan',
  'Imran Khan',
  'Janani Venkat',
  'Siddharth Rao',
  'Pooja Agarwal',
  'Naveen Chandran',
  'Asha Thomas',
  'Bharath Kumar',
  'Swetha Jayaraman',
  'Dinesh Kartha',
  'Fathima Begum',
  'Rohit Shetty',
  'Kavitha Selvaraj',
  'Ashwin Ramesh',
  'Nisha Gupta',
  'Suresh Babu',
  'Anjali Menon',
  'Varun Nair',
  'Divya Prakash',
  'Karan Mehta',
  'Meera Iyer',
  'Arun Prasath',
  'Sangeetha Raj',
  'Tarun Bhatia',
  'Preethi Gopal',
  'Ajay Krishnan',
  'Ritu Malhotra',
  'Hari Shankar',
  'Nithya Anand',
  'Saravanan Mani',
  'Zoya Ahmed',
  'Vishal Jain',
  'Gayathri Suresh',
  'Mohammed Irfan',
  'Bhavana Rao',
  'Prakash Iyer',
  "Sonia D'Souza",
  'Ravi Teja',
  'Harini Balaji',
  'Kishore Kumar',
  'Yamini Sekar',
  'Abdul Rahman',
  'Shalini Vasan',
  'Praveen Raj',
  'Lavanya Mohan',
];

function seededRandom(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const random = seededRandom(42);
const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];
const paymentMethods: Membership['paymentMethod'][] = [
  'upi',
  'upi',
  'upi',
  'cash',
  'card',
  'bank_transfer',
];
const visitHours = [6, 6, 6, 7, 7, 7, 8, 9, 17, 18, 18, 18, 19, 19, 20];

rosterNames.forEach((fullName, i) => {
  const id = `u-roster-${i + 1}`;
  // Skewed towards recent joins, so the gym looks like it is growing.
  const joinedDaysAgo = 4 + Math.floor(Math.pow(random(), 1.4) * 175);
  // A few members stopped renewing, so Insights and Renewals have someone to chase.
  const lapsed = i % 7 === 3;
  mockPeople.push(person(id, fullName, 'member', joinedDaysAgo));

  if (i % 3 === 0 && i % 9 !== 0) {
    mockWorkouts[i % 2].assignedMemberIds.push(id);
  }
  if (i % 3 !== 2) {
    mockTrainerLinks.push(
      link(id, i % 3 === 0 ? 'u-trainer' : 'u-trainer-2', Math.min(joinedDaysAgo, 60)),
    );
  }

  const plan = i % 6 === 0 ? mockPlans[2] : i % 3 === 1 ? mockPlans[1] : mockPlans[0];
  for (let start = -joinedDaysAgo, n = 0; start <= 0; start += plan.durationDays, n++) {
    const end = start + plan.durationDays;
    if (lapsed && end > -5 && n > 0) break;
    mockMemberships.push({
      id: `m-${id}-${n}`,
      memberId: id,
      memberName: fullName,
      plan,
      startsOn: daysFromToday(start),
      endsOn: daysFromToday(end),
      amountPaidCents: plan.priceCents,
      paymentMethod: pick(paymentMethods),
    });
  }

  if (lapsed) return;
  const visitsPerWeek = 3 + Math.floor(random() * 4);
  for (let d = 0; d < 30 && d <= joinedDaysAgo; d++) {
    if (random() > visitsPerWeek / 7) continue;
    const hour = pick(visitHours);
    const minute = Math.floor(random() * 12) * 5;
    const stay = 55 + Math.floor(random() * 30);
    const outMinutes = hour * 60 + minute + stay;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (d === 0 && hour * 60 + minute > nowMinutes - 10) continue;
    const stillIn = d === 0 && outMinutes > nowMinutes;
    mockAttendance.push(
      visit(
        id,
        'member',
        d,
        [hour, minute],
        stillIn ? null : [Math.floor(outMinutes / 60), outMinutes % 60],
        stillIn ? 0 : 1,
      ),
    );
  }
});

function measurement(
  daysAgo: number,
  values: Partial<Omit<BodyMeasurement, 'id' | 'measuredOn'>>,
): BodyMeasurement {
  return {
    id: `bm-${daysAgo}`,
    measuredOn: daysFromToday(-daysAgo),
    weightKg: null,
    heightCm: null,
    bodyFatPct: null,
    chestCm: null,
    waistCm: null,
    hipsCm: null,
    armCm: null,
    thighCm: null,
    note: null,
    ...values,
  };
}

/** Two months of check-ins for Nandini, keyed by member id. */
export const mockMeasurements: Record<string, BodyMeasurement[]> = {
  'u-member': [
    measurement(63, {
      weightKg: 74.2,
      heightCm: 165,
      bodyFatPct: 31,
      waistCm: 88,
      chestCm: 96,
      hipsCm: 104,
      armCm: 31,
      thighCm: 58,
      note: 'Starting point',
    }),
    measurement(49, { weightKg: 73.4, bodyFatPct: 30.4, waistCm: 87 }),
    measurement(35, { weightKg: 72.9, waistCm: 85.5 }),
    measurement(21, { weightKg: 71.8, bodyFatPct: 29.1, waistCm: 84, hipsCm: 102 }),
    measurement(7, { weightKg: 71.1, waistCm: 83, armCm: 31.5 }),
  ],
};

/** Uploaded photos. Demo uploads keep the picked file's local uri as their url. */
export const mockPhotos: Record<string, ProgressPhoto[]> = {};

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
