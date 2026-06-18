import { NextResponse } from "next/server";

// Prometheus metrics endpoint
// In production, import from @vierp/metrics
// For now, provide a basic text/plain response with metric stubs

export async function GET() {
  const metrics = [
    "# HELP vierp_http_requests_total Total HTTP requests",
    "# TYPE vierp_http_requests_total counter",
    'vierp_http_requests_total{app="hrm",method="GET",status="200"} 0',
    "",
    "# HELP vierp_http_request_duration_seconds HTTP request duration",
    "# TYPE vierp_http_request_duration_seconds histogram",
    'vierp_http_request_duration_seconds_bucket{app="hrm",le="0.1"} 0',
    "",
    "# HELP vierp_app_info Application information",
    "# TYPE vierp_app_info gauge",
    'vierp_app_info{app="hrm",version="1.0.0"} 1',
  ].join("\n");

  return new NextResponse(metrics, {
    headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8" },
  });
}
