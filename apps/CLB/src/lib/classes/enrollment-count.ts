import type { FieldHook } from 'payload'

/**
 * Virtual field `siSoHienTai`: đếm số học viên ĐANG HỌC của lớp tại thời điểm đọc.
 * Nguồn sự thật = Enrollments có dangHoc=true (khớp lib/operations/roster.ts).
 * `overrideAccess: true`: đếm đúng tổng (đã lọc cứng theo classId mà người gọi
 * được phép đọc lớp) — không leak danh tính HV, chỉ trả về con số.
 */
export const countActiveEnrollments: FieldHook = async ({ req, data }) => {
  const classId = data?.id
  if (typeof classId !== 'number') return 0

  const { totalDocs } = await req.payload.count({
    collection: 'enrollments',
    where: {
      and: [{ class: { equals: classId } }, { dangHoc: { equals: true } }],
    },
    req,
    overrideAccess: true,
  })
  return totalDocs
}
