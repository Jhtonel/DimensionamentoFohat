import puppeteer from "puppeteer-core";

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const html = await readStdin();
  if (!html || !html.trim()) {
    console.error("No HTML provided on stdin.");
    process.exit(2);
  }

  const executablePath =
    process.env.CHROMIUM_PATH ||
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    "/usr/bin/chromium";

  const browser = await puppeteer.launch({
    executablePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--font-render-hinting=none",
    ],
    headless: "new",
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 2 });

    // Render HTML - usar domcontentloaded em vez de networkidle0 (mais rápido)
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30000 });
    
    // Aguardar um pouco para scripts executarem
    await delay(500);
    
    // Aguardar fontes carregarem
    try {
      await page.evaluate(() => document.fonts?.ready);
    } catch (_) {}
    
    // Aguardar ECharts renderizar (com timeout curto)
    try {
      await page.waitForFunction(
        "window.__FOHAT_ECHARTS_READY__ === true",
        { timeout: 10000 }
      );
    } catch (_) {
      // Se timeout, continua mesmo assim
      console.error("ECharts ready timeout - continuing anyway");
    }
    
    // Delay final para layout estabilizar
    await delay(300);

    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    });

    process.stdout.write(Buffer.from(pdf));
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
