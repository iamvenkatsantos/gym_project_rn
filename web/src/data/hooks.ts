import { useQuery } from '@tanstack/react-query';

import {
  attendanceReport,
  listDayAttendance,
  listMemberships,
  listPayments,
  listPeople,
} from './api';
import type { ReportPeriod } from './types';

export const usePeople = (gymId: string) =>
  useQuery({ queryKey: ['people', gymId], queryFn: () => listPeople(gymId) });

export const useMemberships = (gymId: string) =>
  useQuery({ queryKey: ['memberships', gymId], queryFn: () => listMemberships(gymId) });

export const usePayments = (gymId: string, period: ReportPeriod) =>
  useQuery({
    queryKey: ['payments', gymId, period.from, period.to],
    queryFn: () => listPayments(gymId, period),
  });

export const useDayAttendance = (gymId: string, daysAgo: number) =>
  useQuery({
    queryKey: ['attendance-day', gymId, daysAgo],
    queryFn: () => listDayAttendance(gymId, daysAgo),
    // Today's list changes as people check in at the desk.
    refetchInterval: daysAgo === 0 ? 60_000 : false,
  });

export const useAttendanceReport = (gymId: string, days: number) =>
  useQuery({
    queryKey: ['attendance-report', gymId, days],
    queryFn: () => attendanceReport(gymId, days),
  });
