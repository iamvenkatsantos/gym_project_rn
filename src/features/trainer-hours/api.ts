import { addDays, toIsoDate } from '@/features/memberships/rules';
import { fromTime, toTime } from '@/features/trainer-hours/rules';
import type {
  PermissionInput,
  PermissionReason,
  PermissionStatus,
  TrainerDay,
  TrainerHourRules,
  TrainerHourRulesInput,
  WorkPermission,
} from '@/features/trainer-hours/types';
import {
  delay,
  forGym,
  mockAttendance,
  mockDay,
  mockId,
  mockPeople,
  mockPermissions,
  mockTrainerHourRules,
} from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

type RulesRow = {
  required_minutes: number;
  short_limit_minutes: number;
  lop_minutes: number;
  off_days: number[];
  starts_on: string;
};

/** The branch's working-hours rules, or null before the owner sets them. Owners only. */
export async function getTrainerHourRules(gymId: string): Promise<TrainerHourRules | null> {
  if (!supabase) return delay(forGym(gymId, [mockTrainerHourRules.current])[0] ?? null);
  const { data: row, error } = await supabase
    .from('trainer_hour_rules')
    .select('required_minutes, short_limit_minutes, lop_minutes, off_days, starts_on')
    .eq('gym_id', gymId)
    .maybeSingle();
  if (error) throw error;
  const data = row as RulesRow | null;
  return data
    ? {
        requiredMinutes: data.required_minutes,
        shortLimitMinutes: data.short_limit_minutes,
        lopMinutes: data.lop_minutes,
        offDays: data.off_days,
        startsOn: data.starts_on,
      }
    : null;
}

export async function saveTrainerHourRules(gymId: string, rules: TrainerHourRulesInput) {
  if (!supabase) {
    mockTrainerHourRules.current = {
      ...rules,
      startsOn: mockTrainerHourRules.current?.startsOn ?? mockDay(),
    };
    return delay(undefined);
  }
  const { error } = await supabase.rpc('set_trainer_hour_rules', {
    p_gym_id: gymId,
    p_required_minutes: rules.requiredMinutes,
    p_short_limit_minutes: rules.shortLimitMinutes,
    p_lop_minutes: rules.lopMinutes,
    p_off_days: rules.offDays,
  });
  if (error) throw error;
}

type PermissionRow = {
  id: string;
  trainer_id: string;
  day: string;
  starts_at: string;
  ends_at: string;
  reason: PermissionReason;
  note: string | null;
  status: PermissionStatus;
  created_at: string;
  trainer: { full_name: string } | null;
};

/**
 * Permission requests from the last 60 days on. Owners get every trainer's; a trainer passes
 * their own id and gets theirs (the server only gives them theirs anyway).
 */
export async function listPermissions(
  gymId: string,
  trainerId?: string,
): Promise<WorkPermission[]> {
  const since = addDays(toIsoDate(new Date()), -60);
  if (!supabase) {
    return delay(
      forGym(gymId, mockPermissions).filter(
        (p) => p.day >= since && (!trainerId || p.trainerId === trainerId),
      ),
    );
  }
  let query = supabase
    .from('work_permissions')
    // Two foreign keys point at profiles (trainer and decided_by), so name the one we want.
    .select(
      'id, trainer_id, day, starts_at, ends_at, reason, note, status, created_at, trainer:profiles!work_permissions_trainer_id_fkey(full_name)',
    )
    .eq('gym_id', gymId)
    .gte('day', since)
    .order('day', { ascending: false })
    .limit(300);
  if (trainerId) query = query.eq('trainer_id', trainerId);
  const rows = unwrap(await query) as unknown as PermissionRow[];
  return rows.map((r) => ({
    id: r.id,
    trainerId: r.trainer_id,
    trainerName: r.trainer?.full_name ?? 'Trainer',
    day: r.day,
    startsAt: fromTime(r.starts_at),
    endsAt: fromTime(r.ends_at),
    reason: r.reason,
    note: r.note,
    status: r.status,
    createdAt: r.created_at,
  }));
}

