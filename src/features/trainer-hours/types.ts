/** Why a trainer asks for time off during working hours. */
export type PermissionReason = 'medical' | 'family' | 'personal' | 'travel' | 'other';

export type PermissionStatus = 'pending' | 'approved' | 'rejected';

/**
 * The owner's working-hours rules for trainers at a branch. Secret: only owners read them.
 * Minutes throughout; off days are 0 = Sunday … 6 = Saturday.
 */
export type TrainerHourRules = {
  requiredMinutes: number;
  /** Short by more than this costs LOP; 0 means any shortfall does. */
  shortLimitMinutes: number;
  /** LOP for a short day. A day with no check-in and no permission costs the full day. */
  lopMinutes: number;
  offDays: number[];
  /**
   * Late: first check-in more than this many minutes after the branch opens. Null switches
   * late LOP off.
   */
  lateAfterMinutes: number | null;
  /** Late working days in a row that cost LOP once, before the count starts again. */
  lateStreakDays: number;
  /** LOP for each late streak. */
  lateLopMinutes: number;
  /** YYYY-MM-DD: LOP counts from here, never before. */
  startsOn: string;
};

export type TrainerHourRulesInput = Omit<TrainerHourRules, 'startsOn'>;

/** A trainer's request for time off during a working day. Times are minutes from midnight. */
export type WorkPermission = {
  id: string;
  trainerId: string;
  trainerName: string;
  day: string;
  startsAt: number;
  endsAt: number;
  reason: PermissionReason;
  note: string | null;
  status: PermissionStatus;
  createdAt: string;
};

export type PermissionInput = {
  day: string;
  startsAt: number;
  endsAt: number;
  reason: PermissionReason;
  note: string;
};

/** One trainer's working day from the server: time worked and approved permission. */
export type TrainerDay = {
  trainerId: string;
  fullName: string;
  day: string;
  workedMinutes: number;
  /** The longest single visit that day. */
  longestVisitMinutes: number;
  permissionMinutes: number;
  /** Minutes after midnight of the day's first check-in; null when they didn't come. */
  firstInMinute: number | null;
  /** When the day's earliest approved permission starts, or null. */
  permissionFromMinute: number | null;
  /** When the branch opens, or null when it's open 24 hours. */
  opensMinute: number | null;
};

/** A working day with the rules applied. */
export type TrainerDayResult = TrainerDay & {
  /** Short of the required hours after counting permission. */
  shortMinutes: number;
  /** All LOP for the day: shortfall plus any late streak that ends here. */
  lopMinutes: number;
  absent: boolean;
  late: boolean;
  /** LOP from a late streak that ends this day. */
  lateLopMinutes: number;
};

/** One trainer's month for the owner's LOP report. */
export type TrainerMonth = {
  trainerId: string;
  fullName: string;
  workingDays: number;
  workedMinutes: number;
  lopMinutes: number;
  lateDays: number;
  /** Days that cost LOP, oldest first. */
  lopDays: TrainerDayResult[];
};
