"use client";

import {
  GraduationCap,
  MapPin,
  CalendarClock,
  Wallet,
  WifiOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useStudentSummary } from "@/hooks/use-admissions";

function fmtDate(v: any) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtVnd(n: number) {
  return new Intl.NumberFormat("vi-VN").format(n) + " ₫";
}

/**
 * Panel 360° học viên — đọc bản tóm tắt từ CLB (lớp đang học, số buổi tồn, phiếu thu
 * gần nhất). Chỉ đọc; CLB là nguồn dữ liệu vận hành đào tạo. Fallback khi CLB offline.
 */
export function StudentSummaryPanel({
  clbStudentId,
}: {
  clbStudentId: string | null | undefined;
}) {
  const { data, isLoading, isError } = useStudentSummary(clbStudentId);
  const summary = data?.summary ?? null;

  return (
    <Card className="bg-[var(--crm-bg-card)] border-[var(--crm-border)]">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-[var(--crm-text-secondary)] flex items-center gap-2">
          <GraduationCap className="w-4 h-4" />
          Hồ sơ học viên (CLB)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : isError || !summary ? (
          <div className="flex items-center gap-2 text-sm text-[var(--crm-text-muted)] py-3">
            <WifiOff className="w-4 h-4" />
            Chưa lấy được dữ liệu học viên (CLB có thể tạm offline).
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat
                icon={<GraduationCap className="w-3.5 h-3.5" />}
                label="Cấp"
                value={summary.level || "—"}
              />
              <Stat
                icon={<MapPin className="w-3.5 h-3.5" />}
                label="Cơ sở"
                value={summary.location || "—"}
              />
              <Stat
                icon={<CalendarClock className="w-3.5 h-3.5" />}
                label="Số buổi tồn"
                value={String(summary.sessionBalance ?? "—")}
              />
              <Stat
                label="Trạng thái"
                value={summary.enrollmentStatus || "—"}
              />
            </div>

            {Array.isArray(summary.activeClasses) &&
              summary.activeClasses.length > 0 && (
                <div>
                  <p className="text-xs text-[var(--crm-text-muted)] mb-1.5">
                    Lớp đang học
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {summary.activeClasses.map((c: any, i: number) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="text-xs border-[var(--crm-border)] text-[var(--crm-text-secondary)]"
                      >
                        {c.title || c.id || "Lớp"}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

            {Array.isArray(summary.recentPayments) &&
              summary.recentPayments.length > 0 && (
                <div>
                  <p className="text-xs text-[var(--crm-text-muted)] mb-1.5 flex items-center gap-1">
                    <Wallet className="w-3.5 h-3.5" /> Phiếu thu gần đây
                  </p>
                  <div className="space-y-1">
                    {summary.recentPayments.map((p: any) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-[var(--crm-text-muted)]">
                          {fmtDate(p.date)}
                        </span>
                        <span className="text-[var(--crm-text-primary)]">
                          {fmtVnd(Number(p.total) || 0)}
                        </span>
                        <span className="text-xs text-[var(--crm-text-muted)]">
                          {p.sessions ? `${p.sessions} buổi` : ""}{" "}
                          {p.status || ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[var(--crm-text-muted)]">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-sm font-medium text-[var(--crm-text-primary)]">
        {value}
      </p>
    </div>
  );
}