export async function requestPermission(
  gymId: string,
  trainer: { id: string; fullName: string },
  input: PermissionInput,
) {
  if (!supabase) {
    mockPermissions.unshift({
      id: mockId('perm'),
      trainerId: trainer.id,
      trainerName: trainer.fullName,
      ...input,
      note: input.note.trim() || null,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    return delay(undefined);
  }
  const { error } = await supabase.rpc('request_permission', {
    p_gym_id: gymId,
    p_day: input.day,
    p_starts_at: toTime(input.startsAt),
    p_ends_at: toTime(input.endsAt),
    p_reason: input.reason,
    p_note: input.note.trim(),
  });
  if (error) throw error;
}

export async function cancelPermission(id: string) {
  if (!supabase) {
    const i = mockPermissions.findIndex((p) => p.id === id && p.status === 'pending');
    if (i < 0) throw new Error('Only a request still waiting can be cancelled');
    mockPermissions.splice(i, 1);
    return delay(undefined);
  }
  const { error } = await supabase.rpc('cancel_permission', { p_id: id });
  if (error) throw error;
}

export async function decidePermission(id: string, approve: boolean) {
  if (!supabase) {
    const p = mockPermissions.find((v) => v.id === id);
    if (p) p.status = approve ? 'approved' : 'rejected';
    return delay(undefined);
  }
  const { error } = await supabase.rpc('decide_permission', { p_id: id, p_approve: approve });
  if (error) throw error;
}

type DayRow = {
  trainer_id: string;
  full_name: string;
  day: string;
  worked_minutes: number;
  longest_visit_minutes: number;
  permission_minutes: number;
};

/** Each trainer's working days in a month, up to yesterday. Owners only. */
export async function getTrainerHoursMonth(gymId: string, month: string): Promise<TrainerDay[]> {
  if (!supabase) return delay(mockMonth(gymId, month));
  const rows = unwrap(
    await supabase.rpc('trainer_hours_month', { p_gym_id: gymId, p_month: month }),
  ) as DayRow[];
  return rows.map((r) => ({
    trainerId: r.trainer_id,
    fullName: r.full_name,
    day: r.day,
    workedMinutes: r.worked_minutes,
    longestVisitMinutes: r.longest_visit_minutes,
    permissionMinutes: r.permission_minutes,
  }));
}

/** The demo gym's month, built from its attendance the way the server does it. */
function mockMonth(gymId: string, month: string): TrainerDay[] {
  const rules = forGym(gymId, [mockTrainerHourRules.current])[0];
  if (!rules) return [];
  const trainers = mockPeople.filter((p) => p.role === 'trainer' && p.status === 'active');
  const nextMonth = addDays(month.slice(0, 8) + '28', 4).slice(0, 8) + '01';
  const yesterday = mockDay(1);
  const days: string[] = [];
  for (
    let day = month > rules.startsOn ? month : rules.startsOn;
    day < nextMonth && day <= yesterday;
    day = addDays(day, 1)
  ) {
    if (!rules.offDays.includes(new Date(`${day}T12:00:00`).getDay())) days.push(day);
  }
  return trainers.flatMap((t) =>
    days.map((day) => {
      const visit = mockAttendance.find((a) => a.userId === t.id && a.day === day);
      const worked =
        visit?.checkedOutAt != null
          ? Math.round((Date.parse(visit.checkedOutAt) - Date.parse(visit.checkedInAt)) / 60000)
          : 0;
      const permission = mockPermissions
        .filter((p) => p.trainerId === t.id && p.day === day && p.status === 'approved')
        .reduce((sum, p) => sum + p.endsAt - p.startsAt, 0);
      return {
        trainerId: t.id,
        fullName: t.fullName,
        day,
        workedMinutes: worked,
        longestVisitMinutes: worked,
        permissionMinutes: permission,
      };
    }),
  );
}
