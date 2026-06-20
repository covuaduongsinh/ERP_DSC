"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { Calendar, Heart, Percent } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatShortCurrency } from "@/lib/constants";
import { getHealthColor } from "@/lib/analytics/health-score";
import type { DealWithRelations } from "@/types";

interface DealCardProps {
  deal: DealWithRelations;
  /** Tiền tố link chi tiết (mặc định /pipeline; tuyển sinh dùng /admissions/leads). */
  basePath?: string;
  /** Ẩn dòng giá trị tiền (deal tuyển sinh không có giá trị). */
  showValue?: boolean;
}

export function DealCard({
  deal,
  basePath = "/pipeline",
  showValue = true,
}: DealCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: deal.id,
    data: { type: "deal", deal },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const ownerInitials = deal.owner?.name
    ? deal.owner.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const expectedClose = deal.expectedCloseAt
    ? new Date(deal.expectedCloseAt).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
      })
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group"
    >
      <Link
        href={`${basePath}/${deal.id}`}
        onClick={(e) => {
          // Prevent navigation during drag
          if (isDragging) e.preventDefault();
        }}
        className="block"
      >
        <div className="deal-card space-y-2.5">
          {/* Company name */}
          {deal.company && (
            <p className="text-[11px] text-[var(--crm-text-secondary)] uppercase tracking-wide truncate">
              {deal.company.name}
            </p>
          )}

          {/* Deal title */}
          <p className="text-sm font-medium text-[var(--crm-text-primary)] leading-snug line-clamp-2">
            {deal.title}
          </p>

          {/* Value */}
          {showValue && (
            <p className="text-sm font-bold text-[var(--crm-accent-text)]">
              {formatShortCurrency(Number(deal.value))}
            </p>
          )}

          {/* Bottom row: probability, date, health, avatar */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-3">
              {deal.stage?.probability !== undefined && (
                <span className="flex items-center gap-1 text-xs text-[var(--crm-text-muted)]">
                  <Percent className="w-3 h-3" />
                  {deal.stage.probability}%
                </span>
              )}
              {expectedClose && (
                <span className="flex items-center gap-1 text-xs text-[var(--crm-text-muted)]">
                  <Calendar className="w-3 h-3" />
                  {expectedClose}
                </span>
              )}
              {(deal as any).healthScore != null && (
                <span
                  className="flex items-center gap-0.5 text-[10px] font-medium"
                  style={{ color: getHealthColor((deal as any).healthScore) }}
                  title={`Health: ${(deal as any).healthScore}`}
                >
                  <Heart className="w-2.5 h-2.5" />
                  {(deal as any).healthScore}
                </span>
              )}
            </div>
            <Avatar className="h-6 w-6">
              <AvatarImage src={deal.owner?.avatarUrl || undefined} />
              <AvatarFallback className="text-[10px] bg-[var(--crm-bg-subtle)] text-[var(--crm-text-secondary)]">
                {ownerInitials}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </Link>
    </div>
  );
}
