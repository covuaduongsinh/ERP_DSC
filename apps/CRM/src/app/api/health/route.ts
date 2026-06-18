import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    app: "crm",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
