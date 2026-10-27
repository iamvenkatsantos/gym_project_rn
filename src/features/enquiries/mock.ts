import type { Enquiry, EnquiryNote } from '@/features/enquiries/types';

/** Demo enquiries for the first gym; they reset on every reload like the rest of mock-db. */
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function at(msFromNow: number) {
  return new Date(Date.now() + msFromNow).toISOString();
}

function day(daysFromToday: number) {
  const d = new Date(Date.now() + daysFromToday * DAY);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function enquiry(partial: Partial<Enquiry> & Pick<Enquiry, 'id' | 'fullName' | 'phone'>): Enquiry {
  return {
    email: null,
    source: 'walk_in',
    interest: '',
    status: 'new',
    nextFollowUpAt: null,
    trialStartsOn: null,
    trialEndsOn: null,
    lostReason: '',
    assignedTo: 'u-owner',
    memberId: null,
    createdAt: at(-DAY),
    ...partial,
  };
}

export const mockEnquiries: Enquiry[] = [
  enquiry({
    id: 'enq-1',
    fullName: 'Kavya Nair',
    phone: '9840011111',
    email: 'kavya@example.com',
    interest: 'Weight loss, evening batch',
    status: 'following_up',
    nextFollowUpAt: at(-2 * HOUR),
    createdAt: at(-3 * DAY),
  }),
  enquiry({
    id: 'enq-2',
    fullName: 'Vikram Rao',
    phone: '9884022222',
    source: 'referral',
    interest: 'Strength training, referred by Arjun',
    status: 'trial',
    trialStartsOn: day(-1),
    trialEndsOn: day(1),
    nextFollowUpAt: at(DAY + 5 * HOUR),
    createdAt: at(-2 * DAY),
  }),
  enquiry({
    id: 'enq-3',
    fullName: 'Ananya Iyer',
    phone: '9791033333',
    source: 'social',
    interest: 'Yoga and Zumba, asked about the quarterly plan',
    nextFollowUpAt: at(3 * HOUR),
    createdAt: at(-2 * HOUR),
  }),
  enquiry({
    id: 'enq-4',
    fullName: 'Sneha Iyer',
    phone: '9003044444',
    email: 'sneha@example.com',
    source: 'phone',
    interest: 'Personal training',
    status: 'following_up',
    nextFollowUpAt: at(2 * DAY),
    createdAt: at(-5 * DAY),
  }),
  enquiry({
    id: 'enq-5',
    fullName: 'Harish Patel',
    phone: '9445055555',
    email: 'harish@example.com',
    interest: 'Monthly plan',
    status: 'joined',
    memberId: 'u-member-4',
    createdAt: at(-28 * DAY),
  }),
  enquiry({
    id: 'enq-6',
    fullName: 'Ramesh Babu',
    phone: '9566066666',
    interest: 'Morning cardio',
    status: 'lost',
    lostReason: 'Too expensive',
    createdAt: at(-12 * DAY),
  }),
];

export const mockEnquiryNotes: (EnquiryNote & { enquiryId: string })[] = [
  {
    id: 'enn-1',
    enquiryId: 'enq-1',
    kind: 'call',
    body: 'Wants to start after Diwali, call back on Monday.',
    authorName: 'Rajesh Kannan',
    createdAt: at(-2 * DAY),
  },
  {
    id: 'enn-2',
    enquiryId: 'enq-1',
    kind: 'status',
    body: 'Following up',
    authorName: 'Rajesh Kannan',
    createdAt: at(-2 * DAY),
  },
  {
    id: 'enn-3',
    enquiryId: 'enq-2',
    kind: 'status',
    body: 'Trial pass for 3 days',
    authorName: 'Meena Sundaram',
    createdAt: at(-DAY),
  },
  {
    id: 'enn-4',
    enquiryId: 'enq-2',
    kind: 'visit',
    body: 'Came in for the evening session, liked the free weights area.',
    authorName: 'Meena Sundaram',
    createdAt: at(-20 * HOUR),
  },
];
