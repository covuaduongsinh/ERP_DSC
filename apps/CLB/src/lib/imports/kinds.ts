/**
 * Đăng ký TRUNG TÂM cho luồng Import CSV trong /admin.
 *
 * Mỗi "loại import" (collection) khai báo một lần ở đây: khóa định danh
 * idempotent, hướng dẫn cột, và file mẫu để tải. Mọi nơi khác (Server Action,
 * route tải mẫu, các admin view, nav links) đều suy ra từ registry này để không
 * lệch nhau khi thêm/sửa loại.
 *
 * 5 loại theo yêu cầu: Học viên, Điểm danh/Nhận xét buổi, Đánh giá định kỳ,
 * Giáo viên, Thanh toán.
 */

export type ImportKind =
  | 'students'
  | 'attendance'
  | 'progress-reports'
  | 'coaches'
  | 'payments'
  | 'classes'
  | 'enrollments'

export const IMPORT_KINDS: ImportKind[] = [
  'students',
  'attendance',
  'progress-reports',
  'coaches',
  'payments',
  'classes',
  'enrollments',
]

export function isImportKind(value: unknown): value is ImportKind {
  return typeof value === 'string' && (IMPORT_KINDS as string[]).includes(value)
}

export type ImportKindMeta = {
  kind: ImportKind
  /** Đoạn path dưới /admin (vd /admin/nhap-hoc-vien). */
  slug: string
  /** Nhãn ngắn cho nav + tiêu đề trang. */
  navLabel: string
  title: string
  description: string
  /** Mô tả khóa chống trùng (hiển thị cho nhân viên). */
  keyDescription: string
  /** Gạch đầu dòng hướng dẫn từng cột. */
  columnGuide: string[]
  template: {
    fileName: string
    headers: string[]
    sampleRows: string[][]
  }
}

