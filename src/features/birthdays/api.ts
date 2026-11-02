import { delay, forGym, mockNotifications, mockPeople } from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

import { birthdayMessage } from '@/features/birthdays/rules';

/** Owners and supervisors add or fix a member's date of birth (YYYY-MM-DD). */
export async function setMemberBirthday(gymId: string, memberId: string, dateOfBirth: string) {
  if (!supabase) {
    const person = forGym(gymId, mockPeople).find((p) => p.id === memberId);
    if (person) person.dateOfBirth = dateOfBirth;
    return delay(undefined);
  }
  const { error } = await supabase.rpc('set_member_birthday', {
    p_gym_id: gymId,
    p_member_id: memberId,
    p_date_of_birth: dateOfBirth,
  });
  if (error) throw error;
}

/**
 * Sends a member the gym's birthday wish (inbox and push). False if someone at the gym
 * already wished them this year; the server also checks it's their birthday today.
 */
export async function sendBirthdayWish(
  gymId: string,
  gymName: string,
  memberId: string,
): Promise<boolean> {
  if (!supabase) {
    const person = forGym(gymId, mockPeople).find((p) => p.id === memberId);
    const key = `birthday:${memberId}:${new Date().getFullYear()}`;
    if (!person || mockNotifications.some((n) => n.id === key)) return delay(false);
    mockNotifications.unshift({
      id: key,
      recipientId: memberId,
      senderName: null,
      kind: 'birthday',
      title: 'Happy birthday!',
      body: birthdayMessage(person.fullName, gymName),
      classId: null,
      createdAt: new Date().toISOString(),
      readAt: null,
    });
    return delay(true);
  }
  return unwrap(
    await supabase.rpc('send_birthday_wish', { p_gym_id: gymId, p_member_id: memberId }),
  ) as boolean;
}
