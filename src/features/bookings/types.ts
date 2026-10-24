export type GymClass = {
  id: string;
  trainerId: string | null;
  trainerName: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
  bookedCount: number;
  /** Shared by the classes of one weekly repeat; null for a one-off class. */
  seriesId: string | null;
};

/** What an owner fills in to schedule a class. */
export type ClassInput = {
  title: string;
  trainerId: string | null;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
};

export type BookingStatus = 'booked' | 'cancelled' | 'attended';

export type Booking = {
  id: string;
  classId: string;
  memberId: string;
  status: BookingStatus;
  gymClass: GymClass;
};
