"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap, Phone } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { StudentSummaryPanel } from "@/components/admissions/StudentSummaryPanel";
import {
  useAdmissionsStudents,
  type AdmissionStudentRow,
} from "@/hooks/use-admissions";

function parentName(c: AdmissionStudentRow["contact"]) {
  if (!c) return "—";
  return [c.lastName, c.firstName].filter(Boolean).join(" ") || "—";
}

export default function AdmissionStudentsPage() {
  const { data, isLoading } = useAdmissionsStudents();
  const rows = data?.data ?? [];
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!selected && rows.length > 0) setSelected(rows[0].clbStudentId);
  }, [rows, selected]);

  return (
    <PageShell
      title="Học viên (360°)"
      description="Học viên đã chuyển đổi từ tuyển sinh — dữ liệu vận hành lấy từ CLB"
    >
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <div className="glass-card-static">
          <div className="p-8 text-center">
            <p className="text-sm text-[var(--crm-text-secondary)]">
              Chưa có học viên nào được chuyển đổi. Chốt một lead ở phễu tuyển
              sinh để bàn giao sang CLB.
            </p>
            <Link
              href="/admissions"
              className="text-sm text-emerald-400 hover:text-emerald-300 mt-2 inline-block"
            >
              Mở phễu tuyển sinh →
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Danh sách */}
          <div className="glass-card-static overflow-hidden divide-y divide-[var(--crm-border)]">
            {rows.map((r) => {
              const active = r.clbStudentId === selected;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelected(r.clbStudentId)}
                  className={cn(
                    "w-full text-left px-4 py-3 transition-colors hover:bg-white/[0.02]",
                    active && "bg-[var(--crm-accent-bg)]",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-[var(--crm-text-muted)] shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--crm-text-primary)] truncate">
                        {r.fullName}
                      </p>
                      <p className="text-xs text-[var(--crm-text-muted)] truncate">
                        PH: {parentName(r.contact)}
                        {r.contact?.phone ? (
                          <span className="inline-flex items-center gap-1 ml-2">
                            <Phone className="w-3 h-3" />
                            {r.contact.phone}
                          </span>
                        ) : null}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Tóm tắt 360° */}
          <div className="lg:col-span-2">
            {selected ? (
              <StudentSummaryPanel clbStudentId={selected} />
            ) : (
              <div className="glass-card-static p-8 text-center text-sm text-[var(--crm-text-muted)]">
                Chọn một học viên để xem hồ sơ 360°.
              </div>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}
