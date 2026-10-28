import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchProfile } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/auth-store';
import { memberKeys } from '@/features/members/hooks';
import { removeAvatars, saveMyProfile, uploadAvatar } from '@/features/profile/api';
import type { ProfileInput } from '@/features/profile/types';

/**
 * Uploads a newly picked photo, saves the name, mobile and photo, then reloads
 * the profile (which also lets staff past the first-sign-in profile screen).
 * The replaced photo is removed afterwards.
 */
export function useSaveProfile(userId: string, currentAvatarPath: string | null | undefined) {
  const queryClient = useQueryClient();
  const setProfile = useAuthStore((s) => s.setProfile);
  return useMutation({
    mutationFn: async ({ photo, ...details }: ProfileInput) => {
      const avatarPath =
        photo === undefined
          ? (currentAvatarPath ?? null)
          : photo
            ? await uploadAvatar(userId, photo)
            : null;
      try {
        await saveMyProfile(userId, { ...details, avatarPath });
      } catch (error) {
        // Don't leave a public photo behind that no profile points at.
        if (photo && avatarPath) await removeAvatars([avatarPath]).catch(() => {});
        throw error;
      }
      if (currentAvatarPath && currentAvatarPath !== avatarPath) {
        await removeAvatars([currentAvatarPath]).catch(() => {});
      }
      return fetchProfile(userId);
    },
    onSuccess: (profile) => {
      setProfile(profile);
      // Names and photos show in the people lists.
      queryClient.invalidateQueries({ queryKey: memberKeys.all });
    },
  });
}
