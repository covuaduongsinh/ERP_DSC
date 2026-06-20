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
  GraduationCap,
  Store,
  Filter,
  UserPlus,
  PieChart,
  ChevronDown,
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

type Permission = "canManageCampaigns" | "canManageSettings" | "canViewApiDocs";

type NavLeaf = {
  href: string;
  icon: typeof LayoutDashboard;
  labelKey: string;
  requiredPermission?: Permission;
};

type NavGroup = {
  type: "group";
  key: string;
  icon: typeof LayoutDashboard;
  labelKey: string;
  children: NavLeaf[];
};

type NavEntry = ({ type: "item" } & NavLeaf) | NavGroup;

const navEntries: NavEntry[] = [
  {
    type: "item",
    href: "/dashboard",
    icon: LayoutDashboard,
    labelKey: "nav.dashboard",
  },
  {
    type: "group",
    key: "admissions",
    icon: GraduationCap,
    labelKey: "nav.group.admissions",
    children: [
      { href: "/admissions", icon: Filter, labelKey: "nav.admissions.funnel" },
      {
        href: "/admissions/leads",
        icon: UserPlus,
        labelKey: "nav.admissions.leads",
      },
      {
        href: "/admissions/students",
        icon: GraduationCap,
        labelKey: "nav.admissions.students",
      },
      {
        href: "/admissions/analytics",
        icon: PieChart,
        labelKey: "nav.admissions.analytics",
      },
    ],
  },
  {
    type: "group",
    key: "bookstore",
    icon: Store,
    labelKey: "nav.group.bookstore",
    children: [
      { href: "/pipeline", icon: Kanban, labelKey: "nav.pipeline" },
      { href: "/products", icon: Package, labelKey: "nav.products" },
      { href: "/quotes", icon: FileText, labelKey: "nav.quotes" },
      { href: "/orders", icon: ShoppingCart, labelKey: "nav.orders" },
    ],
  },
  {
    type: "group",
    key: "customers",
    icon: Users,
    labelKey: "nav.group.customers",
    children: [
      { href: "/contacts", icon: Users, labelKey: "nav.contacts" },
      { href: "/companies", icon: Building2, labelKey: "nav.companies" },
      { href: "/partners", icon: Handshake, labelKey: "nav.partners" },
      { href: "/activities", icon: Activity, labelKey: "nav.activities" },
      {
        href: "/campaigns",
        icon: Megaphone,
        labelKey: "nav.campaigns",
        requiredPermission: "canManageCampaigns",
      },
      { href: "/tickets", icon: LifeBuoy, labelKey: "nav.tickets" },
    ],
  },
  { type: "item", href: "/reports", icon: BarChart3, labelKey: "nav.reports" },
  {
    type: "item",
    href: "/settings",
    icon: Settings,
    labelKey: "nav.settings",
    requiredPermission: "canManageSettings",
  },
  {
    type: "item",
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
    collapsedGroups,
    toggleGroup,
  } = useUIStore();
  const { canManageCampaigns, canManageSettings, canViewApiDocs, isLoading } =
    usePermissions();
  const { t } = useTranslation();

  const permissionMap: Record<Permission, boolean> = {
    canManageCampaigns,
    canManageSettings,
    canViewApiDocs,
  };

  const canShow = (leaf: NavLeaf) => {
    if (!leaf.requiredPermission) return true;
    if (isLoading) return false;
    return permissionMap[leaf.requiredPermission];
  };

  const isLeafActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  const handleNavClick = () => {
    if (isMobile) setSidebarOpen(false);
  };

  const isExpanded = isMobile || expanded;

  // ── Rail (thu gọn): làm phẳng mọi mục thành danh sách icon + tooltip ──
  const railLeaves: NavLeaf[] = navEntries.flatMap((e) =>
    e.type === "group" ? e.children : [e],
  );

  const renderLeaf = (leaf: NavLeaf, indented: boolean) => {
    const active = isLeafActive(leaf.href);
    return (
      <Link
        key={leaf.href}
        href={leaf.href}
        onClick={handleNavClick}
        className={cn(
          "nav-item relative",
          isExpanded
            ? indented
              ? "pl-9 pr-3 py-1.5"
              : "px-3 py-1.5"
            : "justify-center px-2 py-1.5",
          active && "active",
        )}
      >
        {active && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#10B981] rounded-r-full" />
        )}
        <leaf.icon className="w-[18px] h-[18px] shrink-0" />
        {isExpanded && <span>{t(leaf.labelKey)}</span>}
      </Link>
    );
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

          {!isExpanded
            ? // Rail: danh sách icon phẳng, tooltip cho tên
              railLeaves.filter(canShow).map((leaf) => (
                <Tooltip key={leaf.href}>
                  <TooltipTrigger asChild>
                    {renderLeaf(leaf, false)}
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    className="bg-[var(--crm-bg-hover)] text-[var(--crm-text-primary)] border-[var(--crm-border)]"
                  >
                    {t(leaf.labelKey)}
                  </TooltipContent>
                </Tooltip>
              ))
            : navEntries.map((entry) => {
                if (entry.type === "item") {
                  if (!canShow(entry)) return null;
                  return <div key={entry.href}>{renderLeaf(entry, false)}</div>;
                }

                const visibleChildren = entry.children.filter(canShow);
                if (visibleChildren.length === 0) return null;

                const collapsed = collapsedGroups[entry.key];
                const hasActiveChild = visibleChildren.some((c) =>
                  isLeafActive(c.href),
                );

                return (
                  <div key={entry.key} className="pt-1">
                    <button
                      onClick={() => toggleGroup(entry.key)}
                      className={cn(
                        "nav-item w-full px-3 py-1.5",
                        hasActiveChild && "text-[var(--crm-text-primary)]",
                      )}
                    >
                      <entry.icon className="w-[18px] h-[18px] shrink-0" />
                      <span className="flex-1 text-left">
                        {t(entry.labelKey)}
                      </span>
                      <ChevronDown
                        className={cn(
                          "w-3.5 h-3.5 text-[var(--crm-text-muted)] transition-transform",
                          collapsed && "-rotate-90",
                        )}
                      />
                    </button>
                    {!collapsed && (
                      <div className="mt-px space-y-px">
                        {visibleChildren.map((leaf) => renderLeaf(leaf, true))}
                      </div>
                    )}
                  </div>
                );
              })}
        </nav>
      </aside>
    </TooltipProvider>
  );
}
