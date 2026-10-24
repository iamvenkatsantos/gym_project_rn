import type { Booking, GymClass } from '@/features/bookings/types';
import { delay, mockBookings, mockClasses, mockId } from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

type ClassRow = {
  id: string;
  trainer_id: string;
  trainer_name: string;
  title: string;
  starts_at: string;
  duration_minutes: number;
  capacity: number;
  booked_count: number;
};

type BookingRow = {
  id: string;
  class_id: string;
  member_id: string;
  status: Booking['status'];
  class: ClassRow;
};

const CLASS_COLUMNS =
  'id, trainer_id, trainer_name, title, starts_at, duration_minutes, capacity, booked_count';

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

export async function listUpcomingClasses(filter: { trainerId?: string } = {}) {
  const now = new Date().toISOString();
  if (!supabase) {
    return delay(
      mockClasses
        .filter((c) => c.startsAt > now && (!filter.trainerId || c.trainerId === filter.trainerId))
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    );
  }
  let query = supabase
    .from('class_schedule')
    .select(CLASS_COLUMNS)
    .gt('starts_at', now)
    .order('starts_at');
  if (filter.trainerId) query = query.eq('trainer_id', filter.trainerId);
  return unwrap(await query).map(toGymClass);
}

export async function listMyBookings(memberId: string): Promise<Booking[]> {
  if (!supabase) {
    return delay(mockBookings.filter((b) => b.memberId === memberId && b.status === 'booked'));
  }
  const rows = unwrap(
    await supabase
      .from('bookings')
      .select(`id, class_id, member_id, status, class:class_schedule(${CLASS_COLUMNS})`)
      .eq('member_id', memberId)
      .eq('status', 'booked'),
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
