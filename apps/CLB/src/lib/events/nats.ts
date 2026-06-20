import type { JetStreamClient, NatsConnection } from 'nats'

/**
 * Publisher NATS cho CLB → ERP (Pha 4 đồng bộ dữ liệu).
 *
 * Thiết kế:
 *  - `nats` được import ĐỘNG (dynamic import) trong hàm async ⇒ KHÔNG lọt vào
 *    client bundle của Next (nats dùng net/tls của Node).
 *  - Tự tạo JetStream stream `VIERP_CLB` (subjects `clb.>`) — KHÔNG dựa vào
 *    ensureStreams của @vierp/events (vốn cấu hình subject `vierp.*` không khớp).
 *  - No-op khi thiếu NATS_URL (vd môi trường dev không bật NATS) ⇒ không chặn
 *    nghiệp vụ.
 *  - Fire-and-forget + try/catch ⇒ lỗi NATS KHÔNG làm hỏng ghi dữ liệu ở Payload.
 */

const CLB_STREAM = 'VIERP_CLB'
const CLB_SUBJECTS = ['clb.>']

let nc: NatsConnection | null = null
let js: JetStreamClient | null = null

async function getJetStream(): Promise<JetStreamClient | null> {
  const url = process.env.NATS_URL
  if (!url) return null // NATS chưa cấu hình → bỏ qua publish

  if (js && nc && !nc.isClosed()) return js

  const { connect } = await import('nats')
  nc = await connect({
    servers: url,
    name: `erp-${process.env.MODULE_NAME || 'clb'}`,
    reconnect: true,
    maxReconnectAttempts: -1,
    reconnectTimeWait: 2000,
  })

  // Đảm bảo stream clb.> tồn tại (idempotent).
  const jsm = await nc.jetstreamManager()
  try {
    await jsm.streams.info(CLB_STREAM)
  } catch {
    await jsm.streams.add({
      name: CLB_STREAM,
      subjects: CLB_SUBJECTS,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      retention: 'limits' as any,
      max_age: 7 * 24 * 60 * 60 * 1_000_000_000, // 7 ngày (ns)
      max_bytes: 1024 * 1024 * 256, // 256MB
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      storage: 'file' as any,
      num_replicas: 1,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      discard: 'old' as any,
    })
    console.log(`[clb-events] Created JetStream stream ${CLB_STREAM}`)
  }

  js = nc.jetstream()
  return js
}

export type ClbEventEnvelope<T> = {
  id: string
  type: string
  source: string
  timestamp: string
  tenantId: string
  userId: string
  data: T
}

/**
 * Phát một sự kiện CLB lên NATS JetStream (subject dạng `clb.*`).
 * Envelope khớp định dạng của @vierp/events để subscriber ERP đọc thống nhất.
 */
export async function publishClbEvent<T>(
  subject: string,
  data: T,
  ctx: { userId?: string; tenantId?: string } = {},
): Promise<void> {
  try {
    const jetstream = await getJetStream()
    if (!jetstream) return // no NATS → no-op

    const { StringCodec } = await import('nats')
    const sc = StringCodec()
    const envelope: ClbEventEnvelope<T> = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
      type: subject,
      source: 'clb',
      timestamp: new Date().toISOString(),
      tenantId: ctx.tenantId || 'duongsinh',
      userId: ctx.userId || 'system',
      data,
    }

    await jetstream.publish(subject, sc.encode(JSON.stringify(envelope)), {
      msgID: envelope.id, // khử trùng lặp (dedupe) phía JetStream
    })
  } catch (err) {
    // Fire-and-forget: KHÔNG để lỗi NATS làm hỏng ghi nghiệp vụ.
    console.error('[clb-events] publish failed:', (err as Error).message)
  }
}
