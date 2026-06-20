"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { isValidVietnamesePhone } from "@/lib/utils/phone";

type LeadType = "consultation" | "trial";
type Source = "google" | "facebook" | "gioi_thieu" | "khac";

export default function NewAdmissionLeadPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    type: "consultation",
    fullName: "",
    phone: "",
    email: "",
    childName: "",
    childAge: "",
    interestedLocationId: "",
    interestedClassId: "",
    trialDate: "",
    source: "",
    note: "",
  });

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim()) {
      toast({ title: "Thiếu họ tên phụ huynh", variant: "destructive" });
      return;
    }
    if (!isValidVietnamesePhone(form.phone)) {
      toast({ title: "Số điện thoại không hợp lệ", variant: "destructive" });
      return;
    }

    const payload = {
      type: form.type as LeadType,
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      childName: form.childName.trim() || null,
      childAge: form.childAge.trim() || null,
      interestedLocationId: form.interestedLocationId.trim() || null,
      interestedClassId: form.interestedClassId.trim() || null,
      trialDate: form.trialDate ? new Date(form.trialDate).toISOString() : null,
      source: (form.source || undefined) as Source | undefined,
      note: form.note.trim() || null,
    };

    setSubmitting(true);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Không thể tạo lead");
      toast({
        title: "Đã tạo lead tuyển sinh",
        description: body.reusedContact
          ? "Đã gắn vào phụ huynh sẵn có (trùng SĐT)."
          : undefined,
      });
      router.push("/admissions/leads");
    } catch (err: any) {
      toast({
        title: "Lỗi",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell
      title="Thêm lead tuyển sinh"
      description="Tiếp nhận lead tư vấn / đăng ký học thử"
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href="/admissions/leads">
            <ArrowLeft className="h-4 w-4" />
            Hủy
          </Link>
        </Button>
      }
    >
      <form onSubmit={handleSubmit}>
        <Card className="bg-[var(--crm-bg-card)] border-[var(--crm-border)] max-w-2xl">
          <CardContent className="p-5 space-y-4">
            <div className="space-y-2">
              <Label className="text-[var(--crm-text-secondary)]">
                Loại lead
              </Label>
              <Select value={form.type} onValueChange={(v) => set("type", v)}>
                <SelectTrigger className="bg-[var(--crm-bg-input)] border-[var(--crm-border)] text-[var(--crm-text-primary)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--crm-bg-hover)] border-[var(--crm-border)]">
                  <SelectItem
                    value="consultation"
                    className="text-[var(--crm-text-primary)]"
                  >
                    Tư vấn
                  </SelectItem>
                  <SelectItem
                    value="trial"
                    className="text-[var(--crm-text-primary)]"
                  >
                    Đăng ký học thử
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Họ tên phụ huynh *">
                <Input
                  value={form.fullName}
                  onChange={(e) => set("fullName", e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className="bg-[var(--crm-bg-input)] border-[var(--crm-border)] text-[var(--crm-text-primary)]"
                />
              </Field>
              <Field label="Số điện thoại *">
                <Input
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="0901234567"
                  className="bg-[var(--crm-bg-input)] border-[var(--crm-border)] text-[var(--crm-text-primary)]"
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  className="bg-[var(--crm-bg-input)] border-[var(--crm-border)] text-[var(--crm-text-primary)]"
                />
              </Field>
              <Field label="Nguồn">
                <Select
                  value={form.source}
                  onValueChange={(v) => set("source", v)}
                >
                  <SelectTrigger className="bg-[var(--crm-bg-input)] border-[var(--crm-border)] text-[var(--crm-text-primary)]">
                    <SelectValue placeholder="Chọn nguồn" />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--crm-bg-hover)] border-[var(--crm-border)]">
                    <SelectItem
                      value="google"
                      className="text-[var(--crm-text-primary)]"
                    >
                      Google
                    </SelectItem>
                    <SelectItem
                      value="facebook"
                      className="text-[var(--crm-text-primary)]"
                    >
                      Facebook
                    </SelectItem>
                    <SelectItem
                      value="gioi_thieu"
                      className="text-[var(--crm-text-primary)]"
                    >
                      Giới thiệu
                    </SelectItem>
                    <SelectItem
                      value="khac"
                      className="text-[var(--crm-text-primary)]"
                    >
                      Khác
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tên con">
                <Input
                  value={form.childName}
                  onChange={(e) => set("childName", e.target.value)}
                  className="bg-[var(--crm-bg-input)] border-[var(--crm-border)] text-[var(--crm-text-primary)]"
                />
              </Field>
              <Field label="Tuổi con">
                <Input
                  value={form.childAge}
                  onChange={(e) => set("childAge", e.target.value)}
                  placeholder="Ví dụ: 8"
                  className="bg-[var(--crm-bg-input)] border-[var(--crm-border)] text-[var(--crm-text-primary)]"
                />
              </Field>
              <Field label="Cơ sở quan tâm">
                <Input
                  value={form.interestedLocationId}
                  onChange={(e) => set("interestedLocationId", e.target.value)}
                  placeholder="Mã/tên cơ sở (tùy chọn)"
                  className="bg-[var(--crm-bg-input)] border-[var(--crm-border)] text-[var(--crm-text-primary)]"
                />
              </Field>
              <Field label="Lớp quan tâm">
                <Input
                  value={form.interestedClassId}
                  onChange={(e) => set("interestedClassId", e.target.value)}
                  placeholder="Mã/tên lớp (tùy chọn)"
                  className="bg-[var(--crm-bg-input)] border-[var(--crm-border)] text-[var(--crm-text-primary)]"
                />
              </Field>
              <Field label="Ngày học thử (nếu có)">
                <Input
                  type="datetime-local"
                  value={form.trialDate}
                  onChange={(e) => set("trialDate", e.target.value)}
                  className="bg-[var(--crm-bg-input)] border-[var(--crm-border)] text-[var(--crm-text-primary)]"
                />
              </Field>
            </div>

            <Field label="Ghi chú">
              <Textarea
                value={form.note}
                onChange={(e) => set("note", e.target.value)}
                rows={3}
                className="bg-[var(--crm-bg-input)] border-[var(--crm-border)] text-[var(--crm-text-primary)]"
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <Button asChild variant="outline" type="button">
                <Link href="/admissions/leads">Hủy</Link>
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Tạo lead
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </PageShell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-[var(--crm-text-secondary)]">{label}</Label>
      {children}
    </div>
  );
}
