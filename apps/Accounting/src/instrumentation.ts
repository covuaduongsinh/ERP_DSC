/**
 * Next.js instrumentation — chạy MỘT LẦN khi server Accounting khởi động.
 * Dùng để bật NATS event subscriber (auto-journal từ các module ERP, gồm CoVua).
 *
 * Guard:
 *  - Chỉ chạy ở Node runtime (không phải Edge).
 *  - Chỉ chạy khi có NATS_URL (môi trường dev không bật NATS → bỏ qua, không lỗi).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.NATS_URL) {
    console.log("[ACCOUNTING] NATS_URL chưa set — bỏ qua event subscriber.");
    return;
  }

  try {
    const { ensureStreams } = await import("@vierp/events");
    const { startAccountingEventHandlers } = await import("./lib/integration");
    // Đảm bảo các JetStream stream (gồm VIERP_COVUA) tồn tại trước khi gắn consumer.
    await ensureStreams();
    await startAccountingEventHandlers();
  } catch (err) {
    // Không để lỗi event handler làm sập app — log để điều tra.
    console.error("[ACCOUNTING] Không khởi động được event subscriber:", err);
  }
}
