"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  Handshake,
  Kanban,
  Activity,
  Megaphone,
  FileText,
  ShoppingCart,
  Package,
  BarChart3,
  LifeBuoy,
  Settings,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { useUIStore } from "@/stores/ui-store";
import { usePermissions } from "@/hooks/use-permissions";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type NavItemDef = {
  href: string;
  icon: typeof LayoutDashboard;
  labelKey: string;
  requiredPermission?:
    | "canManageCampaigns"
    | "canManageSettings"
    | "canViewApiDocs";
};

const navItemDefs: NavItemDef[] = [
  { href: "/dashboard", icon: LayoutDashboard, labelKey: "nav.dashboard" },
  { href: "/contacts", icon: Users, labelKey: "nav.contacts" },
  { href: "/companies", icon: Building2, labelKey: "nav.companies" },
  { href: "/partners", icon: Handshake, labelKey: "nav.partners" },
  { href: "/pipeline", icon: Kanban, labelKey: "nav.pipeline" },
  { href: "/activities", icon: Activity, labelKey: "nav.activities" },
  {
    href: "/campaigns",
    icon: Megaphone,
    labelKey: "nav.campaigns",
    requiredPermission: "canManageCampaigns",
  },
  { href: "/products", icon: Package, labelKey: "nav.products" },
  { href: "/quotes", icon: FileText, labelKey: "nav.quotes" },
  { href: "/orders", icon: ShoppingCart, labelKey: "nav.orders" },
  { href: "/tickets", icon: LifeBuoy, labelKey: "nav.tickets" },
  { href: "/reports", icon: BarChart3, labelKey: "nav.reports" },
  {
    href: "/settings",
    icon: Settings,
    labelKey: "nav.settings",
    requiredPermission: "canManageSettings",
  },
  {
    href: "/api-docs",
    icon: BookOpen,
    labelKey: "nav.apiDocs",
    requiredPermission: "canViewApiDocs",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const {
    sidebarOpen: expanded,
    toggleSidebar,
    isMobile,
    setSidebarOpen,
  } = useUIStore();
  const { canManageCampaigns, canManageSettings, canViewApiDocs, isLoading } =
    usePermissions();
  const { t } = useTranslation();

  const permissionMap: Record<string, boolean> = {
    canManageCampaigns,
    canManageSettings,
    canViewApiDocs,
  };

  const visibleItems = navItemDefs.filter((item) => {
    if (!item.requiredPermission) return true;
    if (isLoading) return false;
    return permissionMap[item.requiredPermission];
  });

  const handleNavClick = () => {
    if (isMobile) setSidebarOpen(false);
  };

  return (
    <TooltipProvider delayDuration={0}>
      {/* Mobile backdrop */}
      {isMobile && expanded && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={cn(
          "sidebar-premium h-screen flex flex-col transition-all duration-200",
          isMobile
            ? "fixed z-50 w-[240px] transition-transform duration-200"
            : expanded
              ? "w-[240px]"
              : "w-[60px]",
          isMobile && !expanded && "-translate-x-full",
          isMobile && expanded && "translate-x-0",
        )}
      >
        {/* Header: Logo + Collapse toggle */}
        <div className="h-11 flex items-center px-3 border-b border-[var(--glass-border)] shrink-0 gap-2">
          {expanded ? (
            <>
              <span className="text-sm font-bold whitespace-nowrap flex-1 pl-1">
                <span className="text-[var(--crm-text-primary)]">
                  Cờ vua Dương Sinh{" "}
                </span>
                <span className="text-[var(--crm-accent-text)]">CRM</span>
              </span>
              <button
                onClick={toggleSidebar}
                className="p-1.5 rounded-md text-[var(--crm-text-muted)] hover:text-[var(--crm-text-secondary)] hover:bg-[var(--crm-bg-subtle)] transition-colors"
                title={t("nav.collapse")}
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="flex items-center justify-center w-full">
              <button
                onClick={toggleSidebar}
                className="p-1.5 rounded-md text-[var(--crm-text-muted)] hover:text-[var(--crm-text-secondary)] hover:bg-[var(--crm-bg-subtle)] transition-colors"
                title={t("nav.expand")}
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2 px-1.5 space-y-px overflow-y-auto">
          {expanded && <div className="section-label mt-0.5 mb-1">MENU</div>}
          {visibleItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            const isExpanded = isMobile || expanded;
            const linkContent = (
              <Link
                href={item.href}
                onClick={handleNavClick}
                className={cn(
                  "nav-item relative",
                  isExpanded ? "px-3 py-1.5" : "justify-center px-2 py-1.5",
                  isActive && "active",
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#10B981] rounded-r-full" />
                )}
                <item.icon className="w-[18px] h-[18px] shrink-0" />
                {isExpanded && <span>{t(item.labelKey)}</span>}
              </Link>
            );

            if (!isExpanded) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                  <TooltipContent
                    side="right"
                    className="bg-[var(--crm-bg-hover)] text-[var(--crm-text-primary)] border-[var(--crm-border)]"
                  >
                    {t(item.labelKey)}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.href}>{linkContent}</div>;
          })}
        </nav>
      </aside>
    </TooltipProvider>
  );
}
