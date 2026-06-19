import type { CollectionAfterChangeHook } from 'payload';
import type { TuitionPaymentReceived } from '@vierp/events';
import { publishCovuaEvent } from './nats';

/**
 * afterChange hook cho Payments: khi TẠO MỚI phiếu thu học phí → phát
 * `covua.payment.received` lên NATS để Accounting ghi nhận doanh thu (bút toán).
 *
 * Chỉ phát trên `create` (idempotent, tránh đăng bút toán trùng khi sửa). Lỗi
 * publish được nuốt trong publishCovuaEvent ⇒ không ảnh hưởng ghi Payments.
 */
export const publishPaymentReceived: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  if (operation !== 'create') return doc;

  const tuition = Number(doc.hocPhi) || 0;
  const book = Number(doc.tienSach) || 0;
  const other = Number(doc.muaKhac) || 0;
  const total = tuition + book + other;
  if (total <= 0) return doc;

  const student = doc.student as { id?: number | string } | number | string | null;
  const studentId =
    student && typeof student === 'object' ? student.id : student;

  const data: TuitionPaymentReceived = {
    paymentId: String(doc.id),
    code: doc.code ? String(doc.code) : undefined,
    studentId: String(studentId ?? ''),
    paymentDate: doc.ngayNop
      ? new Date(doc.ngayNop).toISOString()
      : new Date().toISOString(),
    tuitionAmount: tuition,
    bookAmount: book,
    otherAmount: other,
    totalAmount: total,
    currency: 'VND',
    location: doc.coSo ? String(doc.coSo) : undefined,
    status: doc.tinhTrang ? String(doc.tinhTrang) : undefined,
  };

  const userId =
    req?.user && 'id' in req.user && req.user.id != null
      ? String(req.user.id)
      : 'system';

  await publishCovuaEvent('covua.payment.received', data, { userId });
  return doc;
};
