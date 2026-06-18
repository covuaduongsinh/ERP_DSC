# Cẩm nang triển khai VietERP lên VPS — Bản chi tiết cho người mới

> Viết cho người **chưa rành IT**. Mỗi bước có: lệnh để **copy-paste**, giải thích ngắn, và
> "**bạn sẽ thấy gì**" để tự kiểm tra. Cứ làm xong mỗi GIAI ĐOẠN thì dán kết quả vào chat cho tôi
> kiểm, rồi đi tiếp. Không cần làm hết một lần.

**Cách đọc lệnh:** khối chữ trong ô xám là lệnh — gõ/dán nguyên văn vào cửa sổ dòng lệnh rồi Enter.
Chỗ có `<...>` là bạn phải thay bằng giá trị thật (ví dụ `<IP>` → địa chỉ máy chủ của bạn).

---

## Cần chuẩn bị trước (Giai đoạn 0)

1. **Một thẻ Visa/Mastercard** (để thuê máy chủ Hetzner — tính tiền theo giờ, ~€13/tháng).
2. **Một tên miền** (ví dụ `duongsinh.vn` hoặc `covuaduongsinh.com`). Nếu chưa có, mua ở
   Namecheap / Cloudflare / Mắt Bão… (~200–300k/năm). Cần để truy cập app bằng tên thay vì dãy số.
3. **Máy tính Windows của bạn** (đã có sẵn). Ta dùng **PowerShell** có sẵn trong Windows để kết nối máy chủ.
4. Khoảng **2–3 tiếng** rảnh cho lần đầu.

---

## GIAI ĐOẠN 1 — Tạo máy chủ (VPS) trên Hetzner

1. Vào https://www.hetzner.com/cloud → **Sign Up** tạo tài khoản (email + mật khẩu). Hetzner có thể
   yêu cầu **xác minh danh tính** (chụp CCCD/hộ chiếu) cho tài khoản mới — làm theo hướng dẫn, có thể chờ vài giờ.
2. Đăng nhập https://console.hetzner.cloud → bấm **+ New Project** → đặt tên `CoVuaDuongSinh` → mở project.
3. Bấm **Add Server**, chọn lần lượt:
   - **Location:** `Nuremberg` (hoặc Falkenstein).
   - **Image:** `Ubuntu` → `24.04`.
   - **Type:** bấm tab **Arm64** → chọn **CAX31** (8 vCPU / 16 GB / 160 GB). _(Quan trọng: phải là tab Arm64 thì mới có CAX31 giá rẻ.)_
   - **Networking:** để mặc định (có **Public IPv4**).
   - **SSH keys:** bỏ qua (để trống) — Hetzner sẽ tạo **mật khẩu root** gửi cho bạn.
   - **Name:** gõ `vierp`.
   - Bấm **Create & Buy now**.
4. Hetzner sẽ hiện (và gửi email) **địa chỉ IP** + **mật khẩu root** của máy chủ. **Lưu lại 2 thứ này.**

✅ **Xong giai đoạn 1 khi:** bạn có 1 dòng IP (ví dụ `91.99.x.x`) và 1 mật khẩu root.

---

## GIAI ĐOẠN 2 — Kết nối vào máy chủ từ máy Windows

1. Trên máy Windows, bấm nút Start, gõ **PowerShell**, mở nó.
2. Gõ lệnh sau (thay `<IP>` bằng IP máy chủ), rồi Enter:
   ```powershell
   ssh root@<IP>
   ```
3. Lần đầu nó hỏi `Are you sure you want to continue connecting (yes/no)?` → gõ `yes` Enter.
4. Nó hỏi mật khẩu (`password:`) → dán **mật khẩu root** của Hetzner (khi dán sẽ **không hiện ký tự**, bình thường) → Enter.
5. Lần đầu thường bắt **đổi mật khẩu mới**: nhập lại mật khẩu cũ, rồi đặt mật khẩu mới 2 lần. **Ghi nhớ mật khẩu mới.**

✅ **Xong khi:** dòng đầu dòng lệnh đổi thành `root@vierp:~#` — nghĩa là bạn đang điều khiển máy chủ.

> Từ đây trở đi, **mọi lệnh là gõ trong cửa sổ đang nối tới máy chủ** (trừ khi nói rõ "trên máy Windows").

---

## GIAI ĐOẠN 3 — Cài nền tảng cho máy chủ

1. Cài `git` (công cụ tải mã nguồn):
   ```bash
   apt update && apt install -y git
   ```
