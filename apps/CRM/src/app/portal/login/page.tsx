"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

const ERROR_MESSAGES: Record<string, string> = {
  expired: "Link đăng nhập đã hết hạn hoặc đã được sử dụng. Vui lòng thử lại.",
  invalid: "Link đăng nhập không hợp lệ.",
  failed: "Có lỗi xảy ra. Vui lòng thử lại.",
};

function LoginForm() {
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    errorParam ? ERROR_MESSAGES[errorParam] || "" : "",
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/portal/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.status === 429) {
        setError("Quá nhiều yêu cầu. Vui lòng thử lại sau.");
        return;
      }
      setSent(true);
    } catch {
      setError("Không thể kết nối. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <div className="text-center mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Đăng nhập</h1>
        <p className="text-sm text-gray-500 mt-1">
          Cổng khách hàng Cờ vua Dương Sinh CRM
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {sent ? (
        <div className="text-center py-4">
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#10B981"
              strokeWidth="2"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="text-sm text-gray-700">Kiểm tra email của bạn</p>
          <p className="text-xs text-gray-500 mt-1">
            Chúng tôi đã gửi link đăng nhập đến {email}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@congty.com"
            required
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-gray-900 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          />
          <button
            type="submit"
            disabled={loading || !email}
            className="w-full mt-4 py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 transition-colors"
          >
            {loading ? "Đang gửi..." : "Gửi link đăng nhập"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function PortalLoginPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-sm">
        <Suspense
          fallback={
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 h-64 animate-pulse" />
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
