// Trang Hướng dẫn sử dụng — tài liệu tĩnh, viết tiếng Việt đơn giản cho
// người không rành kỹ thuật, giải thích từng tính năng + điều kiện để
// hoạt động đầy đủ. Không cần đọc database, chỉ nội dung viết sẵn.
import GuideDiagram from "@/components/GuideDiagram";

export default function GuidePage() {
  return (
    <div className="space-y-8 w-full">
      <div>
        <h1 className="text-2xl font-bold">📖 Hướng dẫn sử dụng</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Đọc hết trang này 1 lần là dùng thành thạo app — mỗi mục giải thích 1 tính năng bằng
          ngôn ngữ đơn giản, không cần biết kỹ thuật.
        </p>
      </div>

      <Section title="🧭 Tổng quan — cơ chế hoạt động">
        <p>
          TrendScope giúp bạn nghiên cứu sản phẩm nguồn Trung Quốc (Taobao/Tmall/JD/Alibaba/1688):
          gom nhiều link nguồn của cùng 1 sản phẩm lại 1 chỗ, cào giá/ảnh/đánh giá, dịch sang
          tiếng Việt, rồi dùng AI phân tích tệp khách hàng/kênh bán/tính khả thi kinh doanh.
        </p>
        <p className="mt-2">Vòng đời dữ liệu trong app đi qua 4 bước, luôn theo đúng thứ tự này:</p>
        <div className="my-4">
          <GuideDiagram
            steps={[
              { icon: "🔗", label: "Dán link → cào dữ liệu (giá/ảnh/đánh giá)" },
              { icon: "🔤", label: "Dịch sang tiếng Việt (tự động hoặc bấm Dịch)" },
              { icon: "🧠", label: "AI phân tích / so sánh / chấm điểm" },
              { icon: "📤", label: "Xuất báo cáo hoặc đồng bộ sang máy khác" },
            ]}
          />
        </div>
        <p className="mt-2">
          <strong>Mỗi người tự chạy app trên máy riêng</strong> — không có server chung, dữ liệu
          nằm trong 1 file database ngay trên máy bạn (không gửi đi đâu trừ khi bạn chủ động cào/
          gọi AI/đồng bộ). Muốn gộp dữ liệu giữa các máy thì dùng tính năng &lsquo;🔄 Đồng bộ dữ
          liệu&rsquo; (giải thích bên dưới).
        </p>
        <div className="my-4">
          <GuideDiagram
            steps={[
              { icon: "💻", label: "Máy của bạn (dữ liệu riêng)" },
              { icon: "☁️", label: "Google Drive (ảnh/backup/đồng bộ)" },
              { icon: "🖥️", label: "Máy người dùng khác (dữ liệu riêng)" },
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
            liệu thật) — chưa có key thì chưa cào/phân tích được. Vào Cài đặt &gt; 🔌 API &amp;
            Kết nối để nhập.
          </li>
          <li>
            <strong>Muốn tỷ giá CNY→VNĐ tự cập nhật hàng ngày</strong> thì cần thêm API key
            ExchangeRate-API (đăng ký miễn phí) trong Cài đặt, rồi bật công tắc tự động — không
            bắt buộc, không có key vẫn sửa tay tỷ giá bình thường.
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
        <p className="mt-2">
          Với Taobao/Tmall, đánh giá của người mua (bản gốc tiếng Trung + bản dịch) được cào và
          lưu <strong>tự động cùng lúc</strong> với link — không cần thao tác thêm gì, hiện luôn
          ở phần &lsquo;Đánh giá của người mua&rsquo; dưới mỗi link trên trang chi tiết sản phẩm.
        </p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          💡 Nếu nguồn cào chính (Otapi) bị lỗi/hết quota, admin có thể bật thêm nguồn dự phòng
          &lsquo;Taobao DataHub&rsquo; trong Cài đặt &gt; 🔌 API (mặc định đang tắt) — lưu ý nguồn
          này chỉ trả 1 mức giá chung, chưa tách theo từng phân loại và chưa có đánh giá.
        </p>
      </Section>

      <Section title="📱 Đăng nhập Taobao qua QR (chỉ cần khi dùng link rút gọn)">
        <p>
          Link Taobao lấy từ điện thoại thường ở dạng rút gọn (vd &lsquo;e.tb.cn/...&rsquo;),
          không chứa sẵn mã sản phẩm — Taobao chỉ cho &lsquo;mở khóa&rsquo; ra link đầy đủ khi
          trình duyệt đang đăng nhập tài khoản Taobao. Vào Cài đặt &gt; mục &lsquo;Đăng nhập
          Taobao&rsquo;, bấm &lsquo;📱 Đăng nhập bằng QR&rsquo;, dùng app Taobao trên điện thoại
          quét mã hiện ra — đăng nhập 1 lần là dùng được cho mọi link rút gọn sau này, không cần
          quét lại mỗi lần dán link.
        </p>
      </Section>

      <Section title="🧠 Phân tích AI & Các Góc Nhìn (Lát Cắt)">
        <p>
          Ở trang chi tiết sản phẩm, bấm &lsquo;✨ Tạo bằng AI&rsquo; — app sẽ gộp TOÀN BỘ dữ liệu
          (tên, ảnh, mô tả, đánh giá của mọi link) gửi 1 lần cho Gemini. Điểm đặc biệt là bạn có thể chọn <strong>Góc nhìn (Prompt)</strong> phù hợp:
        </p>
        <ul className="list-disc pl-5 space-y-1 mt-2 mb-2 text-slate-700 dark:text-slate-300">
          <li><strong>Toàn diện:</strong> Đánh giá đầy đủ mọi mặt (Tệp khách, Kênh bán, Tùy chỉnh, Nhập khẩu, Vận chuyển, Khả thi).</li>
          <li><strong>Marketing / Pháp lý / Hoài nghi:</strong> Xoáy sâu vào một khía cạnh cụ thể nếu bạn cần thông tin chuyên sâu.</li>
          <li><strong>Mẹo:</strong> Chạy nhiều góc nhìn khác nhau trên cùng 1 sản phẩm để thấy được bức tranh toàn cảnh mà không bị AI thiên vị.</li>
        </ul>
        <p className="mt-2 text-amber-700 dark:text-amber-400 text-xs italic">
          ⚠️ Lưu ý: AI có thể bị lừa bởi review ảo. Các số liệu thuế/cước phí mang tính tham khảo, vui lòng đối chiếu luật hiện hành. Giữ tối đa 10 bản/sản phẩm.
        </p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          💡 Nếu 1 lượt tạo bị lỗi (vd hết quota, mất mạng giữa chừng), app tự báo lỗi chi tiết
          ngay trên màn hình rồi tự xóa bản lỗi đó — không giữ lại làm rác danh sách. Chi tiết lỗi
          vẫn được ghi vào &lsquo;📝 Log hoạt động&rsquo; nếu cần tra lại sau.
        </p>
      </Section>

      <Section title="⚖️ So sánh Sản phẩm (Ban cố vấn C-Level)">
        <p>
          Vào mục <strong>So sánh</strong> trên thanh điều hướng, chọn 2-5 sản phẩm để đưa lên "bàn cân". 
          Tính năng này tuyệt đối <strong>chỉ dùng dữ liệu cào GỐC</strong> để tránh thiên kiến cộng dồn.
        </p>
        <p className="mt-2">Hệ thống cung cấp sẵn 9 kịch bản So sánh mang tầm vóc chuyên gia:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2 text-slate-700 dark:text-slate-300">
          <li><strong>Góc nhìn Tài chính (CFO):</strong> Đánh giá vòng quay vốn, rủi ro chôn vốn, biên lợi nhuận.</li>
          <li><strong>Góc nhìn Vận hành (COO):</strong> So sánh độ cồng kềnh, tỷ lệ hỏng vỡ, khả năng scale.</li>
          <li><strong>Góc nhìn Pháp chế/CEO:</strong> Đánh giá rào cản xâm nhập (Moat), nguy cơ kiện cáo bản quyền, tiềm năng xây Brand riêng.</li>
          <li><strong>Chiến lược Phễu:</strong> Phân mảnh sản phẩm nào làm "mồi" câu khách, sản phẩm nào làm "chủ lực" chốt lời.</li>
          <li><strong>Sàng lọc khắc nghiệt (Battle Royale):</strong> Chế độ "Shark Tank" loại bỏ thẳng tay những sản phẩm rủi ro chí mạng.</li>
        </ul>
        <p className="mt-3">
          Chọn xong sản phẩm, bấm &lsquo;🚀 Tạo phiên đánh giá&rsquo; để LƯU LẠI thành 1 &lsquo;Phiên
          đánh giá&rsquo; thật trong database (khác với trước đây — chỉ sống tạm trong trình
          duyệt, F5 là mất). Mỗi lần bấm tạo là 1 phiên mới, không gộp vào phiên cũ, vì mỗi lần
          cân nhắc được coi là độc lập.
        </p>
        <div className="my-4">
          <GuideDiagram
            steps={[
              { icon: "☑️", label: "Chọn 2-5 sản phẩm" },
              { icon: "🚀", label: "Tạo phiên đánh giá" },
              { icon: "🧠", label: "Chạy nhiều lượt so sánh AI" },
              { icon: "📊", label: "Chấm điểm đa trục" },
              { icon: "🗂️", label: "Lưu vào Lịch sử đánh giá" },
            ]}
          />
        </div>
        <p>
          Trong 1 phiên, ngoài bảng so sánh còn có mục &lsquo;📊 Chấm điểm đa trục&rsquo; — AI
          chấm 15 tiêu chí nhỏ (gộp thành 5 nhóm: Tài chính, Vận hành, Thị trường, Pháp lý,
          Thương hiệu) thang điểm 0-100 cho từng sản phẩm, kèm lý do ngắn, vẽ thành biểu đồ radar
          để nhìn nhanh sản phẩm nào vượt trội mặt nào. Không đồng ý điểm AI chấm thì sửa tay
          từng ô, vẫn giữ điểm AI gốc để bấm quay lại bất cứ lúc nào.
        </p>
        <p className="mt-2">
          Mở lại phiên cũ bất cứ lúc nào ở sidebar &lsquo;🗂️ Lịch sử đánh giá&rsquo; — liệt kê
          toàn bộ phiên đã tạo, bấm vào 1 phiên để xem tiếp đúng chỗ đang dở.
        </p>
      </Section>

      <Section title="🏷️ Tỷ lệ markup theo ngành hàng">
        <p>
          Sản phẩm chỉ có giá bán lẻ (chưa có link Alibaba/1688) thì AI phải ước tính giá xưởng để
          tính lợi nhuận — nhưng mỗi ngành hàng chênh lệch giá bán lẻ/giá xưởng khác nhau (vd điện
          thoại chênh khác quần áo). Mục này cho khai báo tỷ lệ markup riêng theo từng ngành hàng
          thay vì dùng chung 1 con số cho tất cả, giúp AI ước tính sát hơn.
        </p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Cài đặt &gt; Tỷ lệ markup ngành hàng — mỗi dòng chọn ngành hàng + nhập % (hoặc &lsquo;gấp
          X lần&rsquo;, 2 ô tự đồng bộ nhau). Chỉ admin sửa được.
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

      <Section title="📝 Log hoạt động">
        <p>
          Sidebar &lsquo;📝 Log hoạt động&rsquo; ghi lại 200 thao tác gần nhất trong app — cào
          sản phẩm, sửa cài đặt, đổi tỷ giá, đăng nhập Taobao, xóa bản phân tích lỗi... kèm thời
          gian và người thực hiện. Dùng để tra lại &lsquo;ai đã làm gì, lúc nào&rsquo; khi có
          nhiều người cùng dùng chung 1 máy/tài khoản.
        </p>
      </Section>

      <Section title="🔔 Cập nhật app tự động">
        <p>
          App tự kiểm tra bản mới mỗi khi mở + định kỳ mỗi 4 giờ (chỉ hoạt động trên bản .exe đã
          cài đặt, không áp dụng khi chạy bằng lệnh &lsquo;npm run dev&rsquo;). Toàn bộ tiến trình
          hiện rõ bằng 1 khung nhỏ ở góc dưới-phải màn hình, đi qua từng bước:
        </p>
        <div className="my-4">
          <GuideDiagram
            steps={[
              { icon: "🔎", label: "Đang kiểm tra bản mới" },
              { icon: "⬇️", label: "Đang tải... (hiện % rõ ràng)" },
              { icon: "✅", label: "Tải xong" },
              { icon: "🔄", label: "Tự cài đặt + khởi động lại" },
            ]}
          />
        </div>
        <p>
          Tải xong, app <strong>tự đếm ngược 10 giây rồi tự cài đặt + khởi động lại</strong> —
          không cần bấm gì cả. Muốn cập nhật ngay không chờ đếm ngược thì bấm &lsquo;Cài đặt
          ngay&rsquo; trong khung đó. App đóng lại vài giây để cài, rồi tự mở lại đúng phiên bản
          mới, không cần tự tìm icon mở lại.
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
