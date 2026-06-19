import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { rateLimit } from "@/lib/api/rate-limit";
import { sendEmail } from "@/lib/email";
import { portalLoginSchema } from "@/lib/validations/portal";

// POST /api/portal/auth — Request magic link
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = portalLoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Email không hợp lệ" },
        { status: 400 },
      );
    }

    const trimmedEmail = parsed.data.email.trim().toLowerCase();

    // Rate limit: 5 requests per 60s per email
    const rl = rateLimit({
      key: `portal-auth:${trimmedEmail}`,
      limit: 5,
      window: 60,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: "Quá nhiều yêu cầu. Vui lòng thử lại sau." },
        { status: 429 },
      );
    }

    const portalUser = await prisma.portalUser.findUnique({
      where: { email: trimmedEmail },
      include: { company: { select: { id: true, name: true } } },
    });

    if (!portalUser || !portalUser.isActive) {
      // Don't reveal if user exists
      return NextResponse.json({
        message: "If the email exists, a magic link has been sent.",
      });
    }

    const magicToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = req.headers.get("user-agent") || null;

    await prisma.portalSession.create({
      data: {
        token: randomBytes(32).toString("hex"),
        magicToken,
        expiresAt,
        portalUserId: portalUser.id,
        ipAddress: ip,
        userAgent,
      },
    });

    const magicLinkUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/verify?token=${magicToken}`;

    // Send magic link email via Resend
    const emailResult = await sendEmail({
      to: portalUser.email,
      subject: "Đăng nhập Portal — Cờ vua Dương Sinh CRM",
      template: "portal-magic-link",
      data: {
        customerName:
          [portalUser.firstName, portalUser.lastName]
            .filter(Boolean)
            .join(" ") || portalUser.email,
        magicLinkUrl,
        expiresIn: "15 phút",
      },
    });

    if (!emailResult.success) {
      console.error(
        "[Portal Auth] Failed to send magic link email:",
        emailResult.error,
      );
    }

    return NextResponse.json({
      message: "If the email exists, a magic link has been sent.",
    });
  } catch (error) {
    console.error("POST /api/portal/auth error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 },
    );
  }
}
