/**
 * Next.js instrumentation — chạy MỘT LẦN khi server CRM khởi động.
 * Bật NATS event subscriber để đồng bộ ngược dữ liệu vận hành từ CLB (clb.>)
 * về CRM (view 360° trên Contact phụ huynh).
 *
 * Guard:
 *  - Chỉ chạy ở Node runtime (không phải Edge) — `nats` dùng net/tls của Node.
 *  - Chỉ chạy khi có NATS_URL (dev không bật NATS → bỏ qua, không lỗi).
 *  - Dynamic import @vierp/events ⇒ KHÔNG lọt vào bundle Edge/client.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.NATS_URL) {
    console.log("[CRM] NATS_URL chưa set — bỏ qua event subscriber.");
    return;
  }

  try {
    const { ensureStreams } = await import("@vierp/events");
    const { startCrmEventHandlers } =
      await import("./lib/erp-integration/events");
    // Đảm bảo các JetStream stream (gồm VIERP_CLB) tồn tại trước khi gắn consumer.
    await ensureStreams();
    await startCrmEventHandlers();
  } catch (err) {
    // Không để lỗi event handler làm sập app — log để điều tra.
    console.error("[CRM] Không khởi động được event subscriber:", err);
  }
}