export const IMPORT_KIND_META: Record<ImportKind, ImportKindMeta> = {
  students: {
    kind: 'students',
    slug: 'nhap-hoc-vien',
    navLabel: 'Nhập học viên',
    title: 'Nhập học viên',
    description:
      'Tải sổ học viên từ Excel/CSV, xem trước phân loại (tạo mới / cập nhật / lỗi) rồi mới xác nhận ghi. Nhập lại cùng file KHÔNG tạo trùng — khớp theo họ tên (chuẩn hóa NFC, giữ dấu). Trùng tên y hệt trong DB sẽ báo để soát tay, không ghi đè ngầm.',
    keyDescription: 'Khóa chống trùng: họ tên (chuẩn hóa NFC, giữ dấu).',
    columnGuide: [
      'ho_ten — bắt buộc; khóa định danh (giữ dấu, không phân biệt hoa/thường)',
      'nick — biệt danh / ghi chú nhận diện (tùy chọn)',
      'co_so — tên cơ sở; khớp với danh sách Locations (tùy chọn)',
      'ngay_sinh — ngày sinh học viên YYYY-MM-DD hoặc DD/MM/YYYY (tùy chọn)',
      'ho_ten_ph — họ tên phụ huynh (tùy chọn)',
      'sdt_ph — SĐT phụ huynh; nếu hợp lệ sẽ tạo/nối phụ huynh (tùy chọn, lưu dạng text)',
    ],
    template: {
      fileName: 'mau-hoc-vien.csv',
      headers: ['ho_ten', 'nick', 'co_so', 'ngay_sinh', 'ho_ten_ph', 'sdt_ph'],
      sampleRows: [
        [
          'Nguyễn Văn An',
          'con cô Lan, 8 tuổi',
          'Kim Liên',
          '2017-05-20',
          'Nguyễn Thị Lan',
          '0912345678',
        ],
        ['Trần Bảo Minh', '', 'Vĩnh Phúc', '', '', ''],
      ],
    },
  },
  attendance: {
    kind: 'attendance',
    slug: 'nhap-diem-danh',
    navLabel: 'Nhập điểm danh / nhận xét buổi',
    title: 'Nhập điểm danh & nhận xét buổi',
    description:
      'Tải file nhận xét buổi học từ LARK/Excel, xem trước phân loại rồi xác nhận. Mỗi dòng là một buổi của một học viên. Nhập lại cùng file KHÔNG tạo trùng — idempotent theo cột khóa (co_so|buoi|ten_hoc_vien). Học viên khớp theo tên; GV phụ trách khớp theo Tên tắt (không khớp vẫn ghi, bỏ trống GV).',
    keyDescription:
      'Khóa chống trùng: cột "khoa" = co_so|buoi|ten_hoc_vien (tự dựng nếu để trống).',
    columnGuide: [
      'co_so — cơ sở (thành phần khóa)',
      'buoi — mã buổi/khối học, bắt buộc (thành phần khóa)',
      'ten_hoc_vien — bắt buộc; khớp theo tên (trùng tên >1 học viên = báo lỗi)',
      'ngay_hoc — bắt buộc; YYYY-MM-DD hoặc DD/MM/YYYY',
      'gv_phu_trach — TÊN TẮT HLV (không khớp = vẫn ghi, bỏ liên kết HLV)',
      'lam_btvn — số (giá trị chữ được bỏ qua); y_thuc — số 1–10',
      'nhan_xet, kien_thuc_moi, giao_btvn, kh_buoi_sau, sach_dang_hoc, ghi_chu — tùy chọn',
      'khoa — tùy chọn; để trống sẽ tự dựng từ co_so|buoi|ten_hoc_vien',
    ],
    template: {
      fileName: 'mau-nhan-xet-buoi.csv',
      headers: [
        'co_so',
        'buoi',
        'ten_hoc_vien',
        'ngay_hoc',
        'gv_phu_trach',
        'lam_btvn',
        'y_thuc',
        'kien_thuc_moi',
        'nhan_xet',
        'giao_btvn',
        'kh_buoi_sau',
        'sach_dang_hoc',
        'ghi_chu',
        'khoa',
      ],
      sampleRows: [
        [
          'Kim Liên',
          'B1_2025',
          'Nguyễn Văn An',
          '2026-05-20',
          'Quyên',
          '1',
          '8',
          'Chiếu hết 1 nước',
          'Tiếp thu tốt, cần cẩn thận hơn',
          'Bài 5 trang 10',
          'Ôn khai cuộc',
          'Cẩm nang cờ vua tập 1',
          '',
          '',
        ],
      ],
    },
  },
  'progress-reports': {
    kind: 'progress-reports',
    slug: 'nhap-danh-gia',
    navLabel: 'Nhập đánh giá định kỳ',
    title: 'Nhập đánh giá định kỳ',
    description:
      'Tải file đánh giá / báo cáo định kỳ, xem trước phân loại rồi xác nhận. Nhập lại cùng file sẽ cập nhật bản ghi cũ thay vì tạo trùng (idempotent theo học viên + kỳ báo cáo). Báo cáo nhập vào là NHÁP — phụ huynh chỉ thấy sau khi nhân viên điền Ngày phát hành.',
    keyDescription: 'Khóa chống trùng: học viên + kỳ báo cáo.',
    columnGuide: [
      'ky — Cuối năm 2024 | 6 tháng đầu 2025 | 6 tháng cuối 2025 (thành phần khóa)',
      'ten_hoc_vien — bắt buộc; khớp theo tên (trùng tên >1 học viên = báo lỗi)',
      'gv_phu_trach — TÊN TẮT HLV (không khớp = vẫn ghi, bỏ liên kết HLV)',
      'y_thuc — số 0–10 (chấp "8.5"); ngoài khoảng = bỏ qua',
      'btvn, tham_gia_giai_dau, cac_sach_da_hoc, ke_hoach — tùy chọn',
      'nhan_xet_chung — nhận xét gộp ưu/nhược điểm (giữ xuống dòng)',
    ],
    template: {
      fileName: 'mau-danh-gia.csv',
      headers: [
        'ky',
        'ten_hoc_vien',
        'gv_phu_trach',
        'y_thuc',
        'btvn',
        'tham_gia_giai_dau',
        'cac_sach_da_hoc',
        'nhan_xet_chung',
        'ke_hoach',
      ],
      sampleRows: [
        [
          '6 tháng cuối 2025',
          'Nguyễn Văn An',
          'Quyên',
          '9',
          'Con chăm làm bài tập về nhà',
          'Giải báo thiếu niên tiền phong 2025',
          'VQCV5-VQCV6-mate1',
          'Ưu điểm: tiếp thu nhanh.\nNhược điểm: cần cẩn thận hơn khi đấu tập.',
          'Rèn khai cuộc và tính toán kỹ trước mỗi nước đi.',
        ],
      ],
    },
  },
  coaches: {
    kind: 'coaches',
    slug: 'nhap-giao-vien',
    navLabel: 'Nhập giáo viên',
    title: 'Nhập giáo viên / huấn luyện viên',
    description:
      'Tải danh sách giáo viên/HLV, xem trước phân loại rồi xác nhận. Nhập lại cùng file KHÔNG tạo trùng — idempotent theo Tên tắt (tenTat). Chỉ cập nhật các cột CÓ giá trị trong file (ô trống không xóa dữ liệu đã nhập tay).',
    keyDescription: 'Khóa chống trùng: Tên tắt (tenTat).',
    columnGuide: [
      'ten_tat — bắt buộc; khóa định danh (không trùng)',
      'ho_ten — họ tên đầy đủ (dùng làm tên hiển thị khi tạo mới)',
      'vai_tro — GV | Trợ giảng | Tập sự',
      'sdt — số điện thoại (lưu dạng text, giữ số 0 đầu)',
      'email — tùy chọn; elo — số (tùy chọn)',
      'trang_thai — Đang dạy | Nghỉ',
    ],
    template: {
      fileName: 'mau-giao-vien.csv',
      headers: ['ten_tat', 'ho_ten', 'vai_tro', 'sdt', 'email', 'elo', 'trang_thai'],
      sampleRows: [
        [
          'Quyên',
          'Nguyễn Thị Quyên',
          'Trợ giảng',
          '0987654321',
          'quyen@example.com',
          '1500',
          'Đang dạy',
        ],
      ],
    },
  },
  payments: {
    kind: 'payments',
    slug: 'nhap-thanh-toan',
    navLabel: 'Nhập thanh toán',
    title: 'Nhập thanh toán học phí',
    description:
      'Tải file thanh toán học phí, xem trước phân loại rồi xác nhận. Mỗi dòng là một lần nộp tiền của một học viên. Nhập lại cùng file KHÔNG tạo trùng — idempotent theo học viên + ngày nộp + học phí. Học viên khớp theo tên chính xác (không khớp = báo lỗi để xử lý tay).',
    keyDescription: 'Khóa chống trùng: học viên + ngày nộp + học phí.',
    columnGuide: [
      'ten_hoc_vien — bắt buộc; khớp theo tên chính xác (trùng/không khớp = báo lỗi)',
      'ngay_nop — bắt buộc; YYYY-MM-DD hoặc DD/MM/YYYY (thành phần khóa)',
      'hoc_phi — số tiền học phí (thành phần khóa)',
      'tien_sach, mua_khac, hp1_buoi, so_buoi_nop — số (tùy chọn)',
      'co_so — Kim Liên | Vĩnh Phúc (tùy chọn)',
      'tinh_trang — Đã nộp | Chờ (mặc định Đã nộp)',
      'ghi_chu — tùy chọn',
    ],
    template: {
      fileName: 'mau-thanh-toan.csv',
      headers: [
        'ten_hoc_vien',
        'ngay_nop',
        'hoc_phi',
        'tien_sach',
        'mua_khac',
        'hp1_buoi',
        'so_buoi_nop',
        'co_so',
        'tinh_trang',
        'ghi_chu',
      ],
      sampleRows: [
        [
          'Nguyễn Văn An',
          '2026-05-20',
          '1500000',
          '200000',
          '0',
          '150000',
          '10',
          'Kim Liên',
          'Đã nộp',
          'Nộp học phí tháng 5',
        ],
      ],
    },
  },
  classes: {
    kind: 'classes',
    slug: 'nhap-lop',
    navLabel: 'Nhập lớp học',
    title: 'Nhập lớp học',
    description:
      'Tải danh sách lớp, xem trước phân loại rồi xác nhận. Nhập lại cùng file KHÔNG tạo trùng — idempotent theo Tên lớp. Chỉ cập nhật cột CÓ giá trị (ô trống không xóa dữ liệu). GV/trợ giảng khớp theo Tên tắt; cơ sở khớp theo tên Locations. Lịch học có thể nhập gọn hoặc để trống rồi tinh chỉnh trong /admin.',
    keyDescription: 'Khóa chống trùng: Tên lớp (ten_lop).',
    columnGuide: [
      'ten_lop — bắt buộc; khóa định danh (không phân biệt hoa/thường)',
      'cap_do — bắt buộc; Tốt | Mã | Tượng | Xe | Hậu | Vua',
      'nhom_tuoi — bắt buộc; "Mầm non" (4–6) | "Cấp 1 - Cấp 2"',
      'co_so — bắt buộc; khớp tên Cơ sở (Locations)',
      'gv — Tên tắt GV phụ trách (tùy chọn); tro_giang — Tên tắt trợ giảng (tùy chọn)',
      'si_so_toi_da — số (tùy chọn); trang_thai — Đang mở | Tạm dừng | Đã đóng (mặc định Đang mở)',
      'lich_hoc — tùy chọn; "T2 17:00-18:30 A1; T4 17:00-18:30" (thứ giờ-giờ [phòng], cách nhau ;)',
    ],
    template: {
      fileName: 'mau-lop-hoc.csv',
      headers: [
        'ten_lop',
        'cap_do',
        'nhom_tuoi',
        'co_so',
        'gv',
        'tro_giang',
        'si_so_toi_da',
        'trang_thai',
        'lich_hoc',
      ],
      sampleRows: [
        [
          'Lớp Tốt 1 - Kim Liên',
          'Tốt',
          'Cấp 1 - Cấp 2',
          'Kim Liên',
          'Quyên',
          '',
          '15',
          'Đang mở',
          'T2 17:00-18:30 A1; T5 17:00-18:30 A1',
        ],
        [
          'Lớp Mầm non sáng - Vĩnh Phúc',
          'Tốt',
          'Mầm non',
          'Vĩnh Phúc',
          'Trúc',
          '',
          '12',
          'Đang mở',
          'T7 09:00-10:30',
        ],
      ],
    },
  },
  enrollments: {
    kind: 'enrollments',
    slug: 'nhap-ghi-danh',
    navLabel: 'Nhập ghi danh',
    title: 'Nhập ghi danh (gắn học viên vào lớp)',
    description:
      'Tải danh sách ghi danh (học viên ↔ lớp), xem trước phân loại rồi xác nhận. Nhập lại cùng file KHÔNG tạo trùng — idempotent theo (học viên + lớp). Học viên khớp theo tên (trùng tên cần thêm SĐT phụ huynh); lớp khớp theo Tên lớp (phải đã tồn tại — nhập lớp trước). MỘT học viên có thể học NHIỀU lớp: ghi nhiều tên lớp trong ô ten_lop, ngăn nhau bằng dấu chấm phẩy (;).',
    keyDescription: 'Khóa chống trùng: học viên + lớp.',
    columnGuide: [
      'ten_hoc_vien — bắt buộc; khớp theo tên (trùng tên >1 HV cần sdt_phu_huynh)',
      'ma_hoc_vien — id học viên (tùy chọn; chính xác nhất nếu trùng tên)',
      'sdt_phu_huynh — chốt khi trùng tên (tùy chọn)',
      'ten_lop — bắt buộc; khớp Tên lớp đã có (nhập Lớp trước). NHIỀU lớp ngăn bằng "; " (vd "Lớp A; Lớp B")',
      'dang_hoc — Có | Không (mặc định Có) — áp cho mọi lớp trong ô',
      'ngay_bat_dau — YYYY-MM-DD hoặc DD/MM/YYYY (tùy chọn)',
    ],
    template: {
      fileName: 'mau-ghi-danh.csv',
      headers: [
        'ten_hoc_vien',
        'ma_hoc_vien',
        'sdt_phu_huynh',
        'ten_lop',
        'dang_hoc',
        'ngay_bat_dau',
      ],
      sampleRows: [
        [
          'Nguyễn Văn An',
          '',
          '0912345678',
          'Lớp Tốt 1 - Kim Liên; Lớp Nâng cao - Kim Liên',
          'Có',
          '2026-01-15',
        ],
        ['Trần Bảo Minh', '', '', 'Lớp Mầm non sáng - Vĩnh Phúc', 'Có', ''],
      ],
    },
  },
}

/** Render CSV mẫu (BOM UTF-8 để Excel mở đúng tiếng Việt). */
export function templateToCsv(kind: ImportKind): string {
  const tpl = IMPORT_KIND_META[kind].template
  const rows = [tpl.headers, ...tpl.sampleRows]
  const csv = rows.map((r) => r.map(escapeCsvCell).join(',')).join('\r\n')
  return '﻿' + csv + '\r\n'
}

function escapeCsvCell(cell: string): string {
  if (/[",\r\n]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`
  }
  return cell
}
