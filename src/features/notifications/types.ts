export type NotificationKind =
  | 'message'
  | 'trainer_request'
  | 'trainer_assigned'
  | 'reminder'
  | 'booking'
  | 'membership'
  | 'attendance'
  | 'announcement'
  | 'birthday'
  /** Self workouts switched on, a trainer edited a member's own plan or replied to a workout. */
  | 'workout'
  /** A gym invited someone who already has an account (they accept it in the app). */
  | 'invite';

/**
 * An in-app message: a nudge from the gym, news about trainer matching or bookings, or a
 * reminder. Each one is also sent as a push notification.
 */
export type AppNotification = {
  id: string;
  recipientId: string;
  senderName: string | null;
  kind: NotificationKind;
  title: string;
  body: string;
  classId: string | null;
  /** A number to call from the inbox, e.g. a friend a member referred. */
  phone?: string | null;
  createdAt: string;
  readAt: string | null;
};

export type TrainerMessageInput = {
  trainerId: string;
  title: string;
  body: string;
  classId: string | null;
};

/** What the server puts in a push notification's data, read when it's tapped. */
export type PushData = {
  notificationId: string;
  gymId: string;
  kind: NotificationKind;
};
