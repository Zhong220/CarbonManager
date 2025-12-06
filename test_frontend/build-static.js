// build-static.js
const fs = require("fs");
const path = require("path");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CarbonManager Frontend (Fake)</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: system-ui, sans-serif; padding: 2rem; background: #f5f5f5; }
    .card { max-width: 480px; margin: 0 auto; background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .tag { display: inline-block; padding: 0.15rem 0.5rem; font-size: 0.75rem; border-radius: 999px; background: #e0f2fe; color: #0369a1; margin-bottom: 0.5rem; }
    code { background: #f1f5f9; padding: 0.1rem 0.3rem; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="tag">Fake Frontend</div>
    <h1>CarbonManager Frontend (Test)</h1>
    <p>If you can see this page, the <strong>frontend Dockerfile + nginx + docker-compose + deploy script</strong> are wired correctly 🎉</p>
    <p>Next steps: replace this fake build with the real React/Vite app later.</p>
    <p>Backend API is expected at <code>/api</code> (proxied to the backend service in Docker).</p>
  </div>
</body>
</html>
`;

const outDir = path.join(__dirname, "dist");
const outFile = path.join(outDir, "index.html");

// Ensure dist directory exists
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(outFile, html, "utf8");
console.log(`Wrote ${outFile}`);
