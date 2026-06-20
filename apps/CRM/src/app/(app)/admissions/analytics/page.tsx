"use client";

import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { PageShell } from "@/components/layout/PageShell";
import { Skeleton } from "@/components/ui/skeleton";
import { DateRangeSelector } from "@/components/analytics/DateRangeSelector";
import { useAdmissionsAnalytics } from "@/hooks/use-admissions";
import type { DateRange } from "@/hooks/use-analytics";

function getDefaultRange(): DateRange {
  const now = new Date();
  return {
    from: new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 90,
    ).toISOString(),
    to: now.toISOString(),
  };
}

function stageColor(f: { isWon: boolean; isLost: boolean; order: number }) {
  if (f.isWon) return "#10B981";
  if (f.isLost) return "#EF4444";
  return ["#6B7280", "#3B82F6", "#8B5CF6", "#F59E0B"][f.order % 4];
}

export default function AdmissionsAnalyticsPage() {
  const [range, setRange] = useState<DateRange>(getDefaultRange);
  const { data, isLoading } = useAdmissionsAnalytics(range);

  const funnelData = useMemo(
    () =>
      (data?.funnel ?? []).map((f) => ({
        stage: f.stage,
        count: f.count,
        color: stageColor(f),
      })),
    [data],
  );

  const totals = data?.totals;

  return (
    <PageShell
      title="Phân tích tuyển sinh"
      description="Phễu chuyển đổi lead → học viên"
      actions={<DateRangeSelector value={range} onChange={setRange} />}
    >
      {isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : (
        <div className="space-y-4">
          {/* KPI */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Kpi label="Tổng lead" value={totals?.total ?? 0} />
            <Kpi label="Đã chốt" value={totals?.won ?? 0} color="#10B981" />
            <Kpi
              label="Không phù hợp"
              value={totals?.lost ?? 0}
              color="#EF4444"
            />
            <Kpi
              label="Đã chuyển đổi"
              value={totals?.converted ?? 0}
              color="#3B82F6"
            />
            <Kpi
              label="Tỉ lệ chốt"
              value={`${totals?.conversionRate ?? 0}%`}
              color="#8B5CF6"
            />
          </div>

          {/* Funnel */}
          <div className="chart-container">
            <h3 className="text-sm font-medium text-[var(--crm-text-primary)] mb-4">
              Phễu theo giai đoạn
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={funnelData}
                  layout="vertical"
                  margin={{ left: 20, right: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--crm-border-subtle)"
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fill: "var(--crm-text-muted)", fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="stage"
                    width={140}
                    tick={{ fill: "var(--crm-text-secondary)", fontSize: 11 }}
                  />
                  <Tooltip
                    content={({ active, payload, label }: any) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-[var(--crm-bg-hover)] border border-[var(--crm-border)] rounded-md px-3 py-2 shadow-lg">
                          <p className="text-xs text-[var(--crm-text-secondary)] mb-1">
                            {label}
                          </p>
                          <p className="text-xs text-[var(--crm-text-primary)]">
                            Số lead: {payload[0].value}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {funnelData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function Kpi({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="kpi-card">
      <p className="text-xs text-[var(--crm-text-muted)]">{label}</p>
      <p
        className="text-2xl font-bold mt-1"
        style={{ color: color || "var(--crm-text-primary)" }}
      >
        {value}
      </p>
    </div>
  );
}
