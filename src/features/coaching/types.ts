/** A member mapped to one of their trainers at a gym. A member can have several. */
export type TrainerLink = {
  memberId: string;
  memberName: string;
  trainerId: string;
  trainerName: string;
  assignedAt: string;
};

export type TrainerRequestStatus = 'pending' | 'approved' | 'declined' | 'withdrawn';

/** A member asking the gym for a trainer, with what they need help with. */
export type TrainerRequest = {
  id: string;
  memberId: string;
  memberName: string;
  /** The trainer they asked for, or the one they were given once approved. */
  trainerId: string | null;
  trainerName: string | null;
  needs: string[];
  comments: string;
  status: TrainerRequestStatus;
  response: string;
  createdAt: string;
  resolvedAt: string | null;
};

export type TrainerRequestInput = {
  trainerId: string | null;
  needs: string[];
  comments: string;
};
