import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthError } from "@/lib/auth/get-current-user";
import { requireRole, isErrorResponse } from "@/lib/auth/rbac";
import { Unauthorized, NotFound, handleApiError } from "@/lib/api/errors";
import { apiSuccess } from "@/lib/api/response";
import { deliverWebhook } from "@/lib/webhooks/delivery";

// POST /api/webhooks/[id]/test — Send test webhook
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const result = await requireRole(["ADMIN"]);
    if (isErrorResponse(result)) return result;
    const user = result;

    const webhook = await prisma.webhook.findUnique({
      where: { id: params.id },
    });
    if (!webhook)
      return handleApiError(NotFound("Webhook"), "/api/webhooks/[id]/test");

    const testPayload = {
      event: "webhook.test",
      timestamp: new Date().toISOString(),
      actor: { id: user.id, type: "user", name: user.name || "Admin" },
      data: {
        message: "This is a test webhook delivery from Cờ vua Dương Sinh CRM",
      },
    };

    const delivery = await deliverWebhook(webhook, "webhook.test", testPayload);

    return apiSuccess({
      success: delivery.success,
      statusCode: delivery.statusCode,
      duration: delivery.duration,
      error: delivery.error,
    });
  } catch (error) {
    if (error instanceof AuthError)
      return handleApiError(
        Unauthorized(error.message),
        "/api/webhooks/[id]/test",
      );
    return handleApiError(error, "/api/webhooks/[id]/test");
  }
}
