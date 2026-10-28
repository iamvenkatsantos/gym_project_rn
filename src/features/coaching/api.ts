import type { TrainerLink, TrainerRequest, TrainerRequestInput } from '@/features/coaching/types';
import {
  delay,
  forGym,
  mockId,
  mockNotifications,
  mockPeople,
  mockTrainerLinks,
  mockTrainerRequests,
} from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

type LinkRow = {
  member_id: string;
  trainer_id: string;
  assigned_at: string;
  member: { full_name: string };
  trainer: { full_name: string };
};

type RequestRow = {
  id: string;
  member_id: string;
  trainer_id: string | null;
  needs: string[];
  comments: string;
  status: TrainerRequest['status'];
  response: string;
  created_at: string;
  resolved_at: string | null;
  member: { full_name: string };
  trainer: { full_name: string } | null;
};

const LINK_COLUMNS =
  'member_id, trainer_id, assigned_at, member:profiles!member_trainers_member_id_fkey(full_name), trainer:profiles!member_trainers_trainer_id_fkey(full_name)';
const REQUEST_COLUMNS =
  'id, member_id, trainer_id, needs, comments, status, response, created_at, resolved_at, member:profiles!trainer_requests_member_id_fkey(full_name), trainer:profiles!trainer_requests_trainer_id_fkey(full_name)';

const nameOf = (id: string | null) =>
  id ? (mockPeople.find((p) => p.id === id)?.fullName ?? 'Someone') : null;

/**
 * Who trains whom. Owners and supervisors get every link at the gym; members
 * and trainers only get their own, so the same call works for every role.
 */
export async function listTrainerLinks(
  gymId: string,
  filter: { memberId?: string; trainerId?: string } = {},
): Promise<TrainerLink[]> {
  if (!supabase) {
    return delay(
      forGym(gymId, mockTrainerLinks).filter(
        (l) =>
          (!filter.memberId || l.memberId === filter.memberId) &&
          (!filter.trainerId || l.trainerId === filter.trainerId),
      ),
    );
  }
  let query = supabase.from('member_trainers').select(LINK_COLUMNS).eq('gym_id', gymId);
  if (filter.memberId) query = query.eq('member_id', filter.memberId);
  if (filter.trainerId) query = query.eq('trainer_id', filter.trainerId);
  const rows = unwrap(await query.order('assigned_at')) as unknown as LinkRow[];
  return rows.map((r) => ({
    memberId: r.member_id,
    memberName: r.member.full_name,
    trainerId: r.trainer_id,
    trainerName: r.trainer.full_name,
    assignedAt: r.assigned_at,
  }));
}

export async function assignTrainer(gymId: string, memberId: string, trainerId: string) {
  if (!supabase) {
    if (!mockTrainerLinks.some((l) => l.memberId === memberId && l.trainerId === trainerId)) {
      mockTrainerLinks.push({
        memberId,
        memberName: nameOf(memberId)!,
        trainerId,
        trainerName: nameOf(trainerId)!,
        assignedAt: new Date().toISOString(),
      });
    }
    return delay(undefined);
  }
  const { error } = await supabase
    .from('member_trainers')
    .upsert(
      { gym_id: gymId, member_id: memberId, trainer_id: trainerId },
      { onConflict: 'gym_id,member_id,trainer_id', ignoreDuplicates: true },
    );
  if (error) throw error;
}

/** Ends the mapping. The trainer's plans come off the member with it. */
export async function unassignTrainer(gymId: string, memberId: string, trainerId: string) {
  if (!supabase) {
    const index = mockTrainerLinks.findIndex(
      (l) => l.memberId === memberId && l.trainerId === trainerId,
    );
    if (index >= 0) mockTrainerLinks.splice(index, 1);
    return delay(undefined);
  }
  const { error } = await supabase
    .from('member_trainers')
    .delete()
    .eq('gym_id', gymId)
    .eq('member_id', memberId)
    .eq('trainer_id', trainerId);
  if (error) throw error;
}

/**
 * Maps and unmaps several people at once from one side: a member's trainers, or a
 * trainer's members. Unmapping takes that trainer's plans off the member.
 */
