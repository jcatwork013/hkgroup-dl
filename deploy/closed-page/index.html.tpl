<!doctype html>
<!-- Template trang TẠM ĐÓNG duoclieuhk (render bởi deploy/hk-site.sh → /var/www/duoclieuhk-closed/) -->
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#102417">
<title>{{TITLE}} · HKGROUP</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
       font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
       color:#f6f1e7;background:radial-gradient(1200px 600px at 50% -10%,#1f3d2a 0%,#102417 55%,#0a1a10 100%)}
  .card{width:100%;max-width:560px;text-align:center;background:rgba(246,241,231,.04);
        border:1px solid rgba(197,160,89,.28);border-radius:20px;padding:44px 32px;
        box-shadow:0 24px 60px rgba(0,0,0,.35)}
  .eyebrow{font-size:12px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:#c5a059;margin:0 0 14px}
  .brand{font-size:30px;font-weight:700;letter-spacing:.04em;margin:0 0 18px}
  h1{font-size:24px;line-height:1.35;margin:0 0 14px;font-weight:700}
  p{margin:0 0 18px;font-size:15px;line-height:1.75;color:rgba(246,241,231,.82)}
  .until{display:inline-block;margin-bottom:6px;padding:8px 16px;border-radius:999px;font-size:14px;font-weight:600;
         color:#e2cd8f;background:rgba(197,160,89,.12);border:1px solid rgba(197,160,89,.35)}
  .contact{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:26px}
  .btn{display:inline-block;padding:11px 20px;border-radius:12px;font-size:14px;font-weight:600;text-decoration:none}
  .btn-gold{background:#c5a059;color:#1a1407}
  .btn-gold:hover{background:#d4b46b}
  .btn-ghost{border:1px solid rgba(246,241,231,.4);color:#f6f1e7}
  .btn-ghost:hover{background:rgba(246,241,231,.1)}
  .foot{margin:28px 0 0;font-size:12px;color:rgba(246,241,231,.45)}
  @media (max-width:480px){.card{padding:32px 22px}h1{font-size:21px}.brand{font-size:26px}}
</style>
</head>
<body>
  <main class="card">
    <p class="eyebrow">Dược liệu lên men</p>
    <p class="brand">HKGROUP</p>
    <h1>{{TITLE}}</h1>
    <p>{{MESSAGE}}</p>
    {{UNTIL_BLOCK}}
    <div class="contact">
      <a class="btn btn-gold" href="tel:{{TEL}}">Gọi {{HOTLINE}}</a>
      <a class="btn btn-ghost" href="mailto:{{EMAIL}}">{{EMAIL}}</a>
    </div>
    <p class="foot">Cảm ơn Quý khách đã đồng hành cùng HKGROUP.</p>
  </main>
</body>
</html>
