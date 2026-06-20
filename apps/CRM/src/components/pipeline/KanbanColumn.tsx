"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { formatShortCurrency } from "@/lib/constants";
import { DealCard } from "./DealCard";
import type { StageWithDeals } from "@/types";

interface KanbanColumnProps {
  stage: StageWithDeals;
  basePath?: string;
  showValue?: boolean;
}

export function KanbanColumn({
  stage,
  basePath = "/pipeline",
  showValue = true,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
    data: { type: "stage", stage },
  });

  const totalValue = stage.deals.reduce((sum, d) => sum + Number(d.value), 0);
  const dealIds = stage.deals.map((d) => d.id);

  const isWon = stage.isWon;
  const isLost = stage.isLost;

  return (
    <div
      className={cn(
        "kanban-column flex flex-col",
        isOver && "border-[var(--crm-accent-ring)] bg-[var(--crm-accent-bg)]",
      )}
    >
      {/* Column header */}
      <div className="px-3 py-3 border-b border-[var(--crm-border)]">
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: stage.color }}
          />
          <h3 className="text-sm font-semibold text-[var(--crm-text-primary)] truncate">
            {stage.name}
          </h3>
          <span className="ml-auto text-[10px] font-semibold bg-[var(--crm-bg-subtle)] px-2 py-0.5 rounded-md text-[var(--crm-text-muted)]">
            {stage.deals.length}
          </span>
        </div>
        {showValue && (
          <p className="text-xs text-[var(--crm-text-muted)]">
            {formatShortCurrency(totalValue)}
          </p>
        )}
      </div>

      {/* Droppable deal area */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 p-2 space-y-2 overflow-y-auto min-h-[120px]",
          isWon && "bg-emerald-500/[0.02]",
          isLost && "bg-red-500/[0.02]",
        )}
      >
        <SortableContext items={dealIds} strategy={verticalListSortingStrategy}>
          {stage.deals.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-xs text-[var(--crm-text-muted)] border border-dashed border-[var(--crm-border)] rounded-lg">
              Kéo deal vào đây
            </div>
          ) : (
            stage.deals.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                basePath={basePath}
                showValue={showValue}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}
