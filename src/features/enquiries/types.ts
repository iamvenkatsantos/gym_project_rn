/** Where an enquiry stands: being followed up, trying the gym, or settled. */
export type EnquiryStatus = 'new' | 'following_up' | 'trial' | 'joined' | 'lost';

/** How they found the gym. */
export type EnquirySource = 'walk_in' | 'phone' | 'referral' | 'social' | 'other';

/** Someone who asked about joining, as the front desk tracks them. */
export type Enquiry = {
  id: string;
  fullName: string;
  /** Digits with an optional leading +, e.g. 9840012345. */
  phone: string;
  email: string | null;
  source: EnquirySource;
  /** What they asked about: a goal, a plan, a time of day. */
  interest: string;
  status: EnquiryStatus;
  nextFollowUpAt: string | null;
  /** YYYY-MM-DD, both set while they have (or had) a trial pass. */
  trialStartsOn: string | null;
  trialEndsOn: string | null;
  lostReason: string;
  assignedTo: string | null;
  /** Their account, once they've joined the gym. */
  memberId: string | null;
  createdAt: string;
};

export type EnquiryInput = Pick<
  Enquiry,
  'fullName' | 'phone' | 'email' | 'source' | 'interest' | 'nextFollowUpAt' | 'assignedTo'
>;

/** Changes the front desk makes from the enquiry screen. */
export type EnquiryPatch = Partial<
  Pick<
    Enquiry,
    'status' | 'trialStartsOn' | 'trialEndsOn' | 'lostReason' | 'nextFollowUpAt' | 'email'
  >
> &
  Partial<EnquiryInput>;

export type FollowUpKind = 'call' | 'visit' | 'note';

/** A line on an enquiry's timeline. */
export type EnquiryNote = {
  id: string;
  kind: FollowUpKind | 'status';
  body: string;
  authorName: string | null;
  createdAt: string;
};

export type EnquiryFilter = 'open' | 'due' | 'trial' | 'joined' | 'lost' | 'all';
