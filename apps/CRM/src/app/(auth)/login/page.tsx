"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        if (authError.message.includes("Invalid login credentials")) {
          setError(t("auth.invalidCredentials"));
        } else {
          setError(authError.message);
        }
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
            {t("auth.login")}
          </h1>
          <p className="text-sm text-[var(--crm-text-secondary)] mb-4">
            {t("auth.loginSubtitle")}
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
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
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="text-[var(--crm-text-secondary)] text-sm"
                >
                  {t("auth.password")}
                </Label>
                <span className="text-xs text-[var(--crm-text-muted)] cursor-not-allowed">
                  {t("auth.forgotPassword")}
                </span>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-[var(--crm-bg-page)] border-[var(--crm-border)] text-[var(--crm-text-primary)] placeholder:text-[var(--crm-text-muted)] focus:border-[#10B981] focus:ring-[#10B981]/20"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#10B981] hover:bg-[#34D399] text-white font-medium"
            >
              {loading ? t("common.processing") : t("auth.login")}
            </Button>
          </form>

          <p className="text-center text-sm text-[var(--crm-text-secondary)] mt-4">
            {t("auth.noAccount")}{" "}
            <Link
              href="/register"
              className="text-[#10B981] hover:text-[#34D399] font-medium"
            >
              {t("auth.register")}
            </Link>
          </p>
        </div>

        {/* Demo accounts */}
        {process.env.NODE_ENV !== "production" && (
          <div className="mt-4 bg-[var(--crm-bg-card)] border border-[var(--crm-border)] rounded-lg p-4">
            <p className="text-xs font-medium text-[var(--crm-text-secondary)] mb-2">
              Demo accounts
            </p>
            <div className="space-y-1.5">
              {[
                {
                  label: "Admin",
                  email: "admin@your-domain.com",
                  password: "Admin@123456",
                },
                {
                  label: "Manager",
                  email: "manager@your-domain.com",
                  password: "Manager@123456",
                },
                {
                  label: "Member",
                  email: "member@your-domain.com",
                  password: "Member@123456",
                },
              ].map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword(acc.password);
                  }}
                  className="w-full flex items-center justify-between text-xs px-3 py-1.5 rounded border border-[var(--crm-border)] hover:border-[#10B981] hover:bg-[#10B981]/5 text-[var(--crm-text-secondary)] transition-colors cursor-pointer"
                >
                  <span className="font-medium">{acc.label}</span>
                  <span className="text-[var(--crm-text-muted)]">
                    {acc.email}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-[var(--crm-text-muted)] mt-4">
          Cờ vua Dương Sinh CRM &mdash; Quản lý khách hàng thông minh
        </p>
      </div>
    </div>
  );
}
