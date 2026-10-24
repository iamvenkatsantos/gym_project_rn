import type {
  AvailabilityWindow,
  BusySlot,
  Trainer,
  TrainerSession,
  TrainerWithAvailability,
} from '@/features/trainers/types';
import { delay, forGym, mockId, mockProfiles, mockSessions, mockTrainers } from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

type TrainerRow = {
  trainer_id: string;
  bio: string;
  specialties: string[];
  session_minutes: number;
  trainer: { full_name: string };
};

type AvailabilityRow = { weekday: number; start_time: string; end_time: string };

type SessionRow = {
  id: string;
  gym_id: string;
  trainer_id: string;
  member_id: string;
  starts_at: string;
  ends_at: string;
  status: TrainerSession['status'];
  trainer: { full_name: string };
  member: { full_name: string };
};

const TRAINER_COLUMNS =
  'trainer_id, bio, specialties, session_minutes, trainer:profiles!trainer_profiles_trainer_id_fkey(full_name)';
const SESSION_COLUMNS =
  'id, gym_id, trainer_id, member_id, starts_at, ends_at, status, trainer:profiles!trainer_sessions_trainer_id_fkey(full_name), member:profiles!trainer_sessions_member_id_fkey(full_name)';

const toWindow = (a: AvailabilityRow): AvailabilityWindow => ({
  weekday: a.weekday,
  startTime: a.start_time.slice(0, 5),
  endTime: a.end_time.slice(0, 5),
});

function toTrainer(row: TrainerRow): Trainer {
  return {
    id: row.trainer_id,
    fullName: row.trainer.full_name,
    bio: row.bio,
    specialties: row.specialties,
    sessionMinutes: row.session_minutes,
  };
}

function toSession(row: SessionRow): TrainerSession {
  return {
    id: row.id,
    gymId: row.gym_id,
    trainerId: row.trainer_id,
    trainerName: row.trainer.full_name,
    memberId: row.member_id,
    memberName: row.member.full_name,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
  };
}

