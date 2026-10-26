import { mockEnquiries, mockEnquiryNotes } from '@/features/enquiries/mock';
import type {
  Enquiry,
  EnquiryInput,
  EnquiryNote,
  EnquiryPatch,
  FollowUpKind,
} from '@/features/enquiries/types';
import { delay, forGym, mockId, mockPeople } from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

type EnquiryRow = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  source: Enquiry['source'];
  interest: string;
  status: Enquiry['status'];
  next_follow_up_at: string | null;
  trial_starts_on: string | null;
  trial_ends_on: string | null;
  lost_reason: string;
  assigned_to: string | null;
  member_id: string | null;
  created_at: string;
};

type NoteRow = {
  id: string;
  kind: EnquiryNote['kind'];
  body: string;
  created_at: string;
  author: { full_name: string } | null;
};

const columns =
  'id, full_name, phone, email, source, interest, status, next_follow_up_at, trial_starts_on, trial_ends_on, lost_reason, assigned_to, member_id, created_at';

function toEnquiry(r: EnquiryRow): Enquiry {
  return {
    id: r.id,
    fullName: r.full_name,
    phone: r.phone,
    email: r.email,
    source: r.source,
    interest: r.interest,
    status: r.status,
    nextFollowUpAt: r.next_follow_up_at,
    trialStartsOn: r.trial_starts_on,
    trialEndsOn: r.trial_ends_on,
    lostReason: r.lost_reason,
    assignedTo: r.assigned_to,
    memberId: r.member_id,
    createdAt: r.created_at,
  };
}

function toRow(patch: EnquiryPatch) {
  const keys: [keyof EnquiryPatch, keyof EnquiryRow][] = [
    ['fullName', 'full_name'],
    ['phone', 'phone'],
    ['email', 'email'],
    ['source', 'source'],
    ['interest', 'interest'],
    ['status', 'status'],
    ['nextFollowUpAt', 'next_follow_up_at'],
    ['trialStartsOn', 'trial_starts_on'],
    ['trialEndsOn', 'trial_ends_on'],
    ['lostReason', 'lost_reason'],
    ['assignedTo', 'assigned_to'],
  ];
  return Object.fromEntries(
    keys.filter(([key]) => patch[key] !== undefined).map(([key, column]) => [column, patch[key]]),
  );
}

/** Every enquiry at the gym. Owners and supervisors only. */
export async function listEnquiries(gymId: string): Promise<Enquiry[]> {
  if (!supabase) return delay(forGym(gymId, mockEnquiries));
  const rows = unwrap(
    await supabase
      .from('enquiries')
      .select(columns)
      .eq('gym_id', gymId)
      .order('created_at', { ascending: false })
      .limit(1000),
  ) as EnquiryRow[];
  return rows.map(toEnquiry);
}

/** An enquiry's timeline, newest first. */
export async function listEnquiryNotes(enquiryId: string): Promise<EnquiryNote[]> {
  if (!supabase) {
    return delay(
      mockEnquiryNotes
        .filter((n) => n.enquiryId === enquiryId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(({ enquiryId: _, ...note }) => note),
    );
  }
  const rows = unwrap(
    await supabase
      .from('enquiry_notes')
      .select('id, kind, body, created_at, author:profiles(full_name)')
      .eq('enquiry_id', enquiryId)
      .order('created_at', { ascending: false }),
  ) as unknown as NoteRow[];
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    body: r.body,
    authorName: r.author?.full_name ?? null,
    createdAt: r.created_at,
  }));
}

export async function createEnquiry(gymId: string, input: EnquiryInput): Promise<Enquiry> {
  if (!supabase) {
    const created: Enquiry = {
      ...input,
      id: mockId('enq'),
      status: 'new',
      trialStartsOn: null,
      trialEndsOn: null,
      lostReason: '',
      memberId: null,
      createdAt: new Date().toISOString(),
    };
    mockEnquiries.unshift(created);
    return delay(created);
  }
  const row = unwrap(
    await supabase
      .from('enquiries')
      .insert({ gym_id: gymId, ...toRow(input) })
      .select(columns)
      .single(),
  ) as EnquiryRow;
  return toEnquiry(row);
}

