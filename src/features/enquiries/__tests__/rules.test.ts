import {
  callUrl,
  conversion,
  countEnquiries,
  enquirySummary,
  filterEnquiries,
  findDuplicate,
  followUpProblem,
  isDue,
  isOverdue,
  normalizePhone,
  trialDates,
  trialFollowUp,
  trialProgress,
  whatsappUrl,
} from '@/features/enquiries/rules';
import type { Enquiry } from '@/features/enquiries/types';

const now = new Date(2026, 9, 26, 12, 0);

const enquiry = (id: string, partial: Partial<Enquiry> = {}): Enquiry => ({
  id,
  fullName: id,
  phone: '9840000000',
  email: null,
  source: 'walk_in',
  interest: '',
  status: 'new',
  nextFollowUpAt: null,
  trialStartsOn: null,
  trialEndsOn: null,
  lostReason: '',
  assignedTo: null,
  memberId: null,
  createdAt: new Date(2026, 9, 20).toISOString(),
  ...partial,
});

const at = (h: number, day = 26) => new Date(2026, 9, day, h).toISOString();

describe('follow-ups', () => {
  it('counts a follow-up as due until the end of today, and overdue once it has passed', () => {
    const late = enquiry('late', { nextFollowUpAt: at(9) });
    const tonight = enquiry('tonight', { nextFollowUpAt: at(20) });
    const tomorrow = enquiry('tomorrow', { nextFollowUpAt: at(9, 27) });
    expect([late, tonight, tomorrow].map((e) => isDue(e, now))).toEqual([true, true, false]);
    expect([late, tonight].map((e) => isOverdue(e, now))).toEqual([true, false]);
  });

  it('never counts joined or lost enquiries as due', () => {
    expect(isDue(enquiry('a', { status: 'joined', nextFollowUpAt: at(9) }), now)).toBe(false);
    expect(isDue(enquiry('b', { status: 'lost', nextFollowUpAt: at(9) }), now)).toBe(false);
  });

  it('refuses a follow-up time in the past', () => {
    expect(followUpProblem(new Date(2026, 9, 26, 11), now)).toMatch(/later than now/);
    expect(followUpProblem(new Date(2026, 9, 26, 13), now)).toBeNull();
    expect(followUpProblem(null, now)).toBeNull();
  });
});

describe('lists', () => {
  const list = [
    enquiry('none'),
    enquiry('soon', { nextFollowUpAt: at(15) }),
    enquiry('late', { nextFollowUpAt: at(9), interest: 'Yoga' }),
    enquiry('trial', {
      status: 'trial',
      trialStartsOn: '2026-10-25',
      trialEndsOn: '2026-10-27',
      phone: '9884011111',
    }),
    enquiry('joined', { status: 'joined', createdAt: new Date(2026, 9, 25).toISOString() }),
    enquiry('lost', { status: 'lost' }),
  ];

  it('puts open enquiries first, soonest follow-up first', () => {
    expect(filterEnquiries(list, 'open', '', now).map((e) => e.id)).toEqual([
      'late',
      'soon',
      'none',
      'trial',
    ]);
  });

  it('searches names, interests and phone digits', () => {
    expect(filterEnquiries(list, 'all', 'yoga', now).map((e) => e.id)).toEqual(['late']);
    expect(filterEnquiries(list, 'all', '98840 11', now).map((e) => e.id)).toEqual(['trial']);
  });

  it('counts each filter', () => {
    expect(countEnquiries(list, now)).toEqual({
      open: 4,
      due: 2,
      trial: 1,
      joined: 1,
      lost: 1,
      all: 6,
    });
  });

  it('works out the conversion rate over recent enquiries', () => {
    expect(conversion(list, 30, now)).toEqual({ enquiries: 6, joined: 1, rate: 17 });
    expect(conversion([], 30, now).rate).toBeNull();
  });

  it('summarises where each one stands', () => {
    expect(enquirySummary(list[3], now)).toBe('Trial: day 2 of 3 · No follow-up set');
    expect(enquirySummary(enquiry('x', { status: 'lost', lostReason: 'Too far' }), now)).toBe(
      'Lost: Too far',
    );
  });
});

describe('phones', () => {
  it('keeps Indian mobiles as 10 digits', () => {
    expect(normalizePhone('+91 98400 12345')).toBe('9840012345');
    expect(normalizePhone('098400-12345')).toBe('9840012345');
    expect(normalizePhone('+44 7700 900123')).toBe('+447700900123');
  });

  it('builds call and WhatsApp links', () => {
    expect(callUrl('9840012345')).toBe('tel:+919840012345');
    expect(whatsappUrl('9840012345', 'Hi Kavya')).toBe(
      'https://wa.me/919840012345?text=Hi%20Kavya',
    );
  });

  it('spots a number that already enquired, but not the enquiry itself', () => {
    const list = [enquiry('a', { phone: '9840012345' })];
    expect(findDuplicate(list, '+91 98400 12345')?.id).toBe('a');
    expect(findDuplicate(list, '9840012345', 'a')).toBeUndefined();
  });
});

describe('trial passes', () => {
  it('runs for whole days from the start date', () => {
    expect(trialDates(new Date(2026, 9, 30, 15), 3)).toEqual({
      trialStartsOn: '2026-10-30',
      trialEndsOn: '2026-11-01',
    });
  });

  it('says which day of the trial it is', () => {
    const trial = { trialStartsOn: '2026-10-26', trialEndsOn: '2026-10-28' };
    expect(trialProgress(trial, now)?.label).toBe('Day 1 of 3');
    expect(trialProgress(trial, new Date(2026, 9, 28, 9))?.label).toBe('Last day of 3');
    expect(trialProgress(trial, new Date(2026, 9, 29))?.state).toBe('ended');
    expect(trialProgress(trial, new Date(2026, 9, 25))?.state).toBe('upcoming');
  });

  it('follows up at 5 PM on the last day, or in an hour if that has passed', () => {
    expect(trialFollowUp('2026-10-28', now)).toEqual(new Date(2026, 9, 28, 17));
    expect(trialFollowUp('2026-10-26', new Date(2026, 9, 26, 18))).toEqual(
      new Date(2026, 9, 26, 19),
    );
  });
});
