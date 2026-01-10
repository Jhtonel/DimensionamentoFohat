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
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });
    
    // Aguardar scripts executarem completamente
    console.error("Waiting for scripts...");
    await new Promise(r => setTimeout(r, 1500));
    
    // Aguardar ECharts renderizar os gráficos
    try {
      await page.waitForFunction(
        "window.__FOHAT_ECHARTS_READY__ === true",
        { timeout: 10000 }
      );
      console.error("ECharts ready!");
      // Dar tempo extra para os gráficos SVG serem renderizados
      await new Promise(r => setTimeout(r, 1000));
    } catch (_) {
      console.error("ECharts timeout - continuing anyway...");
    }
    
    // Aguardar todas as imagens e SVGs carregarem
    try {
      await page.evaluate(() => {
        return Promise.all([
          ...Array.from(document.images).filter(img => !img.complete).map(img => 
            new Promise(resolve => { img.onload = img.onerror = resolve; })
          ),
          ...Array.from(document.querySelectorAll('svg')).map(() => Promise.resolve())
        ]);
      });
    } catch (_) {
      console.error("Image wait error - continuing...");
    }
    
    // Delay final para garantir renderização completa
    await new Promise(r => setTimeout(r, 500));

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