/** What the database's status trigger writes on the timeline, for demo mode. */
function mockStatusNote(before: Enquiry, after: Enquiry) {
  if (before.status === after.status && before.trialEndsOn === after.trialEndsOn) return;
  const body = {
    new: 'Reopened',
    following_up:
      before.status === 'joined' || before.status === 'lost' ? 'Reopened' : 'Following up',
    trial: `Trial pass ${after.trialStartsOn} to ${after.trialEndsOn}`,
    joined: 'Invited as a member',
    lost: after.lostReason ? `Marked lost: ${after.lostReason}` : 'Marked lost',
  }[after.status];
  mockEnquiryNotes.push({
    id: mockId('enn'),
    enquiryId: after.id,
    kind: 'status',
    body,
    authorName: 'You',
    createdAt: new Date().toISOString(),
  });
}

export async function updateEnquiry(enquiryId: string, patch: EnquiryPatch) {
  if (!supabase) {
    const enquiry = mockEnquiries.find((e) => e.id === enquiryId);
    if (!enquiry) throw new Error('Enquiry not found');
    const before = { ...enquiry };
    Object.assign(enquiry, patch);
    if (enquiry.status === 'joined' || enquiry.status === 'lost') enquiry.nextFollowUpAt = null;
    if (enquiry.status !== 'lost') enquiry.lostReason = '';
    mockStatusNote(before, enquiry);
    return delay(undefined);
  }
  const { error } = await supabase.from('enquiries').update(toRow(patch)).eq('id', enquiryId);
  if (error) throw error;
}

/** Owners only, e.g. for a duplicate. Everyone else marks an enquiry lost. */
export async function deleteEnquiry(enquiryId: string) {
  if (!supabase) {
    const index = mockEnquiries.findIndex((e) => e.id === enquiryId);
    if (index >= 0) mockEnquiries.splice(index, 1);
    return delay(undefined);
  }
  const { error, count } = await supabase
    .from('enquiries')
    .delete({ count: 'exact' })
    .eq('id', enquiryId);
  if (error) throw error;
  if (count === 0) throw new Error('Only owners can delete an enquiry');
}

/** Logs a call, visit or note and sets the next follow-up (null for none). */
export async function logFollowUp(
  enquiryId: string,
  kind: FollowUpKind,
  body: string,
  nextAt: string | null,
) {
  if (!supabase) {
    const enquiry = mockEnquiries.find((e) => e.id === enquiryId);
    if (!enquiry) throw new Error('Enquiry not found');
    mockEnquiryNotes.push({
      id: mockId('enn'),
      enquiryId,
      kind,
      body: body.trim() || { call: 'Called', visit: 'Visited', note: 'Note' }[kind],
      authorName: 'You',
      createdAt: new Date().toISOString(),
    });
    const before = { ...enquiry };
    enquiry.nextFollowUpAt =
      enquiry.status === 'joined' || enquiry.status === 'lost' ? null : nextAt;
    if (enquiry.status === 'new') enquiry.status = 'following_up';
    mockStatusNote(before, enquiry);
    return delay(undefined);
  }
  const { error } = await supabase.rpc('log_enquiry_follow_up', {
    p_enquiry_id: enquiryId,
    p_kind: kind,
    p_body: body,
    p_next_at: nextAt,
  });
  if (error) throw error;
}

/** Demo mode stands in for the join trigger: an existing account links at once. */
export function mockLinkEnquiry(enquiryId: string, email: string) {
  const enquiry = mockEnquiries.find((e) => e.id === enquiryId);
  const person = mockPeople.find((p) => p.email === email && p.role === 'member');
  if (enquiry && person) enquiry.memberId = person.id;
}
