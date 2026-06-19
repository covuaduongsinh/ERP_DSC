"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Building2,
  GitBranch,
  Bell,
  Mail,
  Users,
  ChevronRight,
  Loader2,
  LifeBuoy,
  Save,
  Webhook,
  Plus,
  Send,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  ExternalLink,
  Coins,
} from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { FieldError } from "@/components/ui/field-error";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAllSettings, useUpdateSetting } from "@/hooks/use-settings";
import { usePermissions } from "@/hooks/use-permissions";
import { useFormValidation } from "@/hooks/use-form-validation";
import {
  companySettingsSchema,
  notificationSettingsSchema,
  emailSettingsSchema,
} from "@/lib/validations";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import {
  useWebhooks,
  useWebhook,
  useCreateWebhook,
  useUpdateWebhook,
  useDeleteWebhook,
  useTestWebhook,
} from "@/hooks/use-webhooks";
import { CRM_EVENTS } from "@/lib/events/types";
import {
  useExchangeRates,
  useCreateExchangeRate,
  useUpdateExchangeRate,
  useDeleteExchangeRate,
} from "@/hooks/use-exchange-rates";
import { SUPPORTED_CURRENCIES } from "@/lib/constants";
import type {
  CompanySettings,
  NotificationSettings,
  EmailSettings,
  PipelineSettings,
  OrderSettings,
} from "@/lib/settings/types";

export default function SettingsPage() {
  const { data: settings, isLoading } = useAllSettings();
  const { isAdmin } = usePermissions();
  const { toast } = useToast();
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <PageShell
        title={t("settings.title")}
        description={t("settings.subtitle")}
      >
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--crm-text-muted)]" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title={t("settings.title")} description={t("settings.subtitle")}>
      <Tabs defaultValue="company">
        <TabsList className="bg-[var(--crm-bg-card)] border border-[var(--crm-border)]">
          <TabsTrigger
            value="company"
            className="text-[var(--crm-text-secondary)] data-[state=active]:bg-[#10B981]/10 data-[state=active]:text-[#10B981]"
          >
            <Building2 className="w-4 h-4 mr-1.5" />
            {t("settings.company")}
          </TabsTrigger>
          <TabsTrigger
            value="pipeline"
            className="text-[var(--crm-text-secondary)] data-[state=active]:bg-[#10B981]/10 data-[state=active]:text-[#10B981]"
          >
            <GitBranch className="w-4 h-4 mr-1.5" />
            {t("settings.pipeline")}
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="text-[var(--crm-text-secondary)] data-[state=active]:bg-[#10B981]/10 data-[state=active]:text-[#10B981]"
          >
            <Bell className="w-4 h-4 mr-1.5" />
            {t("settings.notifications")}
          </TabsTrigger>
          <TabsTrigger
            value="email"
            className="text-[var(--crm-text-secondary)] data-[state=active]:bg-[#10B981]/10 data-[state=active]:text-[#10B981]"
          >
            <Mail className="w-4 h-4 mr-1.5" />
            {t("settings.email")}
          </TabsTrigger>
          <TabsTrigger
            value="team"
            className="text-[var(--crm-text-secondary)] data-[state=active]:bg-[#10B981]/10 data-[state=active]:text-[#10B981]"
          >
            <Users className="w-4 h-4 mr-1.5" />
            {t("team.title")}
          </TabsTrigger>
          <TabsTrigger
            value="support"
            className="text-[var(--crm-text-secondary)] data-[state=active]:bg-[#10B981]/10 data-[state=active]:text-[#10B981]"
          >
            <LifeBuoy className="w-4 h-4 mr-1.5" />
            {t("nav.tickets" as any)}
          </TabsTrigger>
          <TabsTrigger
            value="webhooks"
            className="text-[var(--crm-text-secondary)] data-[state=active]:bg-[#10B981]/10 data-[state=active]:text-[#10B981]"
          >
            <Webhook className="w-4 h-4 mr-1.5" />
            {t("webhooks.title" as any)}
          </TabsTrigger>
          <TabsTrigger
            value="currency"
            className="text-[var(--crm-text-secondary)] data-[state=active]:bg-[#10B981]/10 data-[state=active]:text-[#10B981]"
          >
            <Coins className="w-4 h-4 mr-1.5" />
            {t("settings.currency")}
          </TabsTrigger>
        </TabsList>

        {/* ── Company Tab ────────────────────────────────────── */}
        <TabsContent value="company" className="mt-4">
          <CompanyTab
            initial={settings?.company}
            isAdmin={isAdmin}
            onSuccess={() => toast({ description: "Đã lưu thông tin công ty" })}
          />
        </TabsContent>

        {/* ── Pipeline Tab ───────────────────────────────────── */}
        <TabsContent value="pipeline" className="mt-4">
          <PipelineTab stages={settings?.pipeline?.stages} isAdmin={isAdmin} />
        </TabsContent>

        {/* ── Notifications Tab ──────────────────────────────── */}
        <TabsContent value="notifications" className="mt-4">
          <NotificationsTab
            initial={settings?.notifications}
            isAdmin={isAdmin}
            onSuccess={() => toast({ description: "Đã lưu cài đặt thông báo" })}
          />
        </TabsContent>

        {/* ── Email Tab ──────────────────────────────────────── */}
        <TabsContent value="email" className="mt-4">
          <EmailTab
            initial={settings?.email}
            isAdmin={isAdmin}
            onSuccess={() => toast({ description: "Đã lưu cài đặt email" })}
          />
        </TabsContent>

        {/* ── Team Tab ───────────────────────────────────────── */}
        <TabsContent value="team" className="mt-4">
          <div className="glass-card-static p-3">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-[var(--crm-text-primary)]">
                Thành viên nhóm
              </h3>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-[var(--crm-border)] text-[var(--crm-text-secondary)] hover:text-[var(--crm-text-primary)] hover:bg-[var(--crm-bg-subtle)]"
              >
                <Link href="/settings/team">
                  Xem tất cả
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
              </Button>
            </div>
            <p className="text-sm text-[var(--crm-text-muted)]">
              Quản lý thành viên nhóm và phân quyền truy cập trong trang chi
              tiết.
            </p>
          </div>
        </TabsContent>

        {/* ── Support Tab ──────────────────────────────────── */}
        <TabsContent value="support" className="mt-4">
          <SupportTab
            isAdmin={isAdmin}
            onSuccess={() => toast({ description: "Đã lưu cài đặt hỗ trợ" })}
          />
        </TabsContent>

        {/* ── Webhooks Tab ─────────────────────────────────── */}
        <TabsContent value="webhooks" className="mt-4">
          <WebhooksTab isAdmin={isAdmin} />
        </TabsContent>

        {/* ── Currency Tab ──────────────────────────────────── */}
        <TabsContent value="currency" className="mt-4">
          <CurrencyTab isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

