import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { setPasswordUrl } from '@/features/auth/api';
import { listTrainerLinks } from '@/features/coaching/api';
import { avatarUrl } from '@/features/profile/api';
import type {
  CoachedMember,
  GymInvite,
  GymMember,
  GymPerson,
  ImportOutcome,
  InviteOutcome,
  InviteByCode,
  InviteResult,
  InviteRole,
} from '@/features/members/types';
import type { Role } from '@/features/auth/types';
import type { ImportRow } from '@/features/members/import-rules';
import {
  coachRoles,
  normalizeEmail,
  normalizeInviteCode,
  sortCoaches,
  type MemberKind,
} from '@/features/members/rules';
import {
  delay,
  forGym,
  mockAccounts,
  mockId,
  mockInvites,
  mockMemberships,
  mockPeople,
  mockPlans,
  mockWorkouts,
} from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

type MemberRow = { user_id: string; role: GymPerson['role']; profile: { full_name: string } };

type PersonRow = {
  user_id: string;
  full_name: string;
  email: string | null;
  role: GymPerson['role'];
  status: GymPerson['status'];
  joined_at: string;
  phone: string | null;
  admitted_by_name: string | null;
  admitted_at: string | null;
  onboarded_at: string | null;
  /** Missing before the profile photo migration. */
  avatar_path?: string | null;
  /** Missing before the invite codes migration. */
  signed_up?: boolean;
};

type InviteRow = {
  id: string;
  email: string;
  role: GymInvite['role'];
  created_at: string;
  code?: string | null;
  phone?: string | null;
  code_expires_at?: string | null;
};

type CoachedRow = { member_id: string; workout: { title: string } };

/**
 * Active members of a gym, or its coaches (trainers, plus the owners and
 * supervisors who can coach too), by name. Anyone at the gym can read this.
 */
export async function listGymMembers(
  gymId: string,
  kind: MemberKind = 'member',
): Promise<GymMember[]> {
  const roles: GymPerson['role'][] = kind === 'coach' ? coachRoles : ['member'];
  if (!supabase) {
    return delay(
      sortCoaches(
        forGym(gymId, mockPeople)
          .filter((p) => roles.includes(p.role) && p.status === 'active')
          .map(({ id, fullName, role }) => ({ id, fullName, role })),
      ),
    );
  }
  const rows = unwrap(
    await supabase
      .from('gym_members')
      .select('user_id, role, profile:profiles!gym_members_user_id_fkey(full_name)')
      .eq('gym_id', gymId)
      .in('role', roles)
      .eq('status', 'active'),
  ) as unknown as MemberRow[];
  return sortCoaches(
    rows.map((r) => ({ id: r.user_id, fullName: r.profile.full_name, role: r.role })),
  );
}

/** Everyone at the gym with their email. Owners and supervisors only. */
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
    phone: r.phone,
    admittedByName: r.admitted_by_name,
    admittedAt: r.admitted_at,
    onboarded: !!r.onboarded_at,
    avatarUrl: avatarUrl(r.avatar_path),
    signedUp: r.signed_up ?? true,
  }));
}

export async function listInvites(gymId: string): Promise<GymInvite[]> {
  if (!supabase) return delay(forGym(gymId, mockInvites));
  const select = (columns: string) =>
    supabase!
      .from('gym_invites')
      .select(columns)
      .eq('gym_id', gymId)
      .order('created_at', { ascending: false });
  let result = await select('id, email, role, created_at, code, phone, code_expires_at');
  // Before the invite codes migration there are no code columns.
  if (result.error?.code === '42703') result = await select('id, email, role, created_at');
  const rows = unwrap(result) as unknown as InviteRow[];
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    createdAt: r.created_at,
    code: r.code ?? null,
    phone: r.phone ?? null,
    codeExpiresAt: r.code_expires_at ?? null,
  }));
}

