import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { setPasswordUrl } from '@/features/auth/api';
import type {
  CoachedMember,
  GymInvite,
  GymMember,
  GymPerson,
  InviteOutcome,
  InviteResult,
} from '@/features/members/types';
import { normalizeEmail } from '@/features/members/rules';
import {
  delay,
  forGym,
  mockAccounts,
  mockId,
  mockInvites,
  mockPeople,
  mockWorkouts,
} from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

type MemberRow = { user_id: string; profile: { full_name: string } };

type PersonRow = {
  user_id: string;
  full_name: string;
  email: string | null;
  role: GymPerson['role'];
  status: GymPerson['status'];
  joined_at: string;
};

type InviteRow = { id: string; email: string; role: GymInvite['role']; created_at: string };

type CoachedRow = { member_id: string; member: { full_name: string }; workout: { title: string } };

/** Active members of a gym, by name. Staff of the gym can read this. */
export async function listGymMembers(gymId: string): Promise<GymMember[]> {
  if (!supabase) {
    return delay(
      forGym(gymId, mockPeople)
        .filter((p) => p.role === 'member' && p.status === 'active')
        .map(({ id, fullName }) => ({ id, fullName })),
    );
  }
  const rows = unwrap(
    await supabase
      .from('gym_members')
      .select('user_id, profile:profiles(full_name)')
      .eq('gym_id', gymId)
      .eq('role', 'member')
      .eq('status', 'active'),
  ) as unknown as MemberRow[];
  return rows
    .map((r) => ({ id: r.user_id, fullName: r.profile.full_name }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

/** Everyone at the gym with their email. Owners only. */
export async function listPeople(gymId: string): Promise<GymPerson[]> {
  if (!supabase) {
    return delay(
      [...forGym(gymId, mockPeople)].sort((a, b) => a.fullName.localeCompare(b.fullName)),
    );
  }
  const rows = unwrap(await supabase.rpc('gym_people', { p_gym_id: gymId })) as PersonRow[];
  return rows.map((r) => ({
    id: r.user_id,
    fullName: r.full_name || r.email || 'Unnamed',
    email: r.email ?? '',
    role: r.role,
    status: r.status,
    joinedAt: r.joined_at,
  }));
}

export async function listInvites(gymId: string): Promise<GymInvite[]> {
  if (!supabase) return delay(forGym(gymId, mockInvites));
  const rows = unwrap(
    await supabase
      .from('gym_invites')
      .select('id, email, role, created_at')
      .eq('gym_id', gymId)
      .order('created_at', { ascending: false }),
  ) as InviteRow[];
  return rows.map((r) => ({ id: r.id, email: r.email, role: r.role, createdAt: r.created_at }));
}

/**
 * Adds someone who already has an account straight away. Anyone else gets an
 * invite email whose link opens the app to set a password, and the invite is
 * also kept so signing up with that email works too.
 */
export async function invitePerson(
  gymId: string,
  email: string,
  role: GymPerson['role'],
): Promise<InviteOutcome> {
  if (!supabase) return { result: await mockInvite(email, role), emailSent: false };

  const { data, error } = await supabase.functions.invoke<
    InviteOutcome & { emailError: string | null }
  >('invite-member', {
    body: { gymId, email, role, redirectTo: setPasswordUrl() },
  });
  if (!error && data) return { result: data.result, emailSent: data.emailSent };

  // Before the invite-member function is deployed, still save the invite.
  const notDeployed =
    error instanceof FunctionsFetchError ||
    (error instanceof FunctionsHttpError && error.context.status === 404);
  if (!notDeployed) throw new Error(await functionErrorMessage(error));
  const result = unwrap(
    await supabase.rpc('invite_to_gym', { p_gym_id: gymId, p_email: email, p_role: role }),
  ) as InviteResult;
  return { result, emailSent: false };
}

async function functionErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null);
    if (body?.error) return body.error;
  }
  return error instanceof Error ? error.message : 'Something went wrong';
}

