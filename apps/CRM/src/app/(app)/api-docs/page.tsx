"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";
import { openApiSpec } from "@/lib/api-docs/openapi";

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

export default function ApiDocsPage() {
  return (
    <div className="max-w-7xl mx-auto p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-[var(--crm-text-primary)]">
          API Documentation
        </h1>
        <p className="text-sm text-[var(--crm-text-muted)] mt-1">
          OpenAPI 3.0 specification for Cờ vua Dương Sinh CRM
        </p>
      </div>
      <div className="swagger-wrapper rounded-lg border border-[var(--crm-border)] overflow-hidden bg-white">
        <SwaggerUI spec={openApiSpec} />
      </div>
    </div>
  );
}
