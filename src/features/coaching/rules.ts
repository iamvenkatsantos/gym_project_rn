import { isSignedUp } from '@/features/members/rules';
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

/** Active members, the ones without a trainer first so the gym sees who still needs one. */
export function membersToMatch(people: GymPerson[], links: TrainerLink[], query = '') {
  const mapped = new Set(links.map((l) => l.memberId));
  const q = query.trim().toLowerCase();
  return people
    .filter(
      (p) =>
        p.role === 'member' &&
        p.status === 'active' &&
        isSignedUp(p) &&
        (!q || p.fullName.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)),
    )
    .sort(
      (a, b) =>
        Number(mapped.has(a.id)) - Number(mapped.has(b.id)) || a.fullName.localeCompare(b.fullName),
    );
}

/** A member's trainers in a few words, for list rows. */
export function trainerSummary(links: TrainerLink[], memberId: string, skipTrainerId?: string) {
  const names = trainersOf(links, memberId)
    .filter((l) => l.trainerId !== skipTrainerId)
    .map((l) => l.trainerName);
  return names.length ? `Trainer: ${names.join(', ')}` : 'No trainer yet';
}

/** What Save will do: ids ticked that weren't saved, and saved ids now unticked. */
export function pickChanges(saved: Iterable<string>, picked: Iterable<string>) {
  const before = new Set(saved);
  const after = new Set(picked);
  return {
    added: [...after].filter((id) => !before.has(id)),
    removed: [...before].filter((id) => !after.has(id)),
  };
}

/** The Save button's label, e.g. "Save 3 changes". Short so it fits a small phone. */
export function changesLabel({ added, removed }: { added: string[]; removed: string[] }) {
  const count = added.length + removed.length;
  return count ? `Save ${count} change${count === 1 ? '' : 's'}` : 'No changes';
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
      .filter(
        (p) => p.role === 'member' && p.status === 'active' && isSignedUp(p) && !mine.has(p.id),
      )
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
