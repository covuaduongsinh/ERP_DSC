import type { Metadata } from "next";
import { PortalNav } from "./portal-nav";

export const metadata: Metadata = {
  title: "Cờ vua Dương Sinh CRM — Cổng khách hàng",
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="light min-h-screen bg-gray-50">
      {/* Portal header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-gray-900">
                Cờ vua Dương Sinh CRM
              </span>
              <span className="text-xs text-gray-400 border-l border-gray-200 pl-3 ml-1">
                Cổng khách hàng
              </span>
            </div>
            <PortalNav />
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
