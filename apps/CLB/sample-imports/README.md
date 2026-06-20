# Sample import files

File CSV mẫu để test luồng import điểm danh / báo cáo tiến độ ở `/admin/nhap-diem-danh`
và `/admin/nhap-danh-gia`. Mọi file đều có BOM UTF-8 (Excel mở đúng tiếng Việt).

## Cách test (bước-bước)

Tiền đề: đã đăng nhập tài khoản nhân viên vào `/admin`, đã có **ít nhất một
Student** trong DB. Ghi nhớ `id` (cột "ID" trong list view) — các file mẫu giả
định học viên ID = 1.

### 1. Tải template chính thức

- Vào `/admin/nhap-diem-danh`. Bấm link `mau-diem-danh.csv` trong khung "Cột trong file".
- Vào `/admin/nhap-danh-gia`. Bấm link `mau-danh-gia.csv`.
- Cả hai link `/api/admin-import-templates/*` đều yêu cầu cookie staff —
  thử ẩn danh sẽ bị 401.

### 2. Happy path — điểm danh

- Sửa `sample-imports/diem-danh-ok.csv`: thay `1` ở cột `ma_hoc_vien` thành
  ID học viên thật của bạn, và (nếu dùng dòng theo họ tên) chỉnh `ho_ten` +
  `sdt_phu_huynh` cho khớp Parent đã tạo.
- Upload tại `/admin/nhap-diem-danh` → bấm "Xác nhận nhập".
- Kết quả mong đợi: 3 tạo mới / 0 cập nhật / 0 lỗi.
- Mở `/admin/collections/attendance` để kiểm tra.

### 3. Idempotent — upload lại đúng file đó

- Bấm "Nhập file khác" → chọn lại cùng file → xác nhận.
- Kết quả mong đợi: **0 tạo mới / 3 cập nhật / 0 lỗi**. KHÔNG có bản ghi
  trùng trong collection.

### 4. Báo lỗi theo dòng

- Upload `diem-danh-co-loi.csv`. Kết quả mong đợi:
  - Dòng 1: created (học viên 1, ngày 2026-05-20). Vì đã chạy bước 2, dòng này sẽ là "updated".
  - Dòng 2: lỗi — `Không tìm thấy học viên có mã 999999`.
  - Dòng 3: lỗi — `Ngày "khong-phai-ngay" không hợp lệ`.
  - Dòng 4: lỗi — `Trạng thái "sai_trang_thai" không hợp lệ`.
  - Dòng 5: lỗi — `Thiếu mã học viên hoặc họ tên`.
  - Dòng 6: lỗi — `Không tìm thấy học viên tên "Học Viên Không Tồn Tại"`.
- Bảng lỗi hiện đúng số dòng + cột + thông điệp.

### 5. Happy path — báo cáo tiến độ

- Sửa `danh-gia-ok.csv` tương tự (ID học viên thật).
- Upload tại `/admin/nhap-danh-gia` → kỳ "Tháng 5/2026" có `ngay_phat_hanh`
  (= đã xuất bản, phụ huynh sẽ thấy), kỳ "Tháng 6/2026" không có ngày phát
  hành (= nháp, ẩn với phụ huynh).
- Upload lại để xác nhận idempotent: 0 tạo / 2 cập nhật.

### 6. Kiểm thử an toàn (Task 5 đụng đến)

- Mở incognito (không có cookie staff) → gọi
  `GET /api/admin-import-templates/attendance` → mong đợi 401.
- Mở incognito → cố `POST` tới Server Action (qua devtools) → mong đợi từ chối.

## Cấu trúc cột

Xem `apps/web/src/lib/imports/templates.ts` để biết danh sách cột chính thức
và alias mà processor chấp nhận (`apps/web/src/lib/imports/parse.ts#pick`).
