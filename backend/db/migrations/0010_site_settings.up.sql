-- 0010 SITE SETTINGS — CMS điều khiển toàn bộ nội dung trang (title/logo/footer/hero/faq...).
-- Lưu 1 document JSON dưới key='site'. Admin sửa qua PUT; public đọc qua GET.

CREATE TABLE site_settings (
    key        TEXT PRIMARY KEY,
    value      JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO site_settings (key, value) VALUES ('site', '{
  "seo": {
    "title": "HKGROUP — Dược liệu lên men, tinh hoa từ thiên nhiên Việt",
    "titleTemplate": "%s · HKGROUP",
    "description": "HKGROUP — dược liệu lên men theo công thức cổ truyền kết hợp công nghệ hiện đại. Sản phẩm chuẩn hoá, truy xuất nguồn gốc, chương trình Affiliate minh bạch.",
    "keywords": "dược liệu, lên men, thảo dược, HKGROUP, sức khỏe, đông trùng hạ thảo, linh chi"
  },
  "brand": { "name": "HKGROUP", "logoUrl": "", "tagline": "Since 2019" },
  "hero": {
    "eyebrow": "HKGROUP · Since 2019",
    "titleLead": "Dược liệu lên men,",
    "titleAccent": "tinh hoa",
    "titleRest": "từ thiên nhiên Việt",
    "subtitle": "Công thức cổ truyền kết hợp công nghệ lên men hiện đại — mang lại sự cân bằng cho cơ thể mỗi ngày.",
    "ctaPrimary": "Khám phá sản phẩm",
    "ctaSecondary": "Trở thành Affiliate"
  },
  "stats": [
    { "value": "2019", "label": "Năm thành lập" },
    { "value": "100%", "label": "Dược liệu Việt" },
    { "value": "90 ngày", "label": "Lên men chuẩn" }
  ],
  "contact": { "phone": "1900 0000", "email": "hello@hkgroup.vn", "address": "Hà Nội, Việt Nam" },
  "footer": {
    "about": "Dược liệu lên men theo công thức cổ truyền kết hợp công nghệ hiện đại — mang lại sự cân bằng cho cơ thể mỗi ngày.",
    "copyright": "HKGROUP. Bảo lưu mọi quyền.",
    "facebook": "", "youtube": "", "zalo": ""
  },
  "faq": [
    { "q": "Dược liệu lên men là gì?", "a": "Là dược liệu được xử lý bằng công nghệ lên men để tăng sinh khả dụng hoạt chất, dễ hấp thu và bảo quản tốt hơn." },
    { "q": "Sản phẩm có nguồn gốc rõ ràng không?", "a": "Có. Toàn bộ vùng trồng đạt chuẩn, truy xuất nguồn gốc minh bạch theo từng lô." },
    { "q": "Chương trình Affiliate hoạt động thế nào?", "a": "Affiliate 1 tầng: hoa hồng tính trên sổ kép minh bạch cho mỗi đơn hoàn tất, rút theo lịch cố định trong tháng." },
    { "q": "Tôi nhận hàng trong bao lâu?", "a": "Đơn được tự động gán cho hub gần nhất theo khu vực, giao nhanh và đảm bảo sản phẩm tươi mới." }
  ]
}'::jsonb);
