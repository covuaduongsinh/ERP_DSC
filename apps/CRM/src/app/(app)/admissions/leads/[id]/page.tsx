"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Phone,
  Mail,
  Calendar,
  MapPin,
  GraduationCap,
  CheckCircle2,
  ChevronDown,
  Check,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDeal, useUpdateDeal } from "@/hooks/use-deals";
import { useActivities } from "@/hooks/use-activities";
import { useAdmissionsPipeline } from "@/hooks/use-admissions";
import { StudentSummaryPanel } from "@/components/admissions/StudentSummaryPanel";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

function fmtDate(v: any) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function AdmissionLeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const id = params.id as string;

  const { data: deal, isLoading } = useDeal(id);
  const { data: activitiesData } = useActivities({ dealId: id, limit: 20 });
  const { data: pipelineData } = useAdmissionsPipeline();
  const updateDeal = useUpdateDeal();

  const stages = pipelineData?.stages ?? [];
  const wonStage = stages.find((s) => s.isWon);

  const invalidateAdmissions = () => {
    qc.invalidateQueries({ queryKey: ["deals", id] });
    qc.invalidateQueries({ queryKey: ["admissions-pipeline"] });
    qc.invalidateQueries({ queryKey: ["admissions-leads"] });
    qc.invalidateQueries({ queryKey: ["admissions-students"] });
  };

  const handleChangeStage = (stageId: string) => {
    updateDeal.mutate({ id, stageId } as any, {
      onSuccess: () => {
        invalidateAdmissions();
        toast({ title: "Đã chuyển giai đoạn" });
      },
      onError: (err) =>
        toast({
          title: "Lỗi",
          description: err.message,
          variant: "destructive",
        }),
    });
  };

  const handleConvert = () => {
    if (!wonStage) {
      toast({
        title: 'Chưa cấu hình giai đoạn "Đã chốt"',
        variant: "destructive",
      });
      return;
    }
    updateDeal.mutate({ id, stageId: wonStage.id } as any, {
      onSuccess: () => {
        invalidateAdmissions();
        toast({
          title: "Đã chốt lead",
          description: "Đang bàn giao sang CLB tạo Phụ huynh + Học viên…",
        });
      },
      onError: (err) =>
        toast({
          title: "Lỗi",
          description: err.message,
          variant: "destructive",
        }),
    });
  };

  if (isLoading) {
    return (
      <PageShell title="">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 space-y-3">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
      </PageShell>
    );
  }

  if (!deal) {
    return (
      <PageShell title="Không tìm thấy lead">
        <Card className="bg-[var(--crm-bg-card)] border-[var(--crm-border)]">
          <CardContent className="p-8 text-center space-y-3">
            <p className="text-sm text-[var(--crm-text-secondary)]">
              Lead không tồn tại hoặc đã bị xóa.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/admissions/leads")}
            >
              Về danh sách lead
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const d: any = deal;
  const primaryDc =
    d.contacts?.find((c: any) => c.isPrimary) ?? d.contacts?.[0];
  const contact = primaryDc?.contact ?? null;
  const child = contact?.children?.[0] ?? null;
  const converted = Boolean(d.clbStudentId);
  const activities = activitiesData?.data ?? [];

  return (
    <PageShell
      title={d.title}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/admissions/leads")}
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        {d.stage && (
          <Badge
            className="text-xs"
            style={{
              backgroundColor: `${d.stage.color}20`,
              color: d.stage.color,
              borderColor: `${d.stage.color}40`,
            }}
          >
            {d.stage.name}
          </Badge>
        )}
        {converted && (
          <span className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
            <CheckCircle2 className="w-3 h-3" />
            Đã chuyển đổi thành học viên
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-4">
        {/* Left */}
        <div className="lg:col-span-2 space-y-3">
          <Card className="bg-[var(--crm-bg-card)] border-[var(--crm-border)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-[var(--crm-text-secondary)]">
                Thông tin lead
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Info
                  icon={<GraduationCap className="w-3.5 h-3.5" />}
                  label="Con"
                  value={child?.fullName || "—"}
                />
                <Info label="Tuổi con" value={d.childAge || "—"} />
                <Info
                  icon={<Calendar className="w-3.5 h-3.5" />}
                  label="Ngày học thử"
                  value={fmtDate(d.trialDate)}
                />
                <Info
                  icon={<MapPin className="w-3.5 h-3.5" />}
                  label="Cơ sở quan tâm"
                  value={d.interestedLocationId || "—"}
                />
                <Info label="Lớp quan tâm" value={d.interestedClassId || "—"} />
                <Info label="Chuyển đổi lúc" value={fmtDate(d.convertedAt)} />
              </div>
              {d.notes && (
                <>
                  <Separator className="bg-[var(--crm-border)]" />
                  <div>
                    <p className="text-xs text-[var(--crm-text-muted)] mb-1">
                      Ghi chú
                    </p>
                    <p className="text-sm text-[var(--crm-text-primary)] whitespace-pre-wrap">
                      {d.notes}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Phụ huynh */}
          {contact && (
            <Card className="bg-[var(--crm-bg-card)] border-[var(--crm-border)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-[var(--crm-text-secondary)]">
                  Phụ huynh
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/contacts/${contact.id}`}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-white/[0.02] transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--crm-text-primary)]">
                      {[contact.lastName, contact.firstName]
                        .filter(Boolean)
                        .join(" ")}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-[var(--crm-text-muted)]">
                      {contact.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {contact.phone}
                        </span>
                      )}
                      {contact.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {contact.email}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* 360° học viên khi đã chuyển đổi */}
          {converted && <StudentSummaryPanel clbStudentId={d.clbStudentId} />}

          {/* Hoạt động */}
          <Card className="bg-[var(--crm-bg-card)] border-[var(--crm-border)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-[var(--crm-text-secondary)]">
                Hoạt động
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <p className="text-sm text-[var(--crm-text-muted)] py-4 text-center">
                  Chưa có hoạt động nào.
                </p>
              ) : (
                <div className="space-y-3">
                  {activities.map((a: any) => (
                    <div key={a.id} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--crm-text-muted)] mt-2" />
                      <div>
                        <p className="text-sm text-[var(--crm-text-primary)]">
                          {a.subject || a.type}
                        </p>
                        {a.description && (
                          <p className="text-xs text-[var(--crm-text-secondary)]">
                            {a.description}
                          </p>
                        )}
                        <p className="text-xs text-[var(--crm-text-muted)] mt-0.5">
                          {new Date(a.createdAt).toLocaleString("vi-VN")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right */}
        <div className="space-y-3">
          <Card className="bg-[var(--crm-bg-card)] border-[var(--crm-border)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-[var(--crm-text-secondary)]">
                Hành động
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {converted ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                >
                  <Link href="/admissions/students">
                    <GraduationCap className="w-4 h-4" />
                    Xem hồ sơ học viên
                  </Link>
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={handleConvert}
                  disabled={updateDeal.isPending}
                >
                  {updateDeal.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Chốt &amp; bàn giao CLB
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start text-[var(--crm-text-primary)]"
                onClick={() => router.push(`/activities/new?dealId=${id}`)}
              >
                <MessageSquare className="w-4 h-4" />
                Ghi hoạt động
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between text-[var(--crm-text-primary)]"
                  >
                    <span>Chuyển giai đoạn</span>
                    <ChevronDown className="w-3.5 h-3.5 text-[var(--crm-text-muted)]" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 bg-[var(--crm-bg-hover)] border-[var(--crm-border)]"
                >
                  {stages.map((stage) => (
                    <DropdownMenuItem
                      key={stage.id}
                      className="flex items-center gap-2 text-[var(--crm-text-primary)] focus:bg-[var(--crm-bg-subtle)] focus:text-[var(--crm-text-primary)]"
                      onClick={() => handleChangeStage(stage.id)}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: stage.color }}
                      />
                      {stage.name}
                      {d.stage?.id === stage.id && (
                        <Check className="w-3.5 h-3.5 ml-auto text-emerald-400" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </CardContent>
          </Card>

          {d.owner && (
            <Card className="bg-[var(--crm-bg-card)] border-[var(--crm-border)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-[var(--crm-text-secondary)]">
                  Người phụ trách
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium text-[var(--crm-text-primary)]">
                  {d.owner.name}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function Info({
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
