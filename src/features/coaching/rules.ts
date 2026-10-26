import type { GymPerson } from '@/features/members/types';
import type { TrainerLink, TrainerRequest, TrainerRequestInput } from '@/features/coaching/types';

/** What a member can say they need a trainer for. */
export const trainerNeeds = [
  'Weight loss',
  'Muscle gain',
  'Strength',
  'Mobility',
  'Injury recovery',
  'Sport training',
  'Beginner guidance',
  'Nutrition',
] as const;

export const MAX_COMMENTS = 500;

export function trainersOf(links: TrainerLink[], memberId: string) {
  return links.filter((l) => l.memberId === memberId);
}

export function membersOf(links: TrainerLink[], trainerId: string) {
  return links.filter((l) => l.trainerId === trainerId);
}

/** Active members with no trainer yet, so the gym can match them. */
export function unmappedMembers(people: GymPerson[], links: TrainerLink[]) {
  const mapped = new Set(links.map((l) => l.memberId));
  return people.filter((p) => p.role === 'member' && p.status === 'active' && !mapped.has(p.id));
}

/**
 * Members a coach can assign plans to: their own first, then, for owners and
 * supervisors, every other active member, flagged so assigning maps them too.
 */
export function assignableMembers(
  coached: { id: string; fullName: string }[],
  others: GymPerson[] = [],
) {
  const mine = new Set(coached.map((m) => m.id));
  return [
    ...coached.map(({ id, fullName }) => ({ id, fullName, coached: true })),
    ...others
      .filter((p) => p.role === 'member' && p.status === 'active' && !mine.has(p.id))
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
      .map(({ id, fullName }) => ({ id, fullName, coached: false })),
  ];
}

export function pendingRequests(requests: TrainerRequest[]) {
  return requests
    .filter((r) => r.status === 'pending')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** The member's open request, if they have one. */
export function openRequest(requests: TrainerRequest[], memberId: string) {
  return requests.find((r) => r.memberId === memberId && r.status === 'pending') ?? null;
}

/** Why a request can't be sent yet, or null when it can. */
export function requestProblem(input: TrainerRequestInput) {
  if (input.needs.length === 0) return 'Pick at least one thing you need help with.';
  if (input.comments.length > MAX_COMMENTS)
    return `Keep comments under ${MAX_COMMENTS} characters.`;
  return null;
}

export function toggle<T>(items: T[], item: T) {
  return items.includes(item) ? items.filter((i) => i !== item) : [...items, item];
}

export const requestStatusLabel: Record<TrainerRequest['status'], string> = {
  pending: 'Waiting for the gym',
  approved: 'Approved',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
};