/**
 * Adds someone who already has an account straight away. Anyone else gets an
 * invite email whose link opens the app to set a password, and the invite is
 * also kept so signing up with that email works too. A 'gym_owner' invite
 * doesn't add them here: it lets them set up a new gym of their own. With
 * sendEmail false the invite is only saved, for staff to send on WhatsApp.
 */
export async function invitePerson(
  gymId: string,
  email: string,
  role: InviteRole,
  sendEmail = true,
  phone: string | null = null,
): Promise<InviteOutcome> {
  if (!supabase) {
    const result =
      role === 'gym_owner' ? await delay('invited' as const) : await mockInvite(email, role, phone);
    const code =
      result === 'invited' && phone
        ? (mockInvites.find((i) => i.email === normalizeEmail(email))?.code ?? null)
        : null;
    return { result, emailSent: false, emailError: null, code };
  }

  // A WhatsApp invite to the gym carries a one-time code to join with.
  if (!sendEmail && phone && role !== 'gym_owner') {
    const { data, error } = await supabase.rpc('whatsapp_invite', {
      p_gym_id: gymId,
      p_email: email,
      p_role: role,
      p_phone: phone,
    });
    // Before the invite codes migration, save it without a code.
    if (error?.code !== 'PGRST202') {
      const [row] = unwrap({ data, error }) as { result: InviteResult; code: string | null }[];
      return { result: row.result, emailSent: false, emailError: null, code: row.code };
    }
  }

  if (!sendEmail) {
    const result = unwrap(
      role === 'gym_owner'
        ? await supabase.rpc('invite_gym_owner', { p_email: email })
        : await supabase.rpc('invite_to_gym', { p_gym_id: gymId, p_email: email, p_role: role }),
    ) as InviteResult;
    return { result, emailSent: false, emailError: null };
  }

  const { data, error } = await supabase.functions.invoke<InviteOutcome>('invite-member', {
    body: { gymId, email, role, redirectTo: setPasswordUrl() },
  });
  if (!error && data) return data;

  // Before the invite-member function is deployed, still save the invite.
  const notDeployed =
    error instanceof FunctionsFetchError ||
    (error instanceof FunctionsHttpError && error.context.status === 404);
  if (!notDeployed) throw new Error(await functionErrorMessage(error));
  const result = unwrap(
    role === 'gym_owner'
      ? await supabase.rpc('invite_gym_owner', { p_email: email })
      : await supabase.rpc('invite_to_gym', { p_gym_id: gymId, p_email: email, p_role: role }),
  ) as InviteResult;
  return {
    result,
    emailSent: false,
    emailError:
      result === 'invited' ? 'The invite-member function is not deployed to Supabase yet.' : null,
  };
}

/**
 * Admin only: sets up a new gym and invites its owner to it, in one call, so the owner
 * never creates a gym. By email, invite-member then sends the invite for that gym.
 */
export async function inviteGymOwner(
  gym: { name: string; city: string },
  email: string,
  sendEmail: boolean,
  phone: string | null,
): Promise<InviteOutcome> {
  if (!supabase) {
    return delay({
      result: 'invited',
      emailSent: false,
      emailError: null,
      code: sendEmail ? null : 'K7P2QX4M',
    });
  }
  const [row] = unwrap(
    await supabase.rpc('admin_create_owner_gym', {
      p_name: gym.name,
      p_city: gym.city,
      p_email: email,
      p_phone: sendEmail ? null : phone,
    }),
  ) as { gym_id: string; result: InviteResult; code: string | null }[];
  if (!sendEmail || row.result !== 'invited') {
    return { result: row.result, emailSent: false, emailError: null, code: row.code };
  }
  const { data, error } = await supabase.functions.invoke<InviteOutcome>('invite-member', {
    body: { gymId: row.gym_id, email, role: 'gym_owner', redirectTo: setPasswordUrl() },
  });
  if (!error && data) return data;
  // The gym and the invite are saved; only the email didn't go.
  return {
    result: row.result,
    emailSent: false,
    emailError: await functionErrorMessage(error),
  };
}

