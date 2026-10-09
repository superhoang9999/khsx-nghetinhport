# KHSX Cảng Nghệ Tĩnh — Netlify + Supabase

## Cách triển khai nhanh nhất

1. Tạo repository GitHub mới và upload **toàn bộ nội dung thư mục này**.
2. Trong Netlify: **Add new site → Import an existing project → GitHub → chọn repo**.
3. Trong **Site configuration → Environment variables**, tạo đúng 3 biến:
   - `SUPABASE_URL` = URL project Supabase
   - `SUPABASE_PUBLISHABLE_KEY` = Publishable key (`sb_publishable_...`)
   - `SUPABASE_SERVICE_ROLE_KEY` = Secret/service-role key. **Chỉ đặt trên Netlify, không đưa vào GitHub.**
4. Deploy lại site.
5. Mở URL Netlify và đăng nhập bằng tài khoản Admin hiện tại (`admin` + mật khẩu Auth hiện tại).

## Đã kết nối thật trong bản này

- Supabase Auth qua username/password.
- Tự ánh xạ username → Auth email ở phía Netlify Function.
- Phiên đăng nhập Supabase thật.
- Lấy thông tin tài khoản từ `v_current_user_info`.
- Quản lý tài khoản dùng dữ liệu thật:
  - Chọn nhân sự đã import.
  - Tạo Auth user + `profiles`.
  - Gán bộ quyền.
  - Reset mật khẩu.
  - Khóa/mở tài khoản.
- Không đưa Supabase Secret/Service Role Key ra frontend.

## Lưu ý

Các phân hệ nghiệp vụ KHSX/Chấm công/An toàn vẫn giữ UI/UX v29 trong bản deploy đầu tiên; backend schema đã sẵn sàng. Mục tiêu của gói này là kiểm tra ngay chuỗi GitHub → Netlify → Supabase Auth → dữ liệu nhân sự/tài khoản trước khi thay toàn bộ dữ liệu demo trong các form KHSX.
