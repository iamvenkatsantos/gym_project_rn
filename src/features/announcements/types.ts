/** Who an announcement is for. Staff is everyone who works at the gym: trainers, supervisors and owners. */
export type Audience = 'everyone' | 'members' | 'staff';

/** News an owner or supervisor posts to the gym, e.g. a holiday, new timings or an offer. */
export type Announcement = {
  id: string;
  senderName: string | null;
  audience: Audience;
  title: string;
  body: string;
  createdAt: string;
};

export type AnnouncementInput = {
  audience: Audience;
  title: string;
  body: string;
};