// ── Company Tab ─────────────────────────────────────────────────────

function CompanyTab({
  initial,
  isAdmin,
  onSuccess,
}: {
  initial?: CompanySettings;
  isAdmin: boolean;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    address: initial?.address ?? "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    website: initial?.website ?? "",
    taxId: initial?.taxId ?? "",
  });
  const { errors, validate, clearFieldError, hasError } = useFormValidation(
    companySettingsSchema,
  );
  const mutation = useUpdateSetting("company");

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name ?? "",
        address: initial.address ?? "",
        phone: initial.phone ?? "",
        email: initial.email ?? "",
        website: initial.website ?? "",
        taxId: initial.taxId ?? "",
      });
    }
  }, [initial]);

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    clearFieldError(field);
  };

  const handleSave = () => {
    const validated = validate<CompanySettings>(form);
    if (!validated) return;
    mutation.mutate(validated, { onSuccess });
  };

  const inputCls =
    "bg-[var(--crm-bg-page)] border-[var(--crm-border)] text-[var(--crm-text-primary)]";
  const labelCls = "text-[var(--crm-text-secondary)] text-xs";

  return (
    <div className="glass-card-static p-3">
      <h3 className="text-sm font-medium text-[var(--crm-text-primary)] mb-4">
        Thông tin công ty
      </h3>
      <div className="space-y-4 max-w-lg">
        <div className="space-y-1.5">
          <Label className={labelCls}>{t("settings.companyName") + " *"}</Label>
          <Input
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className={`${inputCls} ${hasError("name") ? "border-red-500" : ""}`}
            disabled={!isAdmin}
          />
          <FieldError message={errors.name} />
        </div>
        <div className="space-y-1.5">
          <Label className={labelCls}>Địa chỉ</Label>
          <Input
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
            className={inputCls}
            disabled={!isAdmin}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className={labelCls}>Điện thoại</Label>
            <Input
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
              className={inputCls}
              disabled={!isAdmin}
            />
          </div>
          <div className="space-y-1.5">
            <Label className={labelCls}>Email</Label>
            <Input
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              className={`${inputCls} ${hasError("email") ? "border-red-500" : ""}`}
              disabled={!isAdmin}
            />
            <FieldError message={errors.email} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className={labelCls}>Website</Label>
            <Input
              value={form.website}
              onChange={(e) => update("website", e.target.value)}
              className={`${inputCls} ${hasError("website") ? "border-red-500" : ""}`}
              disabled={!isAdmin}
              placeholder="https://"
            />
            <FieldError message={errors.website} />
          </div>
          <div className="space-y-1.5">
            <Label className={labelCls}>{t("settings.taxCode")}</Label>
            <Input
              value={form.taxId}
              onChange={(e) => update("taxId", e.target.value)}
              className={inputCls}
              disabled={!isAdmin}
            />
          </div>
        </div>
        {isAdmin && (
          <>
            <Separator className="bg-[var(--crm-border)]" />
            <Button
              onClick={handleSave}
              disabled={mutation.isPending}
              className="btn-accent-glow px-4 py-2"
            >
              {mutation.isPending ? t("common.saving") : t("settings.saveInfo")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Pipeline Tab ────────────────────────────────────────────────────

function PipelineTab({
  stages,
  isAdmin,
}: {
  stages?: PipelineSettings["stages"];
  isAdmin: boolean;
}) {
  const { t } = useTranslation();
  const displayStages = stages || [];
  return (
    <div className="glass-card-static p-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-[var(--crm-text-primary)]">
          {t("settings.pipelineStages")}
        </h3>
        {isAdmin && (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-[var(--crm-border)] text-[var(--crm-text-secondary)] hover:text-[var(--crm-text-primary)] hover:bg-[var(--crm-bg-subtle)]"
          >
            <Link href="/settings/pipeline">
              Chỉnh sửa
              <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {displayStages.map((stage, idx) => (
          <div
            key={stage.id || idx}
            className="flex items-center gap-3 p-3 rounded-md bg-[var(--glass-bg)] border border-[var(--crm-border-subtle)]"
          >
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: stage.color }}
            />
            <span className="text-sm text-[var(--crm-text-primary)] flex-1">
              {stage.name}
            </span>
            <span className="text-xs text-[var(--crm-text-muted)]">
              {stage.probability}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Notifications Tab ───────────────────────────────────────────────

function NotificationsTab({
  initial,
  isAdmin,
  onSuccess,
}: {
  initial?: NotificationSettings;
  isAdmin: boolean;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<NotificationSettings>({
    quoteExpiryReminder: initial?.quoteExpiryReminder ?? true,
    quoteExpiryDays: initial?.quoteExpiryDays ?? 3,
    dealStaleAlertDays: initial?.dealStaleAlertDays ?? 14,
    emailOnNewDeal: initial?.emailOnNewDeal ?? false,
  });
  const { errors, validate, hasError } = useFormValidation(
    notificationSettingsSchema,
  );
  const mutation = useUpdateSetting("notifications");

  useEffect(() => {
    if (initial) setForm(initial);
  }, [initial]);

  const handleSave = () => {
    const validated = validate<NotificationSettings>(form);
    if (!validated) return;
    mutation.mutate(validated, { onSuccess });
  };

  const inputCls =
    "bg-[var(--crm-bg-page)] border-[var(--crm-border)] text-[var(--crm-text-primary)] w-20";

  return (
    <div className="space-y-4">
      {/* Per-user notification preferences */}
      <NotificationPreferencesGrid />

      {/* Admin-only notification system settings */}
      {isAdmin && (
        <div className="glass-card-static p-3">
          <h3 className="text-sm font-medium text-[var(--crm-text-primary)] mb-4">
            {t("settings.notificationSettings")}
          </h3>
          <div className="space-y-5 max-w-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--crm-text-primary)]">
                  Nhắc nhở báo giá sắp hết hạn
                </p>
                <p className="text-xs text-[var(--crm-text-muted)]">
                  {t("settings.quoteExpiryNotification")}
                </p>
              </div>
              <Switch
                checked={form.quoteExpiryReminder}
                onCheckedChange={(v) =>
                  setForm({ ...form, quoteExpiryReminder: v })
                }
                className="data-[state=checked]:bg-[#10B981]"
              />
            </div>
            {form.quoteExpiryReminder && (
              <div className="flex items-center gap-3 pl-4">
                <Label className="text-[var(--crm-text-secondary)] text-xs">
                  Nhắc trước
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={form.quoteExpiryDays}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      quoteExpiryDays: Number(e.target.value),
                    })
                  }
                  className={`${inputCls} ${hasError("quoteExpiryDays") ? "border-red-500" : ""}`}
                />
                <span className="text-xs text-[var(--crm-text-muted)]">
                  ngày
                </span>
                <FieldError message={errors.quoteExpiryDays} />
              </div>
            )}
            <Separator className="bg-[var(--crm-border)]" />
            <div className="flex items-center gap-3">
              <Label className="text-[var(--crm-text-secondary)] text-xs">
                {t("settings.inactiveDealAlert")}
              </Label>
              <Input
                type="number"
                min={1}
                max={90}
                value={form.dealStaleAlertDays}
                onChange={(e) =>
                  setForm({
                    ...form,
                    dealStaleAlertDays: Number(e.target.value),
                  })
                }
                className={inputCls}
              />
              <span className="text-xs text-[var(--crm-text-muted)]">ngày</span>
            </div>
            <Separator className="bg-[var(--crm-border)]" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--crm-text-primary)]">
                  {t("settings.newDealNotification")}
                </p>
                <p className="text-xs text-[var(--crm-text-muted)]">
                  {t("settings.newDealNotificationDesc")}
                </p>
              </div>
              <Switch
                checked={form.emailOnNewDeal}
                onCheckedChange={(v) => setForm({ ...form, emailOnNewDeal: v })}
                className="data-[state=checked]:bg-[#10B981]"
              />
            </div>
            <Separator className="bg-[var(--crm-border)]" />
            <Button
              onClick={handleSave}
              disabled={mutation.isPending}
              className="btn-accent-glow px-4 py-2"
            >
              {mutation.isPending
                ? t("common.saving")
                : t("settings.saveSettings")}
            </Button>
          </div>
        </div>
      )}

      {/* Auto-order automation settings */}
      {isAdmin && <OrderAutomationSection />}
    </div>
  );
}

// ── Order Automation Settings ────────────────────────────────────────

function OrderAutomationSection() {
  const { toast } = useToast();
  const { data: settings } = useAllSettings();
  const mutation = useUpdateSetting("order");
  const [autoOrder, setAutoOrder] = useState(true);

  useEffect(() => {
    if (settings?.order) {
      setAutoOrder(settings.order.autoOrderFromQuote ?? true);
    }
  }, [settings?.order]);

  const handleToggle = (checked: boolean) => {
    setAutoOrder(checked);
    mutation.mutate(
      { autoOrderFromQuote: checked },
      {
        onSuccess: () =>
          toast({
            description: checked
              ? "Đã bật tự động tạo đơn hàng"
              : "Đã tắt tự động tạo đơn hàng",
          }),
      },
    );
  };

  return (
    <div className="glass-card-static p-3">
      <h3 className="text-sm font-medium text-[var(--crm-text-primary)] mb-4">
        Tự động hóa
      </h3>
      <div className="space-y-5 max-w-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[var(--crm-text-primary)]">
              Tự động tạo đơn hàng khi báo giá được chấp nhận
            </p>
            <p className="text-xs text-[var(--crm-text-muted)]">
              Khi khách hàng chấp nhận báo giá qua portal, đơn hàng sẽ được tạo
              tự động
            </p>
          </div>
          <Switch
            checked={autoOrder}
            onCheckedChange={handleToggle}
            disabled={mutation.isPending}
            className="data-[state=checked]:bg-[#10B981]"
          />
        </div>
      </div>
    </div>
  );
}

// ── Notification Preferences Grid (per-user) ────────────────────────

interface NotifPref {
  eventType: string;
  inApp: boolean;
  email: boolean;
}

function NotificationPreferencesGrid() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [prefs, setPrefs] = useState<NotifPref[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: async () => {
      const res = await fetch("/api/notifications/preferences");
      if (!res.ok) throw new Error("Failed to fetch preferences");
      const json = await res.json();
      return json.data as NotifPref[];
    },
  });

  useEffect(() => {
    if (data) {
      setPrefs(data);
      setDirty(false);
    }
  }, [data]);

  const toggle = (eventType: string, field: "inApp" | "email") => {
    setPrefs((prev) =>
      prev.map((p) =>
        p.eventType === eventType ? { ...p, [field]: !p[field] } : p,
      ),
    );
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: prefs }),
      });
      if (res.ok) {
        queryClient.invalidateQueries({
          queryKey: ["notification-preferences"],
        });
        setDirty(false);
        toast({ description: t("notifPref.saved" as any) });
      }
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="glass-card-static p-3">
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--crm-text-muted)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card-static p-3">
      <h3 className="text-sm font-medium text-[var(--crm-text-primary)] mb-1">
        {t("notifPref.title" as any)}
      </h3>
      <p className="text-xs text-[var(--crm-text-muted)] mb-4">
        {t("notifPref.subtitle" as any)}
      </p>

      <div className="border border-[var(--crm-border)] rounded-lg overflow-hidden max-w-lg">
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--crm-bg-subtle)]">
              <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--crm-text-secondary)] px-4 py-2.5">
                {t("notifPref.eventCol" as any)}
              </th>
              <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--crm-text-secondary)] px-4 py-2.5 w-20">
                {t("notifPref.inAppCol" as any)}
              </th>
              <th className="text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--crm-text-secondary)] px-4 py-2.5 w-20">
                {t("notifPref.emailCol" as any)}
              </th>
            </tr>
          </thead>
          <tbody>
            {prefs.map((pref) => (
              <tr
                key={pref.eventType}
                className="border-t border-[var(--crm-border-subtle)]"
              >
                <td className="px-4 py-2.5">
                  <span className="text-sm text-[var(--crm-text-primary)]">
                    {t(`notifPref.event.${pref.eventType}` as any)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-center">
                  <Switch
                    checked={pref.inApp}
                    onCheckedChange={() => toggle(pref.eventType, "inApp")}
                    className="data-[state=checked]:bg-[#10B981] scale-75"
                  />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <Switch
                    checked={pref.email}
                    onCheckedChange={() => toggle(pref.eventType, "email")}
                    className="data-[state=checked]:bg-[#10B981] scale-75"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dirty && (
        <div className="mt-4">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="btn-accent-glow px-4 py-2"
          >
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? t("common.saving") : t("settings.saveSettings")}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Email Tab ───────────────────────────────────────────────────────

function EmailTab({
  initial,
  isAdmin,
  onSuccess,
}: {
  initial?: EmailSettings;
  isAdmin: boolean;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<EmailSettings>({
    fromName: initial?.fromName ?? "",
    fromEmail: initial?.fromEmail ?? "",
    replyTo: initial?.replyTo ?? "",
    signature: initial?.signature ?? "",
  });
  const { errors, validate, clearFieldError, hasError } =
    useFormValidation(emailSettingsSchema);
  const mutation = useUpdateSetting("email");

  useEffect(() => {
    if (initial) setForm(initial);
  }, [initial]);

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    clearFieldError(field);
  };

  const handleSave = () => {
    const validated = validate<EmailSettings>(form);
    if (!validated) return;
    mutation.mutate(validated, { onSuccess });
  };

  if (!isAdmin) {
    return (
      <div className="glass-card-static p-3">
        <p className="text-sm text-[var(--crm-text-muted)]">
          Chỉ Admin mới có thể thay đổi cài đặt email.
        </p>
      </div>
    );
  }

  const inputCls =
    "bg-[var(--crm-bg-page)] border-[var(--crm-border)] text-[var(--crm-text-primary)]";

  return (
    <div className="glass-card-static p-3">
      <h3 className="text-sm font-medium text-[var(--crm-text-primary)] mb-4">
        {t("settings.emailSettings")}
      </h3>
      <div className="space-y-4 max-w-lg">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[var(--crm-text-secondary)] text-xs">
              Tên người gửi
            </Label>
            <Input
              value={form.fromName}
              onChange={(e) => update("fromName", e.target.value)}
              className={inputCls}
              placeholder="Cờ vua Dương Sinh CRM"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[var(--crm-text-secondary)] text-xs">
              {t("settings.fromEmail")}
            </Label>
            <Input
              value={form.fromEmail}
              onChange={(e) => update("fromEmail", e.target.value)}
              className={`${inputCls} ${hasError("fromEmail") ? "border-red-500" : ""}`}
              placeholder={t("settings.fromEmailPlaceholder")}
            />
            <FieldError message={errors.fromEmail} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[var(--crm-text-secondary)] text-xs">
            Reply-To
          </Label>
          <Input
            value={form.replyTo}
            onChange={(e) => update("replyTo", e.target.value)}
            className={`${inputCls} ${hasError("replyTo") ? "border-red-500" : ""}`}
            placeholder="sales@company.com"
          />
          <FieldError message={errors.replyTo} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[var(--crm-text-secondary)] text-xs">
            Chữ ký email
          </Label>
          <Textarea
            value={form.signature}
            onChange={(e) => update("signature", e.target.value)}
            rows={4}
            className={`${inputCls} placeholder:text-[var(--crm-text-muted)]`}
            placeholder={t("settings.signaturePlaceholder")}
          />
        </div>
        <Separator className="bg-[var(--crm-border)]" />
        <Button
          onClick={handleSave}
          disabled={mutation.isPending}
          className="btn-accent-glow px-4 py-2"
        >
          {mutation.isPending ? t("common.saving") : t("settings.saveSettings")}
        </Button>
      </div>
    </div>
  );
}

// ── Support Tab (SLA + Auto-Assign Settings) ─────────────────────

const STRATEGY_OPTIONS = [
  {
    value: "manual",
    labelKey: "support.strategy.manual",
    descKey: "support.strategy.manualDesc",
  },
  {
    value: "round_robin",
    labelKey: "support.strategy.roundRobin",
    descKey: "support.strategy.roundRobinDesc",
  },
  {
    value: "least_loaded",
    labelKey: "support.strategy.leastLoaded",
    descKey: "support.strategy.leastLoadedDesc",
  },
] as const;

const PRIORITY_LABELS: Record<string, { emoji: string; colorClass: string }> = {
  URGENT: { emoji: "\uD83D\uDD34", colorClass: "text-red-500" },
  HIGH: { emoji: "\uD83D\uDFE0", colorClass: "text-orange-500" },
  MEDIUM: { emoji: "\uD83D\uDFE1", colorClass: "text-yellow-500" },
  LOW: { emoji: "\uD83D\uDFE2", colorClass: "text-green-500" },
};

interface SlaConfigRow {
  priority: string;
  firstResponseHours: number;
  resolutionHours: number;
}

function SupportTab({
  isAdmin,
  onSuccess,
}: {
  isAdmin: boolean;
  onSuccess: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [strategy, setStrategy] = useState("round_robin");
  const [configs, setConfigs] = useState<SlaConfigRow[]>([
    { priority: "URGENT", firstResponseHours: 1, resolutionHours: 4 },
    { priority: "HIGH", firstResponseHours: 4, resolutionHours: 24 },
    { priority: "MEDIUM", firstResponseHours: 8, resolutionHours: 48 },
    { priority: "LOW", firstResponseHours: 24, resolutionHours: 72 },
  ]);

  // Fetch current SLA settings
  const { data: slaData, isLoading } = useQuery({
    queryKey: ["sla-settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings/sla");
      if (!res.ok) return null;
      const json = await res.json();
      return json.data;
    },
  });

  // Sync fetched data to state
  useEffect(() => {
    if (slaData) {
      if (slaData.strategy) setStrategy(slaData.strategy);
      if (slaData.configs && slaData.configs.length > 0) {
        const priorityOrder = ["URGENT", "HIGH", "MEDIUM", "LOW"];
        const sorted = priorityOrder.map((p) => {
          const found = slaData.configs.find(
            (c: SlaConfigRow) => c.priority === p,
          );
          return found || configs.find((c) => c.priority === p)!;
        });
        setConfigs(sorted);
      }
    }
  }, [slaData]); // eslint-disable-line react-hooks/exhaustive-deps

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/sla", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configs, strategy }),
      });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["sla-settings"] });
        onSuccess();
      }
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (
    priority: string,
    field: "firstResponseHours" | "resolutionHours",
    value: number,
  ) => {
    setConfigs((prev) =>
      prev.map((c) =>
        c.priority === priority ? { ...c, [field]: Math.max(1, value) } : c,
      ),
    );
  };

  if (!isAdmin) {
    return (
      <div className="glass-card-static p-3">
        <p className="text-sm text-[var(--crm-text-muted)]">
          Chỉ Admin mới có thể thay đổi cài đặt hỗ trợ.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="glass-card-static p-3">
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--crm-text-muted)]" />
        </div>
      </div>
    );
  }

  const inputCls =
    "bg-[var(--crm-bg-page)] border-[var(--crm-border)] text-[var(--crm-text-primary)]";

  return (
    <div className="glass-card-static p-3">
      <h3 className="text-sm font-medium text-[var(--crm-text-primary)] mb-3">
        {t("support.title" as any)}
      </h3>
      <div className="space-y-3 max-w-2xl">
        {/* Auto-assign strategy */}
        <div>
          <Label className="text-xs text-[var(--crm-text-secondary)] mb-3 block">
            {t("support.autoAssign" as any)}
          </Label>
          <div className="space-y-2">
            {STRATEGY_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  strategy === opt.value
                    ? "border-[#10B981] bg-[#10B981]/5"
                    : "border-[var(--crm-border)] hover:bg-[var(--crm-bg-subtle)]"
                }`}
              >
                <input
                  type="radio"
                  name="strategy"
                  value={opt.value}
                  checked={strategy === opt.value}
                  onChange={(e) => setStrategy(e.target.value)}
                  className="sr-only"
                />
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    strategy === opt.value
                      ? "border-[#10B981]"
                      : "border-[var(--crm-border)]"
                  }`}
                >
                  {strategy === opt.value && (
                    <div className="w-2 h-2 rounded-full bg-[#10B981]" />
                  )}
                </div>
                <div>
                  <p className="text-sm text-[var(--crm-text-primary)] font-medium">
                    {t(opt.labelKey as any)}
                  </p>
                  <p className="text-xs text-[var(--crm-text-muted)]">
                    {t(opt.descKey as any)}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <Separator className="bg-[var(--crm-border)]" />

        {/* SLA targets table */}
        <div>
          <Label className="text-xs text-[var(--crm-text-secondary)] mb-3 block">
            {t("support.slaTargets" as any)}
          </Label>
          <div className="border border-[var(--crm-border)] rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--crm-bg-subtle)]">
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--crm-text-secondary)] px-4 py-2.5">
                    {t("support.priorityCol" as any)}
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--crm-text-secondary)] px-4 py-2.5">
                    {t("support.firstResponseCol" as any)}
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--crm-text-secondary)] px-4 py-2.5">
                    {t("support.resolutionCol" as any)}
                  </th>
                </tr>
              </thead>
              <tbody>
                {configs.map((config) => {
                  const pl = PRIORITY_LABELS[config.priority];
                  return (
                    <tr
                      key={config.priority}
                      className="border-t border-[var(--crm-border-subtle)]"
                    >
                      <td className="px-4 py-2.5">
                        <span className="text-sm text-[var(--crm-text-primary)]">
                          {pl?.emoji}{" "}
                          {t(`ticketPriority.${config.priority}` as any)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            value={config.firstResponseHours}
                            onChange={(e) =>
                              updateConfig(
                                config.priority,
                                "firstResponseHours",
                                Number(e.target.value),
                              )
                            }
                            className={`${inputCls} w-20 h-8 text-sm`}
                          />
                          <span className="text-xs text-[var(--crm-text-muted)]">
                            {t("support.hours" as any)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            value={config.resolutionHours}
                            onChange={(e) =>
                              updateConfig(
                                config.priority,
                                "resolutionHours",
                                Number(e.target.value),
                              )
                            }
                            className={`${inputCls} w-20 h-8 text-sm`}
                          />
                          <span className="text-xs text-[var(--crm-text-muted)]">
                            {t("support.hours" as any)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <Separator className="bg-[var(--crm-border)]" />

        <Button
          onClick={handleSave}
          disabled={saving}
          className="btn-accent-glow px-4 py-2"
        >
          <Save className="w-4 h-4 mr-1.5" />
          {saving ? t("common.saving") : t("support.save" as any)}
        </Button>
      </div>
    </div>
  );
}

// ── Currency Tab ──────────────────────────────────────────────────────

function CurrencyTab({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: rates, isLoading } = useExchangeRates();
  const createRate = useCreateExchangeRate();
  const updateRate = useUpdateExchangeRate();
  const deleteRate = useDeleteExchangeRate();

  const [showAdd, setShowAdd] = useState(false);
  const [newCurrency, setNewCurrency] = useState("");
  const [newRate, setNewRate] = useState("");

  if (!isAdmin) {
    return (
      <div className="glass-card-static p-3">
        <p className="text-sm text-[var(--crm-text-muted)]">
          {t("settings.currencyAdminOnly")}
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="glass-card-static p-3">
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--crm-text-muted)]" />
        </div>
      </div>
    );
  }

  const rateList = rates || [];
  const baseCurrency = rateList.find((r: any) => r.isBase);
  const availableCurrencies = SUPPORTED_CURRENCIES.filter(
    (c) => !rateList.some((r: any) => r.currency === c.code),
  );

  const handleAdd = () => {
    const info = SUPPORTED_CURRENCIES.find((c) => c.code === newCurrency);
    if (!info || !newRate) return;
    createRate.mutate(
      {
        currency: info.code,
        symbol: info.symbol,
        name: info.name,
        rateToBase: parseFloat(newRate),
        isBase: false,
        isActive: true,
      },
      {
        onSuccess: () => {
          setShowAdd(false);
          setNewCurrency("");
          setNewRate("");
          toast({ description: t("settings.currencySaved") });
        },
      },
    );
  };

  const handleSetBase = (id: string) => {
    updateRate.mutate(
      { id, isBase: true },
      {
        onSuccess: () =>
          toast({ description: t("settings.baseCurrencyUpdated") }),
      },
    );
  };

  const handleUpdateRate = (id: string, rateToBase: number) => {
    updateRate.mutate(
      { id, rateToBase },
      { onSuccess: () => toast({ description: t("settings.currencySaved") }) },
    );
  };

  const handleDelete = (id: string, currency: string) => {
    if (!confirm(`Delete ${currency}?`)) return;
    deleteRate.mutate(id, {
      onSuccess: () => toast({ description: t("settings.currencyDeleted") }),
    });
  };

  const inputCls =
    "bg-[var(--crm-bg-page)] border-[var(--crm-border)] text-[var(--crm-text-primary)]";

  return (
    <div className="space-y-4">
      <div className="glass-card-static p-3">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-[var(--crm-text-primary)]">
              {t("settings.currencyTitle")}
            </h3>
            <p className="text-xs text-[var(--crm-text-muted)] mt-0.5">
              {t("settings.currencySubtitle")}
            </p>
          </div>
          {availableCurrencies.length > 0 && (
            <Button
              onClick={() => setShowAdd(true)}
              className="btn-accent-glow px-3 py-2 text-sm"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              {t("settings.addCurrency")}
            </Button>
          )}
        </div>

        {rateList.length === 0 ? (
          <div className="text-center py-10">
            <Coins className="w-10 h-10 mx-auto text-[var(--crm-text-muted)] mb-3" />
            <p className="text-sm text-[var(--crm-text-secondary)]">
              {t("settings.noCurrencies")}
            </p>
          </div>
        ) : (
          <div className="border border-[var(--crm-border)] rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--crm-bg-subtle)]">
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--crm-text-secondary)] px-4 py-2.5">
                    {t("settings.currencyCode")}
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--crm-text-secondary)] px-4 py-2.5">
                    {t("settings.currencyName")}
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--crm-text-secondary)] px-4 py-2.5">
                    {t("settings.exchangeRate")}
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--crm-text-secondary)] px-4 py-2.5">
                    {t("common.status")}
                  </th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-[var(--crm-text-secondary)] px-4 py-2.5">
                    {t("common.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rateList.map((rate: any) => (
                  <CurrencyRow
                    key={rate.id}
                    rate={rate}
                    onUpdateRate={handleUpdateRate}
                    onSetBase={handleSetBase}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Currency Dialog */}
      <Dialog
        open={showAdd}
        onOpenChange={(v) => {
          if (!v) setShowAdd(false);
        }}
      >
        <DialogContent className="bg-[var(--crm-bg-card)] border-[var(--crm-border)] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[var(--crm-text-primary)]">
              {t("settings.addCurrency")}
            </DialogTitle>
            <DialogDescription className="text-[var(--crm-text-muted)]">
              {t("settings.currencySubtitle")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--crm-text-secondary)]">
                {t("settings.currencyCode")}
              </Label>
              <select
                value={newCurrency}
                onChange={(e) => setNewCurrency(e.target.value)}
                className={`w-full rounded-md px-3 py-2 text-sm ${inputCls}`}
              >
                <option value="">-- {t("settings.selectCurrency")} --</option>
                {availableCurrencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--crm-text-secondary)]">
                {t("settings.exchangeRate")}{" "}
                {baseCurrency ? `(1 ${baseCurrency.currency} = ?)` : ""}
              </Label>
              <Input
                type="number"
                step="0.000001"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                placeholder="1.0"
                className={inputCls}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowAdd(false)}
              className="text-[var(--crm-text-secondary)]"
            >
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleAdd}
              disabled={!newCurrency || !newRate || createRate.isPending}
              className="btn-accent-glow"
            >
              {createRate.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              ) : null}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CurrencyRow({
  rate,
  onUpdateRate,
  onSetBase,
  onDelete,
}: {
  rate: any;
  onUpdateRate: (id: string, rateToBase: number) => void;
  onSetBase: (id: string) => void;
  onDelete: (id: string, currency: string) => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [rateValue, setRateValue] = useState(String(rate.rateToBase));
  const info = SUPPORTED_CURRENCIES.find((c) => c.code === rate.currency);

  return (
    <tr className="border-t border-[var(--crm-border-subtle)]">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm">{info?.flag}</span>
          <span className="text-sm font-medium text-[var(--crm-text-primary)]">
            {rate.currency}
          </span>
          <span className="text-xs text-[var(--crm-text-muted)]">
            {rate.symbol}
          </span>
        </div>
      </td>
      <td className="px-4 py-2.5 text-sm text-[var(--crm-text-secondary)]">
        {rate.name}
      </td>
      <td className="px-4 py-2.5">
        {rate.isBase ? (
          <span className="text-sm text-[var(--crm-text-muted)]">
            1.0 ({t("settings.baseCurrency")})
          </span>
        ) : editing ? (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.000001"
              value={rateValue}
              onChange={(e) => setRateValue(e.target.value)}
              className="bg-[var(--crm-bg-page)] border-[var(--crm-border)] text-[var(--crm-text-primary)] w-32 h-7 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onUpdateRate(rate.id, parseFloat(rateValue));
                  setEditing(false);
                }
                if (e.key === "Escape") setEditing(false);
              }}
              autoFocus
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onUpdateRate(rate.id, parseFloat(rateValue));
                setEditing(false);
              }}
              className="h-7 w-7 p-0 text-[#10B981]"
            >
              <Save className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-sm text-[var(--crm-text-primary)] hover:text-[#10B981] transition-colors"
          >
            {Number(rate.rateToBase).toFixed(6)}
          </button>
        )}
      </td>
      <td className="px-4 py-2.5">
        {rate.isBase ? (
          <Badge className="text-[10px] bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20">
            {t("settings.baseCurrency")}
          </Badge>
        ) : rate.isActive ? (
          <Badge className="text-[10px] bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
            {t("common.active")}
          </Badge>
        ) : (
          <Badge className="text-[10px] bg-red-500/10 text-red-500 border-red-500/20">
            {t("common.inactive")}
          </Badge>
        )}
      </td>
      <td className="px-4 py-2.5 text-right">
        {!rate.isBase && (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSetBase(rate.id)}
              className="h-7 text-[10px] text-[var(--crm-text-muted)] hover:text-[#10B981]"
              title={t("settings.setAsBase")}
            >
              {t("settings.setAsBase")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(rate.id, rate.currency)}
              className="h-7 w-7 p-0 text-[var(--crm-text-muted)] hover:text-red-500"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Webhooks Tab ──────────────────────────────────────────────────────

const ALL_EVENTS = Object.values(CRM_EVENTS);

interface WebhookListItem {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
  totalLogs: number;
  successRate: number | null;
  lastDelivery: string | null;
}

interface WebhookDetail {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  logs: WebhookLogItem[];
}

interface WebhookLogItem {
  id: string;
  event: string;
  success: boolean;
  statusCode: number | null;
  duration: number | null;
  attempt: number;
  error: string | null;
  createdAt: string;
}

function WebhooksTab({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: webhooks, isLoading } = useWebhooks();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editWebhook, setEditWebhook] = useState<WebhookListItem | null>(null);

  if (!isAdmin) {
    return (
      <div className="glass-card-static p-3">
        <p className="text-sm text-[var(--crm-text-muted)]">
          Chỉ Admin mới có thể quản lý webhooks.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="glass-card-static p-3">
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--crm-text-muted)]" />
        </div>
      </div>
    );
  }

  // Detail view
  if (selectedId) {
    return (
      <WebhookDetailView id={selectedId} onBack={() => setSelectedId(null)} />
    );
  }

  const list: WebhookListItem[] = webhooks || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-[var(--crm-text-primary)]">
            {t("webhooks.title" as any)}
          </h3>
          <p className="text-xs text-[var(--crm-text-muted)] mt-0.5">
            {t("webhooks.subtitle" as any)}
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="btn-accent-glow px-3 py-2 text-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          {t("webhooks.create" as any)}
        </Button>
      </div>

      {list.length === 0 ? (
        <div className="glass-card-static p-10 text-center">
          <Webhook className="w-10 h-10 mx-auto text-[var(--crm-text-muted)] mb-3" />
          <p className="text-sm text-[var(--crm-text-secondary)]">
            {t("webhooks.noWebhooks" as any)}
          </p>
          <p className="text-xs text-[var(--crm-text-muted)] mt-1">
            {t("webhooks.noWebhooksDesc" as any)}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((wh) => (
            <WebhookRow
              key={wh.id}
              webhook={wh}
              onView={() => setSelectedId(wh.id)}
              onEdit={() => setEditWebhook(wh)}
            />
          ))}
        </div>
      )}

      <WebhookFormDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        mode="create"
      />

      {editWebhook && (
        <WebhookFormDialog
          open={!!editWebhook}
          onClose={() => setEditWebhook(null)}
          mode="edit"
          webhook={editWebhook}
        />
      )}
    </div>
  );
}

