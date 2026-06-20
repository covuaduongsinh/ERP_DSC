"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { KanbanColumn } from "./KanbanColumn";
import { DealCard } from "./DealCard";
import type { StageWithDeals, DealWithRelations } from "@/types";

interface KanbanBoardProps {
  stages: StageWithDeals[];
  onMoveDeal: (dealId: string, newStageId: string) => void;
  /** Tiền tố link chi tiết deal (mặc định /pipeline). */
  basePath?: string;
  /** Hiển thị giá trị tiền trên thẻ/cột (tắt cho phễu tuyển sinh). */
  showValue?: boolean;
}

export function KanbanBoard({
  stages,
  onMoveDeal,
  basePath = "/pipeline",
  showValue = true,
}: KanbanBoardProps) {
  const [activeDeal, setActiveDeal] = useState<DealWithRelations | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const deal = active.data.current?.deal as DealWithRelations | undefined;
    if (deal) setActiveDeal(deal);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDeal(null);

      if (!over) return;

      const dealId = active.id as string;

      // Determine the target stage ID
      let targetStageId: string | null = null;

      if (over.data.current?.type === "stage") {
        targetStageId = over.id as string;
      } else if (over.data.current?.type === "deal") {
        // Dropped onto another deal; find which stage that deal belongs to
        const targetDeal = over.data.current.deal as DealWithRelations;
        targetStageId = targetDeal.stageId;
      }

      if (!targetStageId) return;

      // Find current stage of the deal
      const currentDeal = stages
        .flatMap((s) => s.deals)
        .find((d) => d.id === dealId);

      if (!currentDeal || currentDeal.stageId === targetStageId) return;

      onMoveDeal(dealId, targetStageId);
    },
    [stages, onMoveDeal],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-4 min-w-max">
          {stages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              basePath={basePath}
              showValue={showValue}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <DragOverlay>
        {activeDeal ? (
          <div className="w-[264px] rotate-2 opacity-90">
            <DealCard
              deal={activeDeal}
              basePath={basePath}
              showValue={showValue}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
