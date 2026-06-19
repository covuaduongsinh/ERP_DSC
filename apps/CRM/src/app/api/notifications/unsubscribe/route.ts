import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyNotifUnsubscribeToken } from "@/lib/notifications/unsubscribe-token";

// Event type labels (Vietnamese)
const EVENT_LABELS: Record<string, string> = {
  "quote.accepted": "Báo giá được chấp nhận",
  "quote.rejected": "Báo giá bị từ chối",
  "quote.expiring": "Báo giá sắp hết hạn",
  "ticket.created": "Ticket mới",
  "ticket.assigned": "Ticket được gán cho bạn",
  "order.status_changed": "Đơn hàng thay đổi trạng thái",
  "campaign.sent": "Chiến dịch gửi xong",
};

// GET /api/notifications/unsubscribe?token=xxx&type=xxx
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return new NextResponse(renderHtml("Lỗi", "Token không hợp lệ."), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const decoded = verifyNotifUnsubscribeToken(token);
  if (!decoded) {
    return new NextResponse(
      renderHtml("Lỗi", "Token không hợp lệ hoặc đã hết hạn."),
      {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  const { userId, eventType } = decoded;

  // Disable email for this event type
  await prisma.notificationPreference.upsert({
    where: {
      userId_eventType: { userId, eventType },
    },
    create: {
      userId,
      eventType,
      inApp: true,
      email: false,
    },
    update: {
      email: false,
    },
  });

  const eventLabel = EVENT_LABELS[eventType] || eventType;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3018";

  return new NextResponse(
    renderHtml(
      "Đã tắt thông báo email",
      `Đã tắt thông báo email cho "<strong>${eventLabel}</strong>".<br><br>Bạn có thể bật lại trong <strong>Cài đặt → Thông báo</strong>.`,
      `${appUrl}/settings`,
    ),
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}

function renderHtml(title: string, message: string, backUrl?: string): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — Cờ vua Dương Sinh CRM</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #111827;
      color: #F9FAFB;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #1F2937;
      border: 1px solid #374151;
      border-radius: 12px;
      padding: 40px;
      max-width: 480px;
      text-align: center;
    }
    h1 { font-size: 20px; margin-bottom: 16px; color: #10B981; }
    p { font-size: 14px; line-height: 1.6; color: #D1D5DB; margin-bottom: 24px; }
    a.btn {
      display: inline-block;
      background: #10B981;
      color: white;
      text-decoration: none;
      padding: 10px 24px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
    }
    a.btn:hover { background: #059669; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    ${backUrl ? `<a href="${backUrl}" class="btn">Quay lại Cờ vua Dương Sinh CRM</a>` : ""}
  </div>
</body>
</html>`;
}