/** Rows per call to import-members, which keeps each call well inside the function's time limit. */
export const IMPORT_CHUNK = 50;

/**
 * Imports checked rows from the owner's file, a chunk at a time, calling onProgress after each.
 * Every email gets an account if it has none, joins the gym as a member and gets its
 * membership. No email goes out; send invites afterwards with invitePerson.
 */
export async function importMembers(
  gymId: string,
  rows: ImportRow[],
  onProgress?: (done: number) => void,
): Promise<ImportOutcome[]> {
  const outcomes: ImportOutcome[] = [];
  for (let i = 0; i < rows.length; i += IMPORT_CHUNK) {
    const chunk = rows.slice(i, i + IMPORT_CHUNK);
    if (!supabase) {
      outcomes.push(...(await delay(chunk.map((row) => mockImport(gymId, row)))));
    } else {
      const { data, error } = await supabase.functions.invoke<{ results: ImportOutcome[] }>(
        'import-members',
        {
          body: {
            gymId,
            rows: chunk.map((r) => ({
              email: r.email,
              name: r.name,
              phone: r.phone,
              plan: r.plan,
              starts_on: r.startsOn,
              ends_on: r.endsOn,
              amount_paid_cents: r.amountPaidCents,
              payment_method: r.paymentMethod,
            })),
          },
        },
      );
      if (error || !data) {
        const reason = await functionErrorMessage(error);
        // Keep what already went in, and say where it stopped.
        if (outcomes.length) {
          throw new Error(`Imported ${outcomes.length} rows, then stopped: ${reason}`);
        }
        throw new Error(reason);
      }
      outcomes.push(...data.results);
    }
    onProgress?.(Math.min(i + IMPORT_CHUNK, rows.length));
  }
  return outcomes;
}

/** How sending invite emails after an import went. */
export type InviteBatch = {
  sent: number;
  failed: { email: string; error: string }[];
  stopped: boolean;
};

/**
 * Emails each imported member who has no account yet their invite, one at a time. Stops after
 * three failures in a row, which usually means the email provider's hourly limit is reached.
 */
export async function sendImportInvites(
  gymId: string,
  emails: string[],
  onProgress?: (done: number) => void,
): Promise<InviteBatch> {
  const batch: InviteBatch = { sent: 0, failed: [], stopped: false };
  let failuresInARow = 0;
  for (const [i, email] of emails.entries()) {
    try {
      const outcome = await invitePerson(gymId, email, 'member');
      if (outcome.emailSent || outcome.result !== 'invited') {
        batch.sent++;
        failuresInARow = 0;
      } else {
        batch.failed.push({ email, error: outcome.emailError ?? 'The email didn’t go out' });
        failuresInARow++;
      }
    } catch (error) {
      batch.failed.push({ email, error: error instanceof Error ? error.message : String(error) });
      failuresInARow++;
    }
    onProgress?.(i + 1);
    if (failuresInARow >= 3 && i < emails.length - 1) {
      batch.stopped = true;
      break;
    }
  }
  return batch;
}

function mockImport(gymId: string, row: ImportRow): ImportOutcome {
  const existing = mockPeople.find((p) => p.email === row.email);
  if (existing && existing.role !== 'member') {
    return {
      email: row.email,
      result: 'skipped',
      joined: true,
      message: `Already at your gym as a ${existing.role}`,
    };
  }
  const person = existing ?? {
    id: mockId('u'),
    fullName: row.name,
    email: row.email,
    role: 'member' as const,
    status: 'active' as const,
    joinedAt: new Date().toISOString(),
    phone: row.phone,
    admittedByName: 'Rajesh Kannan',
    admittedAt: new Date().toISOString(),
    onboarded: false,
  };
  if (!existing) mockPeople.push(person);
  const plan = forGym(gymId, mockPlans).find((p) => p.name === row.plan);
  if (plan && row.startsOn && row.endsOn) {
    mockMemberships.push({
      id: mockId('m'),
      memberId: person.id,
      memberName: person.fullName,
      plan,
      startsOn: row.startsOn,
      endsOn: row.endsOn,
      amountPaidCents: row.amountPaidCents,
      paymentMethod: row.paymentMethod,
    });
  }
  return {
    email: row.email,
    result: existing ? 'updated' : 'added',
    joined: !!existing,
    message: null,
  };
}

