import { weeklyStarts } from '@/features/bookings/rules';
import type { Booking, ClassInput, GymClass } from '@/features/bookings/types';
import { delay, forGym, mockBookings, mockClasses, mockId, mockPeople } from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

type ClassRow = {
  id: string;
  trainer_id: string | null;
  trainer_name: string;
  title: string;
  starts_at: string;
  duration_minutes: number;
  capacity: number;
  booked_count: number;
  series_id: string | null;
};

type BookingRow = {
  id: string;
  class_id: string;
  member_id: string;
  status: Booking['status'];
  class: ClassRow;
};

const CLASS_COLUMNS =
  'id, trainer_id, trainer_name, title, starts_at, duration_minutes, capacity, booked_count, series_id';

function toGymClass(row: ClassRow): GymClass {
  return {
    id: row.id,
    trainerId: row.trainer_id,
    trainerName: row.trainer_name,
    title: row.title,
    startsAt: row.starts_at,
    durationMinutes: row.duration_minutes,
    capacity: row.capacity,
    bookedCount: row.booked_count,
    seriesId: row.series_id,
  };
}

function toBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    classId: row.class_id,
    memberId: row.member_id,
    status: row.status,
    gymClass: toGymClass(row.class),
  };
}

export async function listUpcomingClasses(gymId: string, filter: { trainerId?: string } = {}) {
  const now = new Date().toISOString();
  if (!supabase) {
    return delay(
      forGym(gymId, mockClasses)
        .filter((c) => c.startsAt > now && (!filter.trainerId || c.trainerId === filter.trainerId))
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    );
  }
  let query = supabase
    .from('class_schedule')
    .select(CLASS_COLUMNS)
    .eq('gym_id', gymId)
    .gt('starts_at', now)
    .order('starts_at');
  if (filter.trainerId) query = query.eq('trainer_id', filter.trainerId);
  return unwrap(await query).map(toGymClass);
}

export async function listMyBookings(gymId: string, memberId: string): Promise<Booking[]> {
  if (!supabase) {
    return delay(
      forGym(gymId, mockBookings).filter((b) => b.memberId === memberId && b.status === 'booked'),
    );
  }
  const rows = unwrap(
    await supabase
      .from('bookings')
      .select(`id, class_id, member_id, status, class:class_schedule!inner(${CLASS_COLUMNS})`)
      .eq('member_id', memberId)
      .eq('status', 'booked')
      .eq('class.gym_id', gymId),
  ) as unknown as BookingRow[];
  return rows.map(toBooking).sort((a, b) => a.gymClass.startsAt.localeCompare(b.gymClass.startsAt));
}

export async function bookClass(classId: string, memberId: string) {
  if (!supabase) {
    const gymClass = mockClasses.find((c) => c.id === classId);
    if (!gymClass) throw new Error('Class not found');
    if (gymClass.bookedCount >= gymClass.capacity) throw new Error('Class is full');
    gymClass.bookedCount += 1;
    mockBookings.push({ id: mockId('b'), classId, memberId, status: 'booked', gymClass });
    return delay(undefined);
  }
  // The RPC checks capacity and inserts in one transaction.
  const { error } = await supabase.rpc('book_class', { p_class_id: classId });
  if (error) throw error;
}

export async function cancelBooking(bookingId: string) {
  if (!supabase) {
    const booking = mockBookings.find((b) => b.id === bookingId);
    if (booking && booking.status === 'booked') {
      booking.status = 'cancelled';
      booking.gymClass.bookedCount -= 1;
    }
    return delay(undefined);
  }
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId);
  if (error) throw error;
}

function trainerName(trainerId: string | null) {
  return mockPeople.find((p) => p.id === trainerId)?.fullName ?? 'TBA';
}

/** Schedules a class, repeated weekly at the same local time for `weeks` weeks. */
export async function scheduleClasses(gymId: string, input: ClassInput, weeks: number) {
  if (!supabase) {
    const seriesId = weeks > 1 ? mockId('series') : null;
    for (const start of weeklyStarts(new Date(input.startsAt), weeks)) {
      mockClasses.push({
        id: mockId('c'),
        trainerId: input.trainerId,
        trainerName: trainerName(input.trainerId),
        title: input.title.trim(),
        startsAt: start.toISOString(),
        durationMinutes: input.durationMinutes,
        capacity: input.capacity,
        bookedCount: 0,
        seriesId,
      });
    }
    return delay(weeks);
  }
  return unwrap(
    await supabase.rpc('schedule_classes', {
      p_gym_id: gymId,
      p_title: input.title,
      p_trainer_id: input.trainerId,
      p_starts_at: input.startsAt,
      p_duration_minutes: input.durationMinutes,
      p_capacity: input.capacity,
      p_weeks: weeks,
    }),
  ) as number;
}

/** Edits one class. The database refuses a capacity below what's already booked. */
export async function updateClass(classId: string, input: ClassInput) {
  if (!supabase) {
    const gymClass = mockClasses.find((c) => c.id === classId);
    if (gymClass) {
      if (input.capacity < gymClass.bookedCount) {
        throw new Error('More people have booked than the new capacity');
      }
      Object.assign(gymClass, {
        ...input,
        title: input.title.trim(),
        trainerName: trainerName(input.trainerId),
      });
    }
    return delay(undefined);
  }
  const { error } = await supabase
    .from('classes')
    .update({
      title: input.title.trim(),
      trainer_id: input.trainerId,
      starts_at: input.startsAt,
      duration_minutes: input.durationMinutes,
      capacity: input.capacity,
    })
    .eq('id', classId);
  if (error) throw error;
}

/** Cancels a class, or it and every later class in its weekly series, with their bookings. */
export async function cancelClass(classId: string, restOfSeries: boolean) {
  if (!supabase) {
    const target = mockClasses.find((c) => c.id === classId);
    if (!target) return delay(0);
    const doomed = mockClasses.filter(
      (c) =>
        c.id === classId ||
        (restOfSeries &&
          target.seriesId !== null &&
          c.seriesId === target.seriesId &&
          c.startsAt >= target.startsAt),
    );
    for (const c of doomed) mockClasses.splice(mockClasses.indexOf(c), 1);
    for (const b of mockBookings) {
      if (doomed.some((c) => c.id === b.classId)) b.status = 'cancelled';
    }
    return delay(doomed.length);
  }
  return unwrap(
    await supabase.rpc('cancel_class', { p_class_id: classId, p_rest_of_series: restOfSeries }),
  ) as number;
}
