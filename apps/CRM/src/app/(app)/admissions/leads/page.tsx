"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, Kanban, CheckCircle2 } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useAdmissionsLeads,
  type AdmissionLeadRow,
} from "@/hooks/use-admissions";

function formatDate(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function parentName(c: AdmissionLeadRow["contact"]) {
  if (!c) return "—";
  return [c.lastName, c.firstName].filter(Boolean).join(" ") || "—";
}

export default function AdmissionLeadsPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const { data, isLoading } = useAdmissionsLeads(q ? { q } : undefined);
  const rows = data?.data ?? [];

  return (
    <PageShell
      title="Lead tuyển sinh"
      description="Hồ sơ phụ huynh / học viên tiềm năng"
      actions={
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admissions">
              <Kanban className="w-4 h-4" />
              Phễu
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/admissions/leads/new">
              <Plus className="w-4 h-4" />
              Thêm lead
            </Link>
          </Button>
        </div>
      }
    >
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--crm-text-muted)]" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm theo tên / SĐT..."
          className="pl-9 bg-[var(--crm-bg-input)] border-[var(--crm-border)] text-[var(--crm-text-primary)]"
        />
      </div>

      <div className="glass-card-static overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--crm-border)] hover:bg-transparent">
              <TableHead className="text-[var(--crm-text-secondary)]">
                Phụ huynh
              </TableHead>
              <TableHead className="text-[var(--crm-text-secondary)]">
                Con
              </TableHead>
              <TableHead className="text-[var(--crm-text-secondary)]">
                Học thử
              </TableHead>
              <TableHead className="text-[var(--crm-text-secondary)]">
                Giai đoạn
              </TableHead>
              <TableHead className="text-[var(--crm-text-secondary)]">
                Phụ trách
              </TableHead>
              <TableHead className="text-[var(--crm-text-secondary)]">
                Tạo lúc
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i} className="border-[var(--crm-border)]">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-[var(--crm-text-muted)] py-10"
                >
                  Chưa có lead tuyển sinh nào.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow
                  key={r.id}
                  className="border-[var(--crm-border)] cursor-pointer"
                  onClick={() => router.push(`/admissions/leads/${r.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="text-sm font-medium text-[var(--crm-text-primary)]">
                          {parentName(r.contact)}
                        </p>
                        <p className="text-xs text-[var(--crm-text-muted)]">
                          {r.contact?.phone || "—"}
                        </p>
                      </div>
                      {r.clbStudentId && (
                        <span title="Đã chuyển đổi sang học viên">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-[var(--crm-text-primary)]">
                    {r.child?.fullName || "—"}
                    {r.childAge ? (
                      <span className="text-xs text-[var(--crm-text-muted)]">
                        {" "}
                        · {r.childAge} tuổi
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm text-[var(--crm-text-secondary)]">
                    {formatDate(r.trialDate)}
                  </TableCell>
                  <TableCell>
                    {r.stage && (
                      <Badge
                        className="text-xs"
                        style={{
                          backgroundColor: `${r.stage.color}20`,
                          color: r.stage.color,
                          borderColor: `${r.stage.color}40`,
                        }}
                      >
                        {r.stage.name}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-[var(--crm-text-secondary)]">
                    {r.owner?.name || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-[var(--crm-text-muted)]">
                    {formatDate(r.createdAt)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </PageShell>
  );
}