2. Tải mã nguồn ERP về máy chủ, vào thư mục đó:
   ```bash
   git clone https://github.com/covuaduongsinh/ERP_DSC.git /opt/vierp
   cd /opt/vierp
   ```
3. Chạy script cài đặt tự động (cài Docker, tạo vùng nhớ đệm "swap", mở tường lửa). Mất ~2–3 phút:
   ```bash
   bash deploy/setup-vps.sh
   ```

✅ **Xong khi:** cuối màn hình hiện phiên bản Docker (ví dụ `Docker version 29...`) và dòng `Tiếp theo: clone repo...`.
Nếu thấy chữ đỏ báo lỗi → **dán toàn bộ vào chat cho tôi**.

---

## GIAI ĐOẠN 4 — Trỏ tên miền về máy chủ

Mục tiêu: gõ `crm.tenmiencuaban.vn` trên trình duyệt sẽ tới đúng máy chủ.

1. Đăng nhập trang quản lý tên miền của bạn (Cloudflare/Namecheap/Mắt Bão…), vào phần **DNS**.
2. Thêm các bản ghi loại **A** (mỗi dòng là 1 app), trỏ về **IP máy chủ**. Bắt đầu với 2 cái:

   | Type | Name (Host) | Value (trỏ tới) |
   | ---- | ----------- | --------------- |
   | A    | `crm`       | `<IP>`          |
   | A    | `ketoan`    | `<IP>`          |

   (Sau này thêm dần: `hrm`, `mrp`, `pm`, `sso`, `api`… cũng trỏ về cùng IP.)

3. Lưu lại. Chờ 1–5 phút cho cập nhật.

✅ **Xong khi:** trên máy chủ chạy `ping -c1 crm.tenmiencuaban.vn` thấy đúng IP máy chủ.

---

## GIAI ĐOẠN 5 — Tạo file cấu hình bí mật (.env)

1. Tạo file `.env` từ mẫu:
   ```bash
   cp deploy/.env.prod.example .env
   ```
2. Tạo vài chuỗi mật khẩu/bí mật ngẫu nhiên — chạy lệnh này **4 lần**, mỗi lần copy 1 kết quả để lát dán vào:
   ```bash
   openssl rand -base64 36
   ```
3. Mở file `.env` để điền:
   ```bash
   nano .env
   ```
   Trong trình soạn `nano`: dùng phím mũi tên di chuyển, sửa các dòng sau (thay phần sau dấu `=`):
   - `POSTGRES_PASSWORD=` → dán 1 chuỗi ngẫu nhiên
   - `KEYCLOAK_ADMIN_PASSWORD=` → dán 1 chuỗi ngẫu nhiên
   - `SSO_CLIENT_SECRET=` → dán 1 chuỗi ngẫu nhiên
   - Thêm 3 dòng mới ở cuối file (gõ tay):
     ```
     NEXTAUTH_SECRET=<dán chuỗi ngẫu nhiên thứ 4>
     AUTH_SECRET=<dán lại đúng chuỗi NEXTAUTH_SECRET ở trên>
     BASE_DOMAIN=tenmiencuaban.vn
     ```
   - `ANTHROPIC_API_KEY=` → để trống cũng được (chỉ HRM-AI/ExcelAI cần).
   - Lưu lại: bấm **Ctrl+O** rồi **Enter**, thoát: **Ctrl+X**.

✅ **Xong khi:** chạy `cat .env` thấy các dòng đã điền (không còn chữ `ĐỔI_...`).

---

## GIAI ĐOẠN 6 — Build (đóng gói) 2 app đầu tiên

Ta làm thử **CRM** và **Kế toán (Accounting)** trước — đây là 2 app đã được kiểm chứng build chạy.

```bash
bash deploy/build-images.sh CRM Accounting
```

- Lệnh này đóng gói app thành "image" để chạy. **Mỗi app mất 3–8 phút**, có nhiều chữ chạy qua — bình thường.

✅ **Xong khi:** cuối cùng hiện `naming to docker.io/...vierp-crm` và `...vierp-accounting`, không có chữ `ERROR` ở dòng cuối.
Kiểm tra lại:

```bash
docker images | grep vierp
```

→ thấy `vierp-crm` và `vierp-accounting`.

> Nếu báo lỗi đỏ → dán cho tôi. Đừng build cả 13 app vội; chạy được 2 app này đã rồi mở rộng sau.

---

## GIAI ĐOẠN 7 — Khởi động cơ sở dữ liệu

Bật các dịch vụ nền (cơ sở dữ liệu PostgreSQL, bộ đệm Redis, hàng đợi NATS):

```bash
docker compose -f docker-compose.prod.yml up -d postgres redis nats
```

