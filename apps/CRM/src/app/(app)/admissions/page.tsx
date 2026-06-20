"use client";

import { useCallback } from "react";
import Link from "next/link";
import { Plus, BarChart3, List } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanBoard } from "@/components/pipeline/KanbanBoard";
import { useAdmissionsPipeline } from "@/hooks/use-admissions";
import { useMoveDeal } from "@/hooks/use-deals";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";

export default function AdmissionsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data, isLoading, error } = useAdmissionsPipeline();
  const moveDeal = useMoveDeal();

  const handleMoveDeal = useCallback(
    (dealId: string, newStageId: string) => {
      moveDeal.mutate(
        { id: dealId, stageId: newStageId },
        {
          onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["admissions-pipeline"] });
            qc.invalidateQueries({ queryKey: ["admissions-leads"] });
          },
          onError: (err) => {
            toast({
              title: "Lỗi",
              description: err.message || "Không thể di chuyển lead",
              variant: "destructive",
            });
          },
        },
      );
    },
    [moveDeal, qc],
  );

  const stages = data?.stages ?? [];

  return (
    <PageShell
      title={t("nav.admissions.funnel")}
      description="Phễu chăm sóc lead tuyển sinh đào tạo cờ vua"
      actions={
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admissions/leads">
              <List className="w-4 h-4" />
              {t("nav.admissions.leads")}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admissions/analytics">
              <BarChart3 className="w-4 h-4" />
              {t("nav.admissions.analytics")}
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
      {isLoading ? (
        <FunnelSkeleton />
      ) : error ? (
        <div className="glass-card-static">
          <div className="p-8 text-center">
            <p className="text-sm text-red-400">
              Không thể tải phễu tuyển sinh. Vui lòng thử lại.
            </p>
          </div>
        </div>
      ) : stages.length === 0 ? (
        <div className="glass-card-static">
          <div className="p-8 text-center space-y-3">
            <p className="text-sm text-[var(--crm-text-secondary)]">
              Chưa có lead tuyển sinh nào. Bắt đầu bằng cách thêm lead mới.
            </p>
            <Button asChild size="sm">
              <Link href="/admissions/leads/new">Thêm lead</Link>
            </Button>
          </div>
        </div>
      ) : (
        <KanbanBoard
          stages={stages}
          onMoveDeal={handleMoveDeal}
          basePath="/admissions/leads"
          showValue={false}
        />
      )}
    </PageShell>
  );
}

function FunnelSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="kanban-column flex flex-col">
          <div className="px-3 py-3 border-b border-[var(--crm-border-subtle)] space-y-2">
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="p-2 space-y-2">
            {Array.from({ length: 3 - (i % 2) }).map((_, j) => (
              <div key={j} className="deal-card space-y-2">
                <Skeleton className="h-4 w-full" />
                <div className="flex items-center justify-between pt-1">
                  <Skeleton className="h-3 w-12" />
                  <Skeleton className="h-6 w-6 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
