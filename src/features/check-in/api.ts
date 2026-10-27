import type { AttendeeRole } from '@/features/attendance/types';
import type {
  CheckInQr,
  CheckInRules,
  DisplayCode,
  ScanAction,
  ScanResult,
} from '@/features/check-in/types';
import { delay, MOCK_GYM_ID, mockAttendance, mockDay } from '@/lib/mock-db';
import { supabase, unwrap } from '@/lib/supabase';

/** Demo mode's branch: a fixed poster code and a live code that changes every 30 seconds. */
const mockQr: CheckInQr = {
  gymName: 'Pulse Fitness Anna Nagar',
  posterCode: 'demo-poster',
  posterEnabled: true,
  displayKey: 'demo-display',
  qrOnly: false,
  memberAutoOutHours: 3,
  trainerAutoOutHours: 12,
};

function mockWindow() {
  return Math.floor(Date.now() / 30000);
}

type ScanRow = {
  action: ScanAction;
  gym_name: string;
  checked_in_at: string;
  checked_out_at: string | null;
};

/**
 * Checks in with a scanned branch code, or out if already in. The server checks
 * the code, that the caller belongs to that branch, and ignores a double scan.
 */
export async function scanCheckIn(
  gymId: string,
  code: string,
  user: { id: string; role: AttendeeRole },
): Promise<ScanResult> {
  if (!supabase) {
    const live = new Set([0, 1, 2].map((n) => `${mockWindow() - n}.demo`));
    if (gymId !== MOCK_GYM_ID) throw new Error('You aren’t a member of this gym');
    if (code !== mockQr.posterCode && !live.has(code)) {
      throw new Error('This QR has expired. Scan the code at the front desk again.');
    }
    const now = new Date().toISOString();
    let today = mockAttendance.find((a) => a.userId === user.id && a.day === mockDay());
    let action: ScanAction;
    if (!today || today.checkedOutAt) {
      if (today) today.checkedOutAt = null;
      else {
        today = {
          userId: user.id,
          day: mockDay(),
          role: user.role,
          checkedInAt: now,
          checkedOutAt: null,
          workouts: 0,
        };
        mockAttendance.push(today);
      }
      action = 'in';
    } else if (Date.now() - Date.parse(today.checkedInAt) < 5 * 60000) {
      action = 'already_in';
    } else {
      today.checkedOutAt = now;
      action = 'out';
    }
    return delay({
      action,
      gymName: mockQr.gymName,
      checkedInAt: today.checkedInAt,
      checkedOutAt: today.checkedOutAt,
    });
  }
  const rows = unwrap(
    await supabase.rpc('scan_check_in', { p_gym_id: gymId, p_code: code }),
  ) as ScanRow[];
  const row = rows[0];
  return {
    action: row.action,
    gymName: row.gym_name,
    checkedInAt: row.checked_in_at,
    checkedOutAt: row.checked_out_at,
  };
}

type RulesRow = {
  qr_check_in_only: boolean;
  member_auto_out_hours: number;
  trainer_auto_out_hours: number;
};

export async function getCheckInRules(gymId: string): Promise<CheckInRules> {
  if (!supabase) {
    const { qrOnly, memberAutoOutHours, trainerAutoOutHours } = mockQr;
    return delay({ qrOnly, memberAutoOutHours, trainerAutoOutHours });
  }
  const row = unwrap(
    await supabase
      .from('gyms')
      .select('qr_check_in_only, member_auto_out_hours, trainer_auto_out_hours')
      .eq('id', gymId)
      .single(),
  ) as RulesRow;
  return {
    qrOnly: row.qr_check_in_only,
    memberAutoOutHours: row.member_auto_out_hours,
    trainerAutoOutHours: row.trainer_auto_out_hours,
  };
}

type QrRow = {
  gym_name: string;
  poster_code: string;
  poster_enabled: boolean;
  display_key: string;
  qr_only: boolean;
  member_auto_out_hours: number;
  trainer_auto_out_hours: number;
};

/** Owners and supervisors only. */
export async function getCheckInQr(gymId: string): Promise<CheckInQr> {
  if (!supabase) return delay(mockQr);
  const rows = unwrap(await supabase.rpc('check_in_qr', { p_gym_id: gymId })) as QrRow[];
  const r = rows[0];
  return {
    gymName: r.gym_name,
    posterCode: r.poster_code,
    posterEnabled: r.poster_enabled,
    displayKey: r.display_key,
    qrOnly: r.qr_only,
    memberAutoOutHours: r.member_auto_out_hours,
    trainerAutoOutHours: r.trainer_auto_out_hours,
  };
}

type DisplayRow = { gym_id: string; gym_name: string; code: string; refresh_at: string };

/** The live code for the front-desk display. */
export async function getDisplayCode(displayKey: string): Promise<DisplayCode> {
  if (!supabase) {
    const window = mockWindow();
    return delay(
      {
        gymId: MOCK_GYM_ID,
        gymName: mockQr.gymName,
        code: `${window}.demo`,
        refreshAt: new Date((window + 1) * 30000).toISOString(),
      },
      0,
    );
  }
  const rows = unwrap(
    await supabase.rpc('check_in_display', { p_key: displayKey }),
  ) as DisplayRow[];
  const r = rows[0];
  return { gymId: r.gym_id, gymName: r.gym_name, code: r.code, refreshAt: r.refresh_at };
}

export type CheckInSettings = Pick<
  CheckInQr,
  'qrOnly' | 'posterEnabled' | 'memberAutoOutHours' | 'trainerAutoOutHours'
>;

/** Owners only. */
export async function saveCheckInSettings(gymId: string, settings: CheckInSettings) {
  if (!supabase) {
    Object.assign(mockQr, settings);
    return delay(undefined);
  }
  const { error } = await supabase.rpc('set_check_in_settings', {
    p_gym_id: gymId,
    p_qr_only: settings.qrOnly,
    p_poster_enabled: settings.posterEnabled,
    p_member_auto_out_hours: settings.memberAutoOutHours,
    p_trainer_auto_out_hours: settings.trainerAutoOutHours,
  });
  if (error) throw error;
}

export type AdminBranchQr = { gymName: string; posterCode: string; posterEnabled: boolean };

/** CoreFit Gym admins: a branch's printed QR, to send to its owner. */
export async function getAdminBranchQr(gymId: string): Promise<AdminBranchQr> {
  if (!supabase) {
    return delay({
      gymName: mockQr.gymName,
      posterCode: mockQr.posterCode,
      posterEnabled: mockQr.posterEnabled,
    });
  }
  const rows = unwrap(await supabase.rpc('admin_check_in_qr', { p_gym_id: gymId })) as {
    gym_name: string;
    poster_code: string;
    poster_enabled: boolean;
  }[];
  const r = rows[0];
  return { gymName: r.gym_name, posterCode: r.poster_code, posterEnabled: r.poster_enabled };
}

/** CoreFit Gym admins: a new printed QR for the branch, switched on. Old printouts stop working. */
export async function resetAdminBranchQr(gymId: string) {
  if (!supabase) {
    mockQr.posterCode = `demo-poster-${Date.now()}`;
    mockQr.posterEnabled = true;
    return delay(undefined);
  }
  const { error } = await supabase.rpc('admin_reset_check_in_qr', { p_gym_id: gymId });
  if (error) throw error;
}
