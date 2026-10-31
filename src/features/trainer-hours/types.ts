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
};

/** A working day with the rules applied. */
export type TrainerDayResult = TrainerDay & {
  /** Short of the required hours after counting permission. */
  shortMinutes: number;
  lopMinutes: number;
  absent: boolean;
};

/** One trainer's month for the owner's LOP report. */
export type TrainerMonth = {
  trainerId: string;
  fullName: string;
  workingDays: number;
  workedMinutes: number;
  lopMinutes: number;
  /** Days that cost LOP, oldest first. */
  lopDays: TrainerDayResult[];
};
