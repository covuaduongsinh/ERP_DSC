import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { rateLimitAuth } from "@/lib/api/rate-limit";
import { BadRequest, RateLimited, handleApiError } from "@/lib/api/errors";
import { apiSuccess, apiCreated } from "@/lib/api/response";
import { sanitizeString } from "@/lib/api/sanitize";
import { logger } from "@/lib/logger";

// POST /api/auth/register — Sync Supabase auth user to Prisma DB
export async function POST(req: NextRequest) {
  try {
    // Rate limit by IP
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimitAuth(ip);
    if (!rl.success) throw RateLimited(rl.resetAt);

    const body = await req.json();
    const { id, email, name } = body;

    if (!id || !email) {
      throw BadRequest("id và email là bắt buộc");
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { id } });
    if (existing) {
      return apiSuccess(existing);
    }

    const sanitizedName = name ? sanitizeString(name, 200) : null;

    const user = await prisma.user.create({
      data: {
        id,
        email,
        name: sanitizedName,
        role: "MEMBER",
      },
    });

    logger.audit("user.register", user.id, { email });

    // Send welcome email (fire-and-forget)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3018";
    sendEmail(
      {
        to: email,
        subject: "Chào mừng đến với Cờ vua Dương Sinh CRM!",
        template: "welcome",
        data: {
          userName: sanitizedName || email,
          loginUrl: `${appUrl}/login`,
        },
      },
      user.id,
    ).catch((err) => {
      logger.error(
        "Failed to send welcome email",
        err instanceof Error ? err : null,
        { userId: user.id },
      );
    });

    return apiCreated(user);
  } catch (error) {
    return handleApiError(error, "/api/auth/register");
  }
}