export async function listTrainers(gymId: string): Promise<Trainer[]> {
  if (!supabase) return delay(forGym(gymId, mockTrainers));
  const rows = unwrap(
    await supabase.from('trainer_profiles').select(TRAINER_COLUMNS).eq('gym_id', gymId),
  ) as unknown as TrainerRow[];
  return rows.map(toTrainer).sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export async function getTrainer(
  gymId: string,
  trainerId: string,
): Promise<TrainerWithAvailability> {
  if (!supabase) {
    const trainer = forGym(gymId, mockTrainers).find((t) => t.id === trainerId);
    if (!trainer) throw new Error('Trainer not found');
    return delay(trainer);
  }
  const [trainer, availability] = await Promise.all([
    supabase
      .from('trainer_profiles')
      .select(TRAINER_COLUMNS)
      .eq('gym_id', gymId)
      .eq('trainer_id', trainerId)
      .single(),
    supabase
      .from('trainer_availability')
      .select('weekday, start_time, end_time')
      .eq('gym_id', gymId)
      .eq('trainer_id', trainerId),
  ]);
  return {
    ...toTrainer(unwrap(trainer) as unknown as TrainerRow),
    availability: (unwrap(availability) as AvailabilityRow[]).map(toWindow),
  };
}

export type WeeklyHours = { sessionMinutes: number; availability: AvailabilityWindow[] };

/** A trainer's own bookable hours, including before they've set any up. */
export async function getWeeklyHours(gymId: string, trainerId: string): Promise<WeeklyHours> {
  if (!supabase) {
    const trainer = forGym(gymId, mockTrainers).find((t) => t.id === trainerId);
    return delay({
      sessionMinutes: trainer?.sessionMinutes ?? 60,
      availability: trainer?.availability ?? [],
    });
  }
  const [profile, availability] = await Promise.all([
    supabase
      .from('trainer_profiles')
      .select('session_minutes')
      .eq('gym_id', gymId)
      .eq('trainer_id', trainerId)
      .maybeSingle(),
    supabase
      .from('trainer_availability')
      .select('weekday, start_time, end_time')
      .eq('gym_id', gymId)
      .eq('trainer_id', trainerId),
  ]);
  if (profile.error) throw profile.error;
  return {
    sessionMinutes: profile.data?.session_minutes ?? 60,
    availability: (unwrap(availability) as AvailabilityRow[]).map(toWindow),
  };
}

/** Replaces the signed-in trainer's weekly hours at a gym. Existing bookings are kept. */
export async function saveWeeklyHours(gymId: string, trainerId: string, hours: WeeklyHours) {
  if (!supabase) {
    const trainer = forGym(gymId, mockTrainers).find((t) => t.id === trainerId);
    if (trainer) {
      trainer.sessionMinutes = hours.sessionMinutes;
      trainer.availability = hours.availability;
    } else {
      mockTrainers.push({
        id: trainerId,
        fullName: mockProfiles.find((p) => p.id === trainerId)?.fullName ?? 'Trainer',
        bio: '',
        specialties: [],
        ...hours,
      });
    }
    return delay(undefined);
  }
  const { error } = await supabase.rpc('set_trainer_availability', {
    p_gym_id: gymId,
    p_session_minutes: hours.sessionMinutes,
    p_windows: hours.availability.map((w) => ({
      weekday: w.weekday,
      start_time: w.startTime,
      end_time: w.endTime,
    })),
  });
  if (error) throw error;
}

/** Booked times for a trainer in a range, without who booked them. */
export async function listBusySlots(trainerId: string, from: Date, to: Date): Promise<BusySlot[]> {
  if (!supabase) {
    return delay(
      mockSessions
        .filter(
          (s) =>
            s.trainerId === trainerId &&
            s.status === 'booked' &&
            s.startsAt < to.toISOString() &&
            s.endsAt > from.toISOString(),
        )
        .map(({ startsAt, endsAt }) => ({ startsAt, endsAt })),
    );
  }
  const rows = unwrap(
    await supabase.rpc('trainer_busy_slots', {
      p_trainer_id: trainerId,
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    }),
  ) as { starts_at: string; ends_at: string }[];
  return rows.map((r) => ({ startsAt: r.starts_at, endsAt: r.ends_at }));
}

export async function listSessions(
  gymId: string,
  filter: { memberId?: string; trainerId?: string },
): Promise<TrainerSession[]> {
  const now = new Date().toISOString();
  if (!supabase) {
    return delay(
      forGym(gymId, mockSessions)
        .filter(
          (s) =>
            s.status === 'booked' &&
            s.endsAt > now &&
            (!filter.memberId || s.memberId === filter.memberId) &&
            (!filter.trainerId || s.trainerId === filter.trainerId),
        )
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    );
  }
  let query = supabase
    .from('trainer_sessions')
    .select(SESSION_COLUMNS)
    .eq('gym_id', gymId)
    .eq('status', 'booked')
    .gt('ends_at', now)
    .order('starts_at');
  if (filter.memberId) query = query.eq('member_id', filter.memberId);
  if (filter.trainerId) query = query.eq('trainer_id', filter.trainerId);
  return (unwrap(await query) as unknown as SessionRow[]).map(toSession);
}

export async function bookSession(
  gymId: string,
  trainerId: string,
  memberId: string,
  startsAt: string,
) {
  if (!supabase) {
    const trainer = forGym(gymId, mockTrainers).find((t) => t.id === trainerId);
    const member = mockProfiles.find((p) => p.id === memberId);
    if (!trainer || !member) throw new Error('Trainer not found');
    const endsAt = new Date(
      new Date(startsAt).getTime() + trainer.sessionMinutes * 60 * 1000,
    ).toISOString();
    const clash = mockSessions.some(
      (s) =>
        s.trainerId === trainerId &&
        s.status === 'booked' &&
        s.startsAt < endsAt &&
        s.endsAt > startsAt,
    );
    if (clash) throw new Error('That slot was just taken');
    mockSessions.push({
      id: mockId('s'),
      gymId,
      trainerId,
      trainerName: trainer.fullName,
      memberId,
      memberName: member.fullName,
      startsAt,
      endsAt,
      status: 'booked',
    });
    return delay(undefined);
  }
  // The RPC checks membership and availability; a DB constraint blocks double-booking.
  const { error } = await supabase.rpc('book_trainer_session', {
    p_gym_id: gymId,
    p_trainer_id: trainerId,
    p_starts_at: startsAt,
  });
  if (error) throw error;
}

export async function updateSessionStatus(
  sessionId: string,
  status: Exclude<TrainerSession['status'], 'booked'>,
) {
  if (!supabase) {
    const session = mockSessions.find((s) => s.id === sessionId);
    if (session) session.status = status;
    return delay(undefined);
  }
  const { error } = await supabase.from('trainer_sessions').update({ status }).eq('id', sessionId);
  if (error) throw error;
}
