import puppeteer from "puppeteer-core";

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
  });
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

  console.error("Starting Chromium...");
  const browser = await puppeteer.launch({
    executablePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-sync",
      "--disable-translate",
      "--no-first-run",
      "--single-process",
      "--font-render-hinting=none",
    ],
    headless: "new",
  });

  try {
    console.error("Creating page...");
    const page = await browser.newPage();
    
    // Desabilitar recursos desnecessários
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (type === 'image' || type === 'stylesheet' || type === 'font') {
        req.continue();
      } else if (type === 'script') {
        req.continue();
      } else {
        req.continue();
      }
    });

    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1.5 });

    console.error("Setting HTML content...");
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 20000 });
    
    // Aguardar scripts executarem
    console.error("Waiting for scripts...");
    await new Promise(r => setTimeout(r, 800));
    
    // Aguardar ECharts (com timeout curto)
    try {
      await page.waitForFunction(
        "window.__FOHAT_ECHARTS_READY__ === true",
        { timeout: 5000 }
      );
      console.error("ECharts ready!");
    } catch (_) {
      console.error("ECharts timeout - continuing...");
    }
    
    // Delay final
    await new Promise(r => setTimeout(r, 200));

    console.error("Generating PDF...");
    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    });

    console.error("PDF generated successfully!");
    process.stdout.write(Buffer.from(pdf));
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
