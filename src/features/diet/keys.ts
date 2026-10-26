// Apart from hooks.ts so coaching can refresh diet plans without an import cycle.
export const dietKeys = {
  all: ['diet'] as const,
  plans: (gymId: string, coachId: string) => [...dietKeys.all, gymId, 'plans', coachId] as const,
  member: (gymId: string, memberId: string) =>
    [...dietKeys.all, gymId, 'member', memberId] as const,
};
