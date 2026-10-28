import { useMutation, useQueryClient } from '@tanstack/react-query';

import { fetchProfile } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/auth-store';
import { uploadPhoto } from '@/features/body/api';
import { bodyKeys } from '@/features/body/hooks';
import type { PhotoPose } from '@/features/body/types';
import { toIsoDate } from '@/features/memberships/rules';
import { completeOnboarding } from '@/features/onboarding/api';
import type { OnboardingInput } from '@/features/onboarding/types';

/**
 * Uploads the starting photos one at a time, saves the details, then reloads the
 * profile so the app opens. A photo that uploaded stays uploaded if a later step
 * fails, so trying again only sends what's left.
 */
export function useCompleteOnboarding(gymId: string, memberId: string) {
  const queryClient = useQueryClient();
  const setProfile = useAuthStore((s) => s.setProfile);
  return useMutation({
    mutationFn: async ({ photos, ...details }: OnboardingInput) => {
      const takenOn = toIsoDate(new Date());
      for (const [pose, photo] of Object.entries(photos) as [
        PhotoPose,
        OnboardingInput['photos'][PhotoPose],
      ][]) {
        if (!photo) continue;
        await uploadPhoto(gymId, memberId, { ...photo, pose, takenOn });
        await queryClient.invalidateQueries({ queryKey: bodyKeys.photos(gymId, memberId) });
      }
      await completeOnboarding(gymId, memberId, details);
      return fetchProfile(memberId);
    },
    onSuccess: (profile) => {
      queryClient.invalidateQueries({ queryKey: bodyKeys.all });
      setProfile(profile);
    },
  });
}
