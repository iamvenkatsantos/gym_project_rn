import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';

import type {
  BodyMeasurement,
  MeasurementInput,
  PhotoUpload,
  ProgressPhoto,
} from '@/features/body/types';
import { delay, forGym, mockId, mockMeasurements, mockPhotos } from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

const BUCKET = 'progress-photos';
/** Signed photo links last an hour; the query refetches well before that. */
const SIGNED_URL_SECONDS = 60 * 60;

type MeasurementRow = {
  id: string;
  measured_on: string;
  weight_kg: number | null;
  height_cm: number | null;
  body_fat_pct: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  note: string | null;
};

const MEASUREMENT_COLUMNS =
  'id, measured_on, weight_kg, height_cm, body_fat_pct, chest_cm, waist_cm, hips_cm, arm_cm, thigh_cm, note';

// Postgres numerics arrive as strings or numbers depending on size; normalise them.
const num = (value: number | string | null) => (value === null ? null : Number(value));

function toMeasurement(row: MeasurementRow): BodyMeasurement {
  return {
    id: row.id,
    measuredOn: row.measured_on,
    weightKg: num(row.weight_kg),
    heightCm: num(row.height_cm),
    bodyFatPct: num(row.body_fat_pct),
    chestCm: num(row.chest_cm),
    waistCm: num(row.waist_cm),
    hipsCm: num(row.hips_cm),
    armCm: num(row.arm_cm),
    thighCm: num(row.thigh_cm),
    note: row.note,
  };
}

/**
 * A member's measurements at this gym, newest first. The member, and whoever may see their
 * workouts (can_view_workout_logs), can read them.
 */
export async function listMeasurements(
  gymId: string,
  memberId: string,
): Promise<BodyMeasurement[]> {
  if (!supabase) {
    return delay(
      forGym(gymId, mockMeasurements[memberId] ?? []).sort((a, b) =>
        b.measuredOn.localeCompare(a.measuredOn),
      ),
    );
  }
  const rows = unwrap(
    await supabase
      .from('body_measurements')
      .select(MEASUREMENT_COLUMNS)
      .eq('gym_id', gymId)
      .eq('member_id', memberId)
      .order('measured_on', { ascending: false })
      .limit(366),
  ) as unknown as MeasurementRow[];
  return rows.map(toMeasurement);
}

/** Saves the day's measurements, replacing anything already logged that day. */
export async function saveMeasurement(gymId: string, memberId: string, input: MeasurementInput) {
  if (!supabase) {
    const list = (mockMeasurements[memberId] ??= []);
    const existing = list.findIndex((m) => m.measuredOn === input.measuredOn);
    const entry = { ...input, id: existing >= 0 ? list[existing].id : mockId('bm') };
    if (existing >= 0) list[existing] = entry;
    else list.push(entry);
    return delay(undefined);
  }
  const { error } = await supabase.from('body_measurements').upsert(
    {
      gym_id: gymId,
      member_id: memberId,
      measured_on: input.measuredOn,
      weight_kg: input.weightKg,
      height_cm: input.heightCm,
      body_fat_pct: input.bodyFatPct,
      chest_cm: input.chestCm,
      waist_cm: input.waistCm,
      hips_cm: input.hipsCm,
      arm_cm: input.armCm,
      thigh_cm: input.thighCm,
      note: input.note,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'gym_id,member_id,measured_on' },
  );
  if (error) throw error;
}

export async function deleteMeasurement(memberId: string, id: string) {
  if (!supabase) {
    mockMeasurements[memberId] = (mockMeasurements[memberId] ?? []).filter((m) => m.id !== id);
    return delay(undefined);
  }
  const { error } = await supabase.from('body_measurements').delete().eq('id', id);
  if (error) throw error;
}

type PhotoRow = { id: string; pose: ProgressPhoto['pose']; taken_on: string; storage_path: string };

/** A member's progress photos, newest first, with signed links to the private files. */
export async function listPhotos(gymId: string, memberId: string): Promise<ProgressPhoto[]> {
  if (!supabase) {
    return delay(
      forGym(gymId, mockPhotos[memberId] ?? []).sort((a, b) => b.takenOn.localeCompare(a.takenOn)),
    );
  }
  const rows = unwrap(
    await supabase
      .from('progress_photos')
      .select('id, pose, taken_on, storage_path')
      .eq('gym_id', gymId)
      .eq('member_id', memberId)
      .order('taken_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(120),
  ) as PhotoRow[];
  if (rows.length === 0) return [];

  const { data: signed, error } = await supabase.storage.from(BUCKET).createSignedUrls(
    rows.map((r) => r.storage_path),
    SIGNED_URL_SECONDS,
  );
  if (error) throw error;
  const urls = new Map(signed.map((s) => [s.path, s.error ? null : s.signedUrl]));

  return rows.map((r) => ({
    id: r.id,
    pose: r.pose,
    takenOn: r.taken_on,
    storagePath: r.storage_path,
    url: urls.get(r.storage_path) ?? null,
  }));
}

function extensionFor(mimeType: string) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/heic') return 'heic';
  return 'jpg';
}

/**
 * Uploads the file to <gym>/<member>/<id>.<ext> in the private bucket, then records it.
 * If recording fails the file is removed again so nothing is left orphaned.
 */
export async function uploadPhoto(gymId: string, memberId: string, upload: PhotoUpload) {
  if (!supabase) {
    (mockPhotos[memberId] ??= []).push({
      id: mockId('photo'),
      pose: upload.pose,
      takenOn: upload.takenOn,
      storagePath: upload.uri,
      url: upload.uri,
    });
    return delay(undefined);
  }
  const id = randomUUID();
  const path = `${gymId}/${memberId}/${id}.${extensionFor(upload.mimeType)}`;
  const bytes = await new File(upload.uri).arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: upload.mimeType, upsert: false });
  if (uploadError) throw uploadError;

  const { error } = await supabase.from('progress_photos').insert({
    id,
    gym_id: gymId,
    member_id: memberId,
    storage_path: path,
    pose: upload.pose,
    taken_on: upload.takenOn,
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
}

export async function deletePhoto(memberId: string, photo: ProgressPhoto) {
  if (!supabase) {
    mockPhotos[memberId] = (mockPhotos[memberId] ?? []).filter((p) => p.id !== photo.id);
    return delay(undefined);
  }
  const { error } = await supabase.from('progress_photos').delete().eq('id', photo.id);
  if (error) throw error;
  // The record is gone, so a leftover file is unreachable; removing it is best effort.
  await supabase.storage.from(BUCKET).remove([photo.storagePath]);
}
