"use client";

import {
  Factory,
  BarChart3,
  Users,
  Megaphone,
  Table,
  Mail,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { useIntegrationHealth } from "@/hooks/use-integrations";

const ICON_MAP: Record<string, React.ElementType> = {
  Factory,
  BarChart3,
  Users,
  Megaphone,
  Table,
  Mail,
};

export function IntegrationStatus() {
  const { data, isLoading, refetch, isFetching } = useIntegrationHealth();

  if (isLoading) {
    return (
      <div className="glass-card-static p-3">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-[var(--crm-text-secondary)]">
            Hệ sinh thái Cờ vua Dương Sinh
          </h3>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-8 rounded-lg bg-[var(--glass-bg)] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  const modules = data?.modules ?? [];
  const connected = data?.connected ?? 0;
  const total = data?.total ?? 0;

  return (
    <div className="glass-card-static p-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-[var(--crm-text-secondary)]">
          Hệ sinh thái Cờ vua Dương Sinh
        </h3>
        <button
          onClick={() => refetch()}
          className="p-1.5 rounded-md text-[var(--crm-text-secondary)] hover:text-[var(--crm-text-secondary)] hover:bg-[var(--crm-bg-subtle)] transition-colors"
          title="Kiểm tra lại"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      <div className="space-y-1.5">
        {modules.map((mod) => {
          const Icon = ICON_MAP[mod.icon] || BarChart3;
          return (
            <div
              key={mod.name}
              className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-[var(--glass-bg)] transition-colors group"
            >
              <div
                className="p-1.5 rounded-md"
                style={{ backgroundColor: `${mod.color}15` }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: mod.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--crm-text-primary)]">
                    {mod.label}
                  </span>
                  <span className="text-[10px] text-[var(--crm-text-secondary)]">
                    {mod.description}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`status-dot ${mod.online ? "online" : "offline"}`}
                />
                <span className="text-[10px] text-[var(--crm-text-secondary)]">
                  {mod.online ? "Connected" : "Offline"}
                </span>
                <a
                  href={mod.baseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-[var(--crm-text-secondary)] hover:text-[var(--crm-text-secondary)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-[var(--crm-border)]">
        <p className="text-[11px] text-[var(--crm-text-secondary)]">
          {connected} / {total} modules connected
        </p>
      </div>
    </div>
  );
}