Chờ ~20 giây rồi kiểm tra:

```bash
docker compose -f docker-compose.prod.yml ps
```

✅ **Xong khi:** 3 dòng `postgres`, `redis`, `nats` ở trạng thái `healthy` (hoặc `running`).

---

## GIAI ĐOẠN 8 — Tạo bảng dữ liệu + chạy app ⚠️ (làm CÙNG tôi)

Đây là bước **khó và tuỳ từng app** (tạo bảng trong cơ sở dữ liệu). Mỗi app cấu trúc dữ liệu khác nhau,
và app Kế toán dùng kiểu kết nối đặc biệt. **Đừng tự mò** — hãy:

1. Chạy thử khởi động 2 app:
   ```bash
   docker compose -f docker-compose.prod.yml -f deploy/docker-compose.auth.yml up -d crm accounting
   ```
2. Xem log từng app (Ctrl+C để thoát xem log):
   ```bash
   docker logs vierp-crm --tail 30
   docker logs vierp-accounting --tail 30
   ```
3. **Dán kết quả 2 lệnh log đó vào chat cho tôi.** Tôi sẽ đưa đúng lệnh tạo bảng (`prisma db push`)
   và tạo tài khoản đăng nhập cho từng app, tuỳ theo những gì log báo.

---

## GIAI ĐOẠN 9 — Bật HTTPS (ổ khoá xanh) bằng Caddy

1. Sửa file `deploy/Caddyfile`: thay `erp.example.vn` thành tên miền thật + email của bạn:
   ```bash
   nano deploy/Caddyfile
   ```
   (Đổi mọi `erp.example.vn` thành `tenmiencuaban.vn`, đổi `admin@erp.example.vn` thành email bạn. Lưu Ctrl+O, thoát Ctrl+X.)
2. Chạy Caddy (tự xin chứng chỉ HTTPS miễn phí):
   ```bash
   docker run -d --name caddy --restart unless-stopped \
     --network vierp-network -p 80:80 -p 443:443 \
     -v /opt/vierp/deploy/Caddyfile:/etc/caddy/Caddyfile:ro \
     -v caddy_data:/data -v caddy_config:/config caddy:2
   ```

✅ **Xong khi:** mở trình duyệt vào `https://crm.tenmiencuaban.vn` thấy có ổ khoá xanh (dù trang có thể báo lỗi đăng nhập — xử lý ở Giai đoạn 8).

---

## GIAI ĐOẠN 10 — Mở rộng thêm app

Khi 2 app chạy ổn, lặp lại cho app khác (mỗi lần 1–2 app cho nhẹ):

```bash
bash deploy/build-images.sh PM            # build thêm Quản lý dự án
docker compose -f docker-compose.prod.yml -f deploy/docker-compose.auth.yml up -d pm
```

Rồi thêm bản ghi DNS `pm` (Giai đoạn 4) và dòng tương ứng đã có sẵn trong Caddyfile.

> Lưu ý: **HRM-AI / HRM-unified** còn vài lỗi mã nguồn cần vá trước khi build (đã ghi trong README).
> Khi tới lượt 2 app này, nhắn tôi xử lý.

---

## Phụ lục A — Các lệnh hữu ích (chạy trên máy chủ)

```bash
docker compose -f docker-compose.prod.yml ps          # xem app nào đang chạy
docker logs <tên-container> --tail 50 -f              # xem log 1 app (Ctrl+C để thoát)
docker compose -f docker-compose.prod.yml restart crm # khởi động lại 1 app
free -h                                               # xem RAM còn bao nhiêu
df -h /                                                # xem dung lượng đĩa còn bao nhiêu
docker system prune -f                                # dọn rác Docker khi đĩa đầy
```

## Phụ lục B — Khi gặp lỗi

- **Đừng hoảng.** Hầu hết lỗi là bình thường ở lần đầu.
- Cách lấy thông tin lỗi để gửi tôi: chạy `docker logs <tên-container> --tail 50` rồi **copy toàn bộ** dán vào chat.
- Nói rõ bạn **đang ở Giai đoạn mấy** và **vừa chạy lệnh nào**.

## Phụ lục C — Tạm dừng / xoá để khỏi tốn tiền

- Tắt hết app (vẫn giữ máy chủ, vẫn tính tiền): `docker compose -f docker-compose.prod.yml down`
- **Ngừng tốn tiền hoàn toàn:** vào Hetzner Console → server `vierp` → **Delete** (xoá máy chủ).
  _(Hetzner tính tiền theo giờ tới khi xoá; tắt nguồn không thôi vẫn bị tính.)_
