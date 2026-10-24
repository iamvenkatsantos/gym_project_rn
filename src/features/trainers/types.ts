export type Trainer = {
  id: string;
  fullName: string;
  bio: string;
  specialties: string[];
  sessionMinutes: number;
};

/** A weekly recurring window, in the gym's local time. weekday: 0 = Sunday. */
export type AvailabilityWindow = {
  weekday: number;
  startTime: string;
  endTime: string;
};

export type TrainerWithAvailability = Trainer & {
  availability: AvailabilityWindow[];
};

export type BusySlot = {
  startsAt: string;
  endsAt: string;
};

export type SessionStatus = 'booked' | 'cancelled' | 'completed';

export type TrainerSession = {
  id: string;
  gymId: string;
  trainerId: string;
  trainerName: string;
  memberId: string;
  memberName: string;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
};
