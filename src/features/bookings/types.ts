export type GymClass = {
  id: string;
  trainerId: string;
  trainerName: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
  bookedCount: number;
};

export type BookingStatus = 'booked' | 'cancelled' | 'attended';

export type Booking = {
  id: string;
  classId: string;
  memberId: string;
  status: BookingStatus;
  gymClass: GymClass;
};
