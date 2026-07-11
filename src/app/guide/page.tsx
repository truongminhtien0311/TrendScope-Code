// Trang Hướng dẫn sử dụng — tài liệu tĩnh, viết tiếng Việt đơn giản cho
// người không rành kỹ thuật, giải thích từng tính năng + điều kiện để
// hoạt động đầy đủ. Không cần đọc database, chỉ nội dung viết sẵn.
import GuideDiagram from "@/components/GuideDiagram";

export default function GuidePage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">📖 Hướng dẫn sử dụng</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Đọc hết trang này 1 lần là dùng thành thạo app — mỗi mục giải thích 1 tính năng bằng
          ngôn ngữ đơn giản, không cần biết kỹ thuật.
        </p>
      </div>

      <Section title="🧭 Tổng quan">
        <p>
          Product Scrap giúp mày nghiên cứu sản phẩm nguồn Trung Quốc (Taobao/Tmall/JD/Alibaba):
          gom nhiều link nguồn của cùng 1 sản phẩm lại 1 chỗ, cào giá/ảnh/đánh giá, dịch sang
          tiếng Việt, rồi dùng AI phân tích tệp khách hàng/kênh bán/tính khả thi kinh doanh.
        </p>
        <p className="mt-2">
          <strong>Mỗi người tự chạy app trên máy riêng</strong> — không có server chung. Muốn
          gộp dữ liệu giữa các máy thì dùng tính năng &lsquo;🔄 Đồng bộ dữ liệu&rsquo; (giải
          thích bên dưới).
        </p>
        <div className="my-4">
          <GuideDiagram
            steps={[
              { icon: "💻", label: "Máy của mày (dữ liệu riêng)" },
              { icon: "☁️", label: "Google Drive (ảnh/backup/đồng bộ)" },
              { icon: "🖥️", label: "Máy nhân sự (dữ liệu riêng)" },
            ]}
          />
        </div>
      </Section>

      <Section title="⚙️ Điều kiện để hoạt động đầy đủ">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong>Cần có mạng internet</strong> khi: cào dữ liệu từ link, chạy Phân tích AI,
            đồng bộ dữ liệu qua Google Drive.
          </li>
          <li>
            <strong>Cần kết nối Google Drive</strong> (Cài đặt &gt; 🔌 API &amp; Kết nối &gt; mục
            Lưu trữ) để: lưu ảnh không bị mất khi đổi máy, sao lưu dữ liệu, và dùng được tính
            năng Đồng bộ. Mỗi người tự kết nối Drive CỦA RIÊNG HỌ, không dùng chung 1 tài khoản.
          </li>
          <li>
            <strong>Cần API key thật</strong> (Google Gemini để phân tích AI, Otapi để cào dữ
            liệu thật) — chưa có key thì app vẫn chạy được bằng dữ liệu &lsquo;Mock&rsquo; (giả,
            chỉ để xem giao diện). Vào Cài đặt &gt; 🔌 API &amp; Kết nối để nhập.
          </li>
        </ul>
      </Section>

      <Section title="➕ Thêm & cào sản phẩm">
        <p>
          Vào 1 sản phẩm (hoặc tạo mới ở Dashboard) → mục &lsquo;🔗 Thêm link sản phẩm&rsquo; có
          2 cách:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 mt-2">
          <li><strong>🔗 Dán link</strong> — dán URL sản phẩm, app tự cào tên/giá/ảnh/đánh giá.</li>
          <li>
            <strong>✍️ Nhập tay</strong> — khi link cào lỗi/hết quota, hoặc gõ tay nhanh hơn.
            Vẫn dịch được bằng nút &lsquo;🔤 Dịch&rsquo; cạnh ô tên/mô tả.
          </li>
        </ul>
        <p className="mt-2">
          Mỗi phân loại (màu/size...) sửa được tên/giá trực tiếp trên bảng — giá sửa tay sẽ
          không bị cào đè khi bấm &lsquo;🔄 Cào lại&rsquo;.
        </p>
      </Section>

      <Section title="🧠 Phân tích AI">
        <p>
          Ở trang chi tiết sản phẩm, bấm &lsquo;✨ Tạo bằng AI&rsquo; — app gộp TOÀN BỘ dữ liệu
          (tên, ảnh, mô tả, đánh giá của mọi link) gửi 1 lần cho Gemini, sinh ra 7 mục:
        </p>
        <ol className="list-decimal pl-5 space-y-1 mt-2">
          <li>Mô tả tổng hợp</li>
          <li>Tệp khách hàng mục tiêu</li>
          <li>Kênh bán hàng &amp; hướng tiếp thị</li>
          <li>Gợi ý tùy chỉnh sản phẩm</li>
          <li>Nhập khẩu (HS Code, thuế, kiểm định)</li>
          <li>Đóng gói &amp; vận chuyển nội địa</li>
          <li>Đánh giá tính khả thi kinh doanh</li>
        </ol>
        <p className="mt-2">
          Mỗi lần bấm tạo ra 1 BẢN MỚI (giữ tối đa 10 bản để so sánh), không ghi đè bản cũ.
        </p>
      </Section>

      <Section title="👥 Quản lý tài khoản & phân quyền">
        <p>Vào Cài đặt &gt; 🔐 Bảo mật. 3 mức quyền:</p>
        <ul className="list-disc pl-5 space-y-1.5 mt-2">
          <li><strong>Member (nhân viên)</strong> — thêm/sửa sản phẩm, cào dữ liệu, xóa link lẻ.</li>
          <li>
            <strong>Admin</strong> — làm được mọi thứ member làm được, cộng thêm: sửa Cài đặt/API
            key/tỷ giá, kết nối Google Drive, xóa cả sản phẩm.
          </li>
          <li>
            <strong>⭐ Chủ tài khoản</strong> — 1 admin đặc biệt (tài khoản tạo lúc &lsquo;Thiết
            lập lần đầu&rsquo;). Chỉ Chủ tài khoản mới xóa được tài khoản admin khác — admin
            thường không xóa lẫn nhau được.
          </li>
        </ul>
      </Section>

      <Section title="🔄 Đồng bộ dữ liệu giữa các máy">
        <p>
          Vì mỗi người chạy app riêng (không server chung), đây là cách gộp dữ liệu lại — CHỈ
          THÊM dữ liệu mới, không bao giờ sửa/đè dữ liệu đã có, dù gửi lại nhiều lần.
        </p>
        <div className="my-4">
          <GuideDiagram
            steps={[
              { icon: "🔍", label: "Nhân sự cào dữ liệu" },
              { icon: "📤", label: "Xuất lên Drive" },
              { icon: "💬", label: "Gửi link qua chat" },
              { icon: "📥", label: "Dán link vào app chính" },
              { icon: "✅", label: "Đồng bộ (chỉ thêm mới)" },
            ]}
          />
        </div>
        <p>
          Vào sidebar &lsquo;🔄 Đồng bộ dữ liệu&rsquo;: bấm &lsquo;📤 Xuất dữ liệu lên Google
          Drive&rsquo; để lấy link, hoặc dán link người khác gửi vào ô &lsquo;📥 Đồng bộ từ
          Drive&rsquo; rồi bấm &lsquo;Đồng bộ&rsquo;.
        </p>
      </Section>

      <Section title="📤 Xuất dữ liệu — 3 kiểu khác nhau">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>
            <strong>CSV/Excel</strong> (trang &lsquo;Xuất dữ liệu&rsquo;) — bảng phẳng chọn
            trường tùy ý, mở bằng Excel/Google Sheets, có thể chèn ảnh + tô màu ngành hàng.
          </li>
          <li>
            <strong>Catalogue</strong> — lưới ảnh lớn để lướt nhanh, xem cho đẹp mắt.
          </li>
          <li>
            <strong>Báo cáo trình bày / PDF</strong> — trang chi tiết ĐẦY ĐỦ (mô tả, ảnh, giá,
            đánh giá, cả 7 mục AI), chỉ đọc, không có nút sửa/xóa — dùng để trình sếp xem hoặc
            tải file PDF thật. Chọn nhiều sản phẩm ở Dashboard (&lsquo;☑️ Chọn nhiều&rsquo;) hoặc
            bấm nút báo cáo riêng ngay trên trang 1 sản phẩm.
          </li>
        </ul>
      </Section>

      <Section title="☁️ Sao lưu dữ liệu">
        <p>
          Cài đặt &gt; ☁️ Sao lưu — bấm &lsquo;💾 Sao lưu ngay&rsquo; để nén toàn bộ database
          gửi lên Google Drive, phòng khi máy hỏng/mất dữ liệu. Giữ lại 10 bản gần nhất, tự xóa
          bản cũ hơn.
        </p>
      </Section>

      <Section title="🔔 Cập nhật app tự động">
        <p>
          App tự kiểm tra bản mới mỗi khi mở + định kỳ vài giờ. Có bản mới sẽ thấy thông báo
          &lsquo;🎉 Đã có bản cập nhật mới!&rsquo; ở góc màn hình — bấm &lsquo;Khởi động
          lại&rsquo; để cập nhật ngay, không cần tự tải/cài lại thủ công.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      <h2 className="font-semibold mb-3">{title}</h2>
      <div className="text-sm text-slate-600 dark:text-slate-300">{children}</div>
    </section>
  );
}
