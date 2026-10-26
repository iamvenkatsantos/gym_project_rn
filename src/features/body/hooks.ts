import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  deleteMeasurement,
  deletePhoto,
  listMeasurements,
  listPhotos,
  saveMeasurement,
  uploadPhoto,
} from '@/features/body/api';
import type { MeasurementInput, PhotoUpload, ProgressPhoto } from '@/features/body/types';

export const bodyKeys = {
  all: ['body'] as const,
  measurements: (gymId: string, memberId: string) =>
    [...bodyKeys.all, 'measurements', gymId, memberId] as const,
  photos: (gymId: string, memberId: string) =>
    [...bodyKeys.all, 'photos', gymId, memberId] as const,
};

export function useMeasurements(gymId: string, memberId: string) {
  return useQuery({
    queryKey: bodyKeys.measurements(gymId, memberId),
    queryFn: () => listMeasurements(gymId, memberId),
  });
}

export function useSaveMeasurement(gymId: string, memberId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MeasurementInput) => saveMeasurement(gymId, memberId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: bodyKeys.measurements(gymId, memberId) }),
  });
}

export function useDeleteMeasurement(gymId: string, memberId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteMeasurement(memberId, id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: bodyKeys.measurements(gymId, memberId) }),
  });
}

export function useProgressPhotos(gymId: string, memberId: string) {
  return useQuery({
    queryKey: bodyKeys.photos(gymId, memberId),
    queryFn: () => listPhotos(gymId, memberId),
    // Photo links are signed for an hour; fetch fresh ones well before they expire.
    staleTime: 30 * 60 * 1000,
    refetchInterval: 45 * 60 * 1000,
  });
}

export function useUploadPhoto(gymId: string, memberId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (upload: PhotoUpload) => uploadPhoto(gymId, memberId, upload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bodyKeys.photos(gymId, memberId) }),
  });
}

export function useDeletePhoto(gymId: string, memberId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (photo: ProgressPhoto) => deletePhoto(memberId, photo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bodyKeys.photos(gymId, memberId) }),
  });
}