export async function changeTrainerLinks(
  gymId: string,
  side: { kind: 'member' | 'trainer'; id: string },
  change: { added: string[]; removed: string[] },
) {
  const pair = (otherId: string) =>
    side.kind === 'member'
      ? { memberId: side.id, trainerId: otherId }
      : { memberId: otherId, trainerId: side.id };
  if (!supabase) {
    for (const id of change.added) {
      const { memberId, trainerId } = pair(id);
      await assignTrainer(gymId, memberId, trainerId);
    }
    for (const id of change.removed) {
      const { memberId, trainerId } = pair(id);
      await unassignTrainer(gymId, memberId, trainerId);
    }
    return;
  }
  if (change.added.length) {
    const { error } = await supabase.from('member_trainers').upsert(
      change.added.map((id) => {
        const { memberId, trainerId } = pair(id);
        return { gym_id: gymId, member_id: memberId, trainer_id: trainerId };
      }),
      { onConflict: 'gym_id,member_id,trainer_id', ignoreDuplicates: true },
    );
    if (error) throw error;
  }
  if (change.removed.length) {
    const [own, other] =
      side.kind === 'member' ? ['member_id', 'trainer_id'] : ['trainer_id', 'member_id'];
    const { error } = await supabase
      .from('member_trainers')
      .delete()
      .eq('gym_id', gymId)
      .eq(own, side.id)
      .in(other, change.removed);
    if (error) throw error;
  }
}

/** Trainer requests: all of them for owners and supervisors, a member's own for members. */
export async function listTrainerRequests(gymId: string): Promise<TrainerRequest[]> {
  if (!supabase) return delay(forGym(gymId, mockTrainerRequests));
  const rows = unwrap(
    await supabase
      .from('trainer_requests')
      .select(REQUEST_COLUMNS)
      .eq('gym_id', gymId)
      .order('created_at', { ascending: false }),
  ) as unknown as RequestRow[];
  return rows.map((r) => ({
    id: r.id,
    memberId: r.member_id,
    memberName: r.member.full_name,
    trainerId: r.trainer_id,
    trainerName: r.trainer?.full_name ?? null,
    needs: r.needs,
    comments: r.comments,
    status: r.status,
    response: r.response,
    createdAt: r.created_at,
    resolvedAt: r.resolved_at,
  }));
}

export async function requestTrainer(gymId: string, memberId: string, input: TrainerRequestInput) {
  if (!supabase) {
    if (mockTrainerRequests.some((r) => r.memberId === memberId && r.status === 'pending')) {
      throw new Error('You already have a request waiting');
    }
    mockTrainerRequests.unshift({
      id: mockId('req'),
      memberId,
      memberName: nameOf(memberId)!,
      trainerId: input.trainerId,
      trainerName: nameOf(input.trainerId),
      needs: input.needs,
      comments: input.comments.trim(),
      status: 'pending',
      response: '',
      createdAt: new Date().toISOString(),
      resolvedAt: null,
    });
    return delay(undefined);
  }
  const { error } = await supabase.rpc('request_trainer', {
    p_gym_id: gymId,
    p_trainer_id: input.trainerId,
    p_needs: input.needs,
    p_comments: input.comments,
  });
  if (error) throw error;
}

export async function withdrawTrainerRequest(requestId: string) {
  if (!supabase) {
    const request = mockTrainerRequests.find((r) => r.id === requestId);
    if (request)
      Object.assign(request, { status: 'withdrawn', resolvedAt: new Date().toISOString() });
    return delay(undefined);
  }
  const { error } = await supabase.rpc('withdraw_trainer_request', { p_request_id: requestId });
  if (error) throw error;
}

/** Approving maps the member to trainerId, which may differ from the one they asked for. */
export async function resolveTrainerRequest(
  gymId: string,
  requestId: string,
  decision: { approve: boolean; trainerId: string | null; response: string },
) {
  if (!supabase) {
    const request = mockTrainerRequests.find((r) => r.id === requestId);
    if (!request || request.status !== 'pending')
      throw new Error('This request was already answered');
    if (decision.approve && !decision.trainerId) throw new Error('Pick a trainer');
    if (decision.approve && decision.trainerId) {
      await assignTrainer(gymId, request.memberId, decision.trainerId);
    }
    Object.assign(request, {
      status: decision.approve ? 'approved' : 'declined',
      trainerId: decision.approve ? decision.trainerId : request.trainerId,
      trainerName: decision.approve ? nameOf(decision.trainerId) : request.trainerName,
      response: decision.response.trim(),
      resolvedAt: new Date().toISOString(),
    });
    mockNotifications.unshift({
      id: mockId('n'),
      recipientId: request.memberId,
      senderName: null,
      kind: 'trainer_request',
      title: decision.approve ? 'Trainer request approved' : 'Trainer request declined',
      body: decision.response.trim(),
      classId: null,
      createdAt: new Date().toISOString(),
      readAt: null,
    });
    return delay(undefined);
  }
  const { error } = await supabase.rpc('resolve_trainer_request', {
    p_request_id: requestId,
    p_approve: decision.approve,
    p_trainer_id: decision.trainerId,
    p_response: decision.response,
  });
  if (error) throw error;
}
