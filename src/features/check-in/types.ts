/** What a scan did: checked in, checked out, or nothing (a double scan right after checking in). */
export type ScanAction = 'in' | 'out' | 'already_in';

export type ScanResult = {
  action: ScanAction;
  gymName: string;
  checkedInAt: string;
  checkedOutAt: string | null;
};

/** What a branch QR carries: corefit://check-in?gym=<gymId>&code=<code>. */
export type CheckInLink = { gymId: string; code: string };

/** The branch's check-in rules, readable by everyone at the branch. */
export type CheckInRules = {
  /** The Home button is hidden; people have to scan. */
  qrOnly: boolean;
  memberAutoOutHours: number;
  trainerAutoOutHours: number;
};

/** Owners and supervisors: the branch's QR codes and settings. */
export type CheckInQr = CheckInRules & {
  gymName: string;
  /** The fixed code printed on the poster. */
  posterCode: string;
  posterEnabled: boolean;
  /** Opens the live front-desk display, signed out. */
  displayKey: string;
};

/** The live code the front-desk display shows until refreshAt. */
export type DisplayCode = { gymId: string; gymName: string; code: string; refreshAt: string };
