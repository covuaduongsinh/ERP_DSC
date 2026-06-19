"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password.length < 8) {
      setError(t("auth.passwordTooShort"));
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError(t("auth.passwordMismatch"));
      setLoading(false);
      return;
    }

    try {
      const supabase = createClient();

      // 1. Create Supabase auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          },
        },
      });

      if (authError) {
        if (authError.message.includes("already registered")) {
          setError(t("auth.emailTaken"));
        } else {
          setError(authError.message);
        }
        return;
      }

      if (!authData.user) {
        setError("Không thể tạo tài khoản. Vui lòng thử lại.");
        return;
      }

      // 2. Create User record in Prisma DB via API
      const syncRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: authData.user.id,
          email,
          name: `${firstName} ${lastName}`.trim(),
        }),
      });

      if (!syncRes.ok) {
        const syncData = await syncRes.json();
        setError(syncData.error || "Không thể tạo hồ sơ người dùng");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(t("auth.connectionError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--crm-bg-page)] px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center mb-8">
          <span className="text-xl font-bold text-[var(--crm-text-primary)] font-[family-name:var(--font-heading)]">
            Cờ vua Dương Sinh CRM
          </span>
        </div>

        {/* Card */}
        <div className="bg-[var(--crm-bg-card)] border border-[var(--crm-border)] rounded-lg p-6">
          <h1 className="text-lg font-semibold text-[var(--crm-text-primary)] mb-1">
            {t("auth.register")}
          </h1>
          <p className="text-sm text-[var(--crm-text-secondary)] mb-4">
            Tạo tài khoản mới để bắt đầu
          </p>

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label
                  htmlFor="firstName"
                  className="text-[var(--crm-text-secondary)] text-sm"
                >
                  {t("auth.lastName")}
                </Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="Nguyễn"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="bg-[var(--crm-bg-page)] border-[var(--crm-border)] text-[var(--crm-text-primary)] placeholder:text-[var(--crm-text-muted)] focus:border-[#10B981] focus:ring-[#10B981]/20"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="lastName"
                  className="text-[var(--crm-text-secondary)] text-sm"
                >
                  {t("auth.firstName")}
                </Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Quỳnh"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="bg-[var(--crm-bg-page)] border-[var(--crm-border)] text-[var(--crm-text-primary)] placeholder:text-[var(--crm-text-muted)] focus:border-[#10B981] focus:ring-[#10B981]/20"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-[var(--crm-text-secondary)] text-sm"
              >
                {t("common.email")}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-[var(--crm-bg-page)] border-[var(--crm-border)] text-[var(--crm-text-primary)] placeholder:text-[var(--crm-text-muted)] focus:border-[#10B981] focus:ring-[#10B981]/20"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-[var(--crm-text-secondary)] text-sm"
              >
                {t("auth.password")}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder={t("auth.passwordMinLength")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="bg-[var(--crm-bg-page)] border-[var(--crm-border)] text-[var(--crm-text-primary)] placeholder:text-[var(--crm-text-muted)] focus:border-[#10B981] focus:ring-[#10B981]/20"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="confirmPassword"
                className="text-[var(--crm-text-secondary)] text-sm"
              >
                {t("auth.confirmPassword")}
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder={t("auth.confirmPasswordPlaceholder")}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className="bg-[var(--crm-bg-page)] border-[var(--crm-border)] text-[var(--crm-text-primary)] placeholder:text-[var(--crm-text-muted)] focus:border-[#10B981] focus:ring-[#10B981]/20"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#10B981] hover:bg-[#34D399] text-white font-medium"
            >
              {loading ? t("common.processing") : t("auth.register")}
            </Button>
          </form>

          <p className="text-center text-sm text-[var(--crm-text-secondary)] mt-4">
            {t("auth.haveAccount")}{" "}
            <Link
              href="/login"
              className="text-[#10B981] hover:text-[#34D399] font-medium"
            >
              {t("auth.login")}
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-[var(--crm-text-muted)] mt-4">
          Cờ vua Dương Sinh CRM &mdash; Quản lý khách hàng thông minh
        </p>
      </div>
    </div>
  );
}
