"use client";

import { useQuery } from "@tanstack/react-query";
import type { StageWithDeals } from "@/types";
import type { DateRange } from "@/hooks/use-analytics";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

// ── Phễu tuyển sinh (Kanban) ─────────────────────────────────────────
interface AdmissionsPipelineResponse {
  id?: string;
  name: string;
  stages: StageWithDeals[];
}

export function useAdmissionsPipeline() {
  return useQuery<AdmissionsPipelineResponse>({
    queryKey: ["admissions-pipeline"],
    queryFn: () => fetchJson("/api/admissions/pipeline"),
    staleTime: 30_000,
  });
}

// ── Danh sách Lead tuyển sinh ────────────────────────────────────────
export interface AdmissionLeadRow {
  id: string;
  title: string;
  stageId: string;
  stage: {
    id: string;
    name: string;
    color: string;
    isWon: boolean;
    isLost: boolean;
  } | null;
  childAge: string | null;
  interestedClassId: string | null;
  interestedLocationId: string | null;
  trialDate: string | null;
  clbStudentId: string | null;
  convertedAt: string | null;
  createdAt: string;
  owner: { id: string; name: string | null } | null;
  contact: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  child: { id: string; fullName: string } | null;
}

export function useAdmissionsLeads(params?: { stageId?: string; q?: string }) {
  const qs = new URLSearchParams();
  if (params?.stageId) qs.set("stageId", params.stageId);
  if (params?.q) qs.set("q", params.q);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return useQuery<{ data: AdmissionLeadRow[] }>({
    queryKey: ["admissions-leads", params],
    queryFn: () => fetchJson(`/api/admissions/leads${suffix}`),
    staleTime: 15_000,
  });
}

// ── Học viên đã chuyển đổi (360°) ────────────────────────────────────
export interface AdmissionStudentRow {
  id: string;
  fullName: string;
  level: string | null;
  clbStudentId: string;
  contact: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  } | null;
}

export function useAdmissionsStudents() {
  return useQuery<{ data: AdmissionStudentRow[] }>({
    queryKey: ["admissions-students"],
    queryFn: () => fetchJson("/api/admissions/students"),
    staleTime: 30_000,
  });
}

/** Tóm tắt 360° học viên (proxy sang CLB). Trả null khi CLB offline. */
export function useStudentSummary(clbStudentId: string | null | undefined) {
  return useQuery<{ summary: any | null }>({
    queryKey: ["student-summary", clbStudentId],
    queryFn: () =>
      fetchJson(`/api/admissions/students/${clbStudentId}/summary`),
    enabled: !!clbStudentId,
    staleTime: 60_000,
    retry: false,
  });
}

// ── Phân tích phễu tuyển sinh ────────────────────────────────────────
export interface AdmissionsAnalytics {
  pipeline: string;
  funnel: {
    stage: string;
    order: number;
    isWon: boolean;
    isLost: boolean;
    count: number;
  }[];
  totals: {
    total: number;
    won: number;
    lost: number;
    converted: number;
    conversionRate: number;
  };
  generatedAt: string;
}

export function useAdmissionsAnalytics(range?: DateRange) {
  const qs = new URLSearchParams();
  if (range?.from) qs.set("from", range.from);
  if (range?.to) qs.set("to", range.to);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return useQuery<AdmissionsAnalytics>({
    queryKey: ["admissions-analytics", range],
    queryFn: () => fetchJson(`/api/analytics/admissions${suffix}`),
    staleTime: 30_000,
  });
}