// ── Webhook Row ──────────────────────────────────────────────────────

function WebhookRow({
  webhook,
  onView,
  onEdit,
}: {
  webhook: WebhookListItem;
  onView: () => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const deleteWebhook = useDeleteWebhook();
  const testWebhook = useTestWebhook();

  const handleDelete = () => {
    if (!confirm(t("webhooks.deleteConfirm" as any))) return;
    deleteWebhook.mutate(webhook.id);
  };

  const handleTest = () => {
    testWebhook.mutate(webhook.id, {
      onSuccess: (data) => {
        toast({
          description: data.success
            ? t("webhooks.testSuccess" as any)
            : t("webhooks.testFailed" as any),
        });
      },
      onError: () => {
        toast({
          description: t("webhooks.testFailed" as any),
          variant: "destructive",
        });
      },
    });
  };

  return (
    <div className="glass-card-static p-4 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <button
            onClick={onView}
            className="text-sm font-medium text-[var(--crm-text-primary)] hover:text-[#10B981] transition-colors truncate"
          >
            {webhook.name}
          </button>
          <Badge
            className={`text-[10px] px-1.5 py-0 ${
              webhook.active
                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                : "bg-red-500/10 text-red-500 border-red-500/20"
            }`}
          >
            {webhook.active
              ? t("webhooks.active" as any)
              : t("webhooks.inactive" as any)}
          </Badge>
        </div>
        <p className="text-xs text-[var(--crm-text-muted)] truncate">
          {webhook.url}
        </p>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-[10px] text-[var(--crm-text-muted)]">
            {webhook.events.length} {t("webhooks.events" as any).toLowerCase()}
          </span>
          {webhook.successRate !== null && (
            <span
              className={`text-[10px] ${webhook.successRate >= 90 ? "text-emerald-500" : webhook.successRate >= 50 ? "text-yellow-500" : "text-red-500"}`}
            >
              {webhook.successRate}%{" "}
              {t("webhooks.successRate" as any).toLowerCase()}
            </span>
          )}
          {webhook.lastDelivery && (
            <span className="text-[10px] text-[var(--crm-text-muted)]">
              {t("webhooks.lastDelivery" as any)}:{" "}
              {new Date(webhook.lastDelivery).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleTest}
          disabled={testWebhook.isPending}
          className="text-[var(--crm-text-muted)] hover:text-[#10B981] h-8 w-8 p-0"
        >
          {testWebhook.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="text-[var(--crm-text-muted)] hover:text-[var(--crm-text-primary)] h-8 w-8 p-0"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          disabled={deleteWebhook.isPending}
          className="text-[var(--crm-text-muted)] hover:text-red-500 h-8 w-8 p-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ── Webhook Form Dialog (Create / Edit) ──────────────────────────────

function WebhookFormDialog({
  open,
  onClose,
  mode,
  webhook,
}: {
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  webhook?: WebhookListItem;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const createWebhook = useCreateWebhook();
  const updateWebhook = useUpdateWebhook();

  const [name, setName] = useState(webhook?.name ?? "");
  const [url, setUrl] = useState(webhook?.url ?? "");
  const [events, setEvents] = useState<string[]>(webhook?.events ?? []);
  const [active, setActive] = useState(webhook?.active ?? true);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(webhook?.name ?? "");
      setUrl(webhook?.url ?? "");
      setEvents(webhook?.events ?? []);
      setActive(webhook?.active ?? true);
      setCreatedSecret(null);
    }
  }, [open, webhook]);

  const toggleEvent = (ev: string) => {
    setEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev],
    );
  };

  const selectAll = () => {
    setEvents(events.length === ALL_EVENTS.length ? [] : [...ALL_EVENTS]);
  };

  const handleSubmit = () => {
    if (!name.trim() || !url.trim() || events.length === 0) return;

    if (mode === "create") {
      createWebhook.mutate(
        { name: name.trim(), url: url.trim(), events },
        {
          onSuccess: (data) => {
            setCreatedSecret(data.secret);
            toast({ description: t("webhooks.create" as any) + " OK" });
          },
        },
      );
    } else if (webhook) {
      updateWebhook.mutate(
        { id: webhook.id, name: name.trim(), url: url.trim(), events, active },
        {
          onSuccess: () => {
            toast({ description: t("webhooks.edit" as any) + " OK" });
            onClose();
          },
        },
      );
    }
  };

  const isPending = createWebhook.isPending || updateWebhook.isPending;
  const inputCls =
    "bg-[var(--crm-bg-page)] border-[var(--crm-border)] text-[var(--crm-text-primary)]";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="bg-[var(--crm-bg-card)] border-[var(--crm-border)] max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[var(--crm-text-primary)]">
            {mode === "create"
              ? t("webhooks.create" as any)
              : t("webhooks.edit" as any)}
          </DialogTitle>
          <DialogDescription className="text-[var(--crm-text-muted)]">
            {t("webhooks.subtitle" as any)}
          </DialogDescription>
        </DialogHeader>

        {/* Show secret after creation */}
        {createdSecret ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
              <p className="text-sm font-medium text-yellow-500 mb-2">
                {t("webhooks.secret" as any)}
              </p>
              <p className="text-xs text-[var(--crm-text-muted)] mb-3">
                {t("webhooks.secretHint" as any)}
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-[var(--crm-bg-page)] p-2 rounded border border-[var(--crm-border)] text-[var(--crm-text-primary)] break-all font-mono">
                  {createdSecret}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(createdSecret);
                    toast({ description: "Copied!" });
                  }}
                  className="h-8 w-8 p-0 text-[var(--crm-text-muted)]"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={onClose} className="btn-accent-glow">
                OK
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--crm-text-secondary)]">
                {t("webhooks.name" as any)} *
              </Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                placeholder="My Webhook"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[var(--crm-text-secondary)]">
                {t("webhooks.url" as any)} *
              </Label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className={inputCls}
                placeholder="https://example.com/webhook"
              />
            </div>

            {mode === "edit" && (
              <div className="flex items-center justify-between">
                <Label className="text-xs text-[var(--crm-text-secondary)]">
                  {t("webhooks.active" as any)}
                </Label>
                <Switch
                  checked={active}
                  onCheckedChange={setActive}
                  className="data-[state=checked]:bg-[#10B981]"
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-[var(--crm-text-secondary)]">
                  {t("webhooks.events" as any)} *
                </Label>
                <button
                  onClick={selectAll}
                  className="text-[10px] text-[#10B981] hover:underline"
                >
                  {events.length === ALL_EVENTS.length
                    ? t("common.cancel" as any)
                    : t("webhooks.allEvents" as any)}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto p-2 rounded-lg border border-[var(--crm-border)] bg-[var(--crm-bg-page)]">
                {ALL_EVENTS.map((ev) => (
                  <label
                    key={ev}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs transition-colors ${
                      events.includes(ev)
                        ? "bg-[#10B981]/10 text-[#10B981]"
                        : "text-[var(--crm-text-muted)] hover:bg-[var(--crm-bg-subtle)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={events.includes(ev)}
                      onChange={() => toggleEvent(ev)}
                      className="sr-only"
                    />
                    <div
                      className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${
                        events.includes(ev)
                          ? "bg-[#10B981] border-[#10B981]"
                          : "border-[var(--crm-border)]"
                      }`}
                    >
                      {events.includes(ev) && (
                        <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                      )}
                    </div>
                    <span className="truncate">
                      {t(`webhooks.event.${ev}` as any)}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={onClose}
                className="text-[var(--crm-text-secondary)]"
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  isPending ||
                  !name.trim() ||
                  !url.trim() ||
                  events.length === 0
                }
                className="btn-accent-glow"
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                ) : null}
                {mode === "create"
                  ? t("webhooks.create" as any)
                  : t("common.save")}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Webhook Detail View ──────────────────────────────────────────────

function WebhookDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: webhook, isLoading } = useWebhook(id);
  const testWebhook = useTestWebhook();

  const handleTest = () => {
    testWebhook.mutate(id, {
      onSuccess: (data) => {
        toast({
          description: data.success
            ? t("webhooks.testSuccess" as any)
            : t("webhooks.testFailed" as any),
        });
      },
      onError: () => {
        toast({
          description: t("webhooks.testFailed" as any),
          variant: "destructive",
        });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="glass-card-static p-3">
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--crm-text-muted)]" />
        </div>
      </div>
    );
  }

  const wh: WebhookDetail | undefined = webhook;

  if (!wh) {
    return (
      <div className="glass-card-static p-3 text-center">
        <p className="text-sm text-[var(--crm-text-muted)]">
          Webhook not found
        </p>
        <Button
          variant="ghost"
          onClick={onBack}
          className="mt-2 text-[#10B981]"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> {t("common.back")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-[var(--crm-text-muted)] hover:text-[var(--crm-text-primary)] h-8 w-8 p-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-[var(--crm-text-primary)] truncate">
              {wh.name}
            </h3>
            <Badge
              className={`text-[10px] px-1.5 py-0 ${
                wh.active
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                  : "bg-red-500/10 text-red-500 border-red-500/20"
              }`}
            >
              {wh.active
                ? t("webhooks.active" as any)
                : t("webhooks.inactive" as any)}
            </Badge>
          </div>
          <p className="text-xs text-[var(--crm-text-muted)] truncate">
            {wh.url}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={testWebhook.isPending}
          className="border-[var(--crm-border)] text-[var(--crm-text-secondary)] hover:text-[#10B981] hover:border-[#10B981]"
        >
          {testWebhook.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
          ) : (
            <Send className="w-3.5 h-3.5 mr-1.5" />
          )}
          {t("webhooks.test" as any)}
        </Button>
      </div>

      {/* Events */}
      <div className="glass-card-static p-4">
        <Label className="text-xs text-[var(--crm-text-secondary)] mb-2 block">
          {t("webhooks.events" as any)}
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {wh.events.map((ev) => (
            <Badge
              key={ev}
              variant="outline"
              className="text-[10px] text-[var(--crm-text-muted)] border-[var(--crm-border)]"
            >
              {t(`webhooks.event.${ev}` as any)}
            </Badge>
          ))}
        </div>
      </div>

      {/* Delivery logs */}
      <div className="glass-card-static p-4">
        <Label className="text-xs text-[var(--crm-text-secondary)] mb-3 block">
          {t("webhooks.logs" as any)}
        </Label>
        {wh.logs.length === 0 ? (
          <p className="text-xs text-[var(--crm-text-muted)] text-center py-4">
            {t("webhooks.noLogs" as any)}
          </p>
        ) : (
          <div className="border border-[var(--crm-border)] rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[var(--crm-bg-subtle)]">
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--crm-text-secondary)] px-3 py-2">
                    {t("webhooks.status" as any)}
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--crm-text-secondary)] px-3 py-2">
                    {t("webhooks.events" as any)}
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--crm-text-secondary)] px-3 py-2">
                    HTTP
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--crm-text-secondary)] px-3 py-2">
                    {t("webhooks.duration" as any)}
                  </th>
                  <th className="text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--crm-text-secondary)] px-3 py-2">
                    {t("webhooks.attempt" as any)}
                  </th>
                  <th className="text-right text-[10px] font-semibold uppercase tracking-wide text-[var(--crm-text-secondary)] px-3 py-2">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {wh.logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-t border-[var(--crm-border-subtle)]"
                  >
                    <td className="px-3 py-2">
                      {log.success ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-500" />
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-[var(--crm-text-primary)]">
                      {t(`webhooks.event.${log.event}` as any)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-xs font-mono ${log.statusCode && log.statusCode < 400 ? "text-emerald-500" : "text-red-500"}`}
                      >
                        {log.statusCode ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-[var(--crm-text-muted)]">
                      {log.duration ? `${log.duration}ms` : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-[var(--crm-text-muted)]">
                      #{log.attempt}
                    </td>
                    <td className="px-3 py-2 text-xs text-[var(--crm-text-muted)] text-right">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
