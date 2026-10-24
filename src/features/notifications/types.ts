export type NotificationKind =
  'message' | 'trainer_request' | 'trainer_assigned' | 'reminder' | 'booking' | 'membership';

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
