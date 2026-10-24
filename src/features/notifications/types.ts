export type NotificationKind = 'message' | 'trainer_request' | 'trainer_assigned';

/** An in-app message: a nudge from the gym, or news about trainer matching. */
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