async function mockInvite(email: string, role: GymPerson['role']): Promise<InviteResult> {
  const normalized = normalizeEmail(email);
  if (mockPeople.some((p) => p.email === normalized)) return delay('already_member');
  const account = mockAccounts.find((a) => a.email === normalized);
  if (account) {
    mockPeople.push({
      ...account,
      role,
      status: 'active',
      joinedAt: new Date().toISOString(),
    });
    return delay('added');
  }
  const existing = mockInvites.find((i) => i.email === normalized);
  if (existing) existing.role = role;
  else {
    mockInvites.unshift({
      id: mockId('inv'),
      email: normalized,
      role,
      createdAt: new Date().toISOString(),
    });
  }
  return delay('invited');
}

export async function withdrawInvite(inviteId: string) {
  if (!supabase) {
    const index = mockInvites.findIndex((i) => i.id === inviteId);
    if (index >= 0) mockInvites.splice(index, 1);
    return delay(undefined);
  }
  const { error } = await supabase.from('gym_invites').delete().eq('id', inviteId);
  if (error) throw error;
}

const LAST_OWNER = 'A gym needs at least one active owner';

function wouldLeaveNoOwner(userId: string, next: Pick<GymPerson, 'role' | 'status'> | null) {
  const others = mockPeople.filter(
    (p) => p.id !== userId && p.role === 'owner' && p.status === 'active',
  );
  const stillOwner = next?.role === 'owner' && next.status === 'active';
  return others.length === 0 && !stillOwner;
}

/** Changes someone's role or suspends / reactivates them. */
export async function updatePerson(
  gymId: string,
  userId: string,
  patch: Partial<Pick<GymPerson, 'role' | 'status'>>,
) {
  if (!supabase) {
    const person = mockPeople.find((p) => p.id === userId);
    if (person) {
      const next = { ...person, ...patch };
      if (
        person.role === 'owner' &&
        person.status === 'active' &&
        wouldLeaveNoOwner(userId, next)
      ) {
        throw new Error(LAST_OWNER);
      }
      Object.assign(person, patch);
    }
    return delay(undefined);
  }
  const { error } = await supabase
    .from('gym_members')
    .update(patch)
    .eq('gym_id', gymId)
    .eq('user_id', userId);
  if (error) throw error;
}

/** Removes someone from the gym. Their account and history stay. */
export async function removePerson(gymId: string, userId: string) {
  if (!supabase) {
    const index = mockPeople.findIndex((p) => p.id === userId);
    const person = mockPeople[index];
    if (person?.role === 'owner' && person.status === 'active' && wouldLeaveNoOwner(userId, null)) {
      throw new Error(LAST_OWNER);
    }
    if (index >= 0) mockPeople.splice(index, 1);
    return delay(undefined);
  }
  const { error } = await supabase
    .from('gym_members')
    .delete()
    .eq('gym_id', gymId)
    .eq('user_id', userId);
  if (error) throw error;
}

/** Members a trainer coaches, from the plans they've assigned, with those plans' names. */
export async function listCoachedMembers(
  gymId: string,
  trainerId: string,
): Promise<CoachedMember[]> {
  let rows: CoachedRow[];
  if (!supabase) {
    rows = forGym(gymId, mockWorkouts)
      .filter((w) => w.trainerId === trainerId)
      .flatMap((w) =>
        w.assignedMemberIds.map((memberId) => ({
          member_id: memberId,
          member: { full_name: mockPeople.find((p) => p.id === memberId)?.fullName ?? 'Member' },
          workout: { title: w.title },
        })),
      );
  } else {
    rows = unwrap(
      await supabase
        .from('workout_assignments')
        .select(
          'member_id, member:profiles!workout_assignments_member_id_fkey(full_name), workout:workouts!inner(title, gym_id, trainer_id)',
        )
        .eq('workout.gym_id', gymId)
        .eq('workout.trainer_id', trainerId),
    ) as unknown as CoachedRow[];
  }
  const byMember = new Map<string, CoachedMember>();
  for (const row of rows) {
    const member = byMember.get(row.member_id) ?? {
      id: row.member_id,
      fullName: row.member.full_name,
      plans: [],
    };
    member.plans.push(row.workout.title);
    byMember.set(row.member_id, member);
  }
  const members = [...byMember.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
  return supabase ? members : delay(members);
}