async function functionErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null);
    if (body?.error) return body.error;
  }
  return error instanceof Error ? error.message : 'Something went wrong';
}

async function mockInvite(
  email: string,
  role: GymPerson['role'],
  phone: string | null = null,
): Promise<InviteResult> {
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
  const code = phone ? mockInviteCode() : null;
  const codeExpiresAt = code ? new Date(Date.now() + 7 * 86_400_000).toISOString() : null;
  const existing = mockInvites.find((i) => i.email === normalized);
  if (existing) Object.assign(existing, { role }, code ? { code, phone, codeExpiresAt } : {});
  else {
    mockInvites.unshift({
      id: mockId('inv'),
      email: normalized,
      role,
      createdAt: new Date().toISOString(),
      code,
      phone,
      codeExpiresAt,
    });
  }
  return delay('invited');
}

function mockInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * 32)]).join('');
}

/** The gym, email and role behind an invite code, or null for a wrong or used one. */
export async function findInviteByCode(code: string): Promise<InviteByCode | null> {
  const clean = normalizeInviteCode(code);
  if (!supabase) {
    const invite = mockInvites.find((i) => i.code === clean);
    return delay(
      invite ? { gymName: 'CoreFit Gym Demo', email: invite.email, role: invite.role } : null,
    );
  }
  const rows = unwrap(await supabase.rpc('invite_by_code', { p_code: clean })) as {
    gym_name: string;
    email: string;
    role: Role;
  }[];
  const row = rows[0];
  return row ? { gymName: row.gym_name, email: row.email, role: row.role } : null;
}

/**
 * Makes the invited person's account from their code, name and password, already confirmed,
 * and returns the email to sign in with. Each code works once.
 */
export async function acceptInvite(code: string, fullName: string, password: string) {
  if (!supabase) throw new Error('Demo mode can’t make accounts. Pick a demo role instead.');
  const { data, error } = await supabase.functions.invoke<{ email: string }>('accept-invite', {
    body: { code: normalizeInviteCode(code), fullName, password },
  });
  if (error || !data) throw new Error(await functionErrorMessage(error));
  return data.email;
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

/**
 * Suspends or reactivates someone. Roles can't be changed once given; the database refuses
 * anyone but a CoreFit Gym admin.
 */
export async function updatePerson(
  gymId: string,
  userId: string,
  patch: Pick<GymPerson, 'status'>,
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

/** Members mapped to a trainer, with the names of the plans that trainer gave them. */
export async function listCoachedMembers(
  gymId: string,
  trainerId: string,
): Promise<CoachedMember[]> {
  const links = await listTrainerLinks(gymId, { trainerId });
  let rows: CoachedRow[];
  if (!supabase) {
    rows = forGym(gymId, mockWorkouts)
      .filter((w) => w.trainerId === trainerId)
      .flatMap((w) =>
        w.assignedMemberIds.map((memberId) => ({
          member_id: memberId,
          workout: { title: w.title },
        })),
      );
  } else {
    rows = unwrap(
      await supabase
        .from('workout_assignments')
        .select('member_id, workout:workouts!inner(title, gym_id, trainer_id)')
        .eq('workout.gym_id', gymId)
        .eq('workout.trainer_id', trainerId),
    ) as unknown as CoachedRow[];
  }
  return links
    .map((link) => ({
      id: link.memberId,
      fullName: link.memberName,
      plans: rows.filter((r) => r.member_id === link.memberId).map((r) => r.workout.title),
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}
