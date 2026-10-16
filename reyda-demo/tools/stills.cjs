// Export vector stills (SVG) of the composition at chosen moments.
// Each frame is printed to a vector PDF by Chromium, then converted with pdftocairo, so text,
// shapes and UI stay as vector paths; raster sources (form pages, blurred background) stay embedded.
// usage: node tools/stills.cjs <outDir>          (needs playwright + poppler's pdftocairo)
const { chromium } = require("playwright");
const path = require("path"), fs = require("fs"), { execFileSync } = require("child_process");

const STILLS = [
  ["01-hook-buried-in-paperwork", 3.4],
  ["02-meet-emma", 7.6],
  ["03-your-ai-bid-manager", 9.2],
  ["04-find-opportunities", 15.2],
  ["05-see-buying-history", 19.0],
  ["06-spot-expiring-contracts", 22.0],
  ["07-reviews-requirements", 26.9],
  ["08-drafts-proposal", 33.1],
  ["09-forms-tw01-teilnahmeantrag", 36.6],
  ["10-forms-tw02-allgemeine-angaben", 39.05],
  ["11-forms-tw02-eigenerklaerungen", 40.74],
  ["12-works-where-you-work", 47.6],
  ["13-ready-for-review", 54.2],
  ["14-cta-less-paperwork", 59.0],
];

const OUT = path.resolve(process.argv[2] || "stills");
fs.mkdirSync(OUT, { recursive: true });
const page_url = "file://" + path.resolve(__dirname, "..", "index.html");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  // outside the HyperFrames runtime: provide the timeline registry the composition writes to
  await page.addInitScript(() => { window.__timelines = {}; });
  await page.goto(page_url, { waitUntil: "load" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((im) => (im.complete ? 0 : new Promise((r) => (im.onload = im.onerror = r)))));
  });
  await page.emulateMedia({ media: "screen" });
  for (const [name, t] of STILLS) {
    await page.evaluate((t) => {
      // what the runtime does per frame: only clips whose window contains t are shown
      document.querySelectorAll("#root > [data-start]").forEach((el) => {
        const s = parseFloat(el.dataset.start), d = parseFloat(el.dataset.duration);
        el.style.display = t >= s && t < s + d ? "" : "none";
      });
      window.__timelines.main.seek(t);
      // a rolling counter caught between digits reads badly in a still: snap each digit rail to a whole digit
      document.querySelectorAll(".rail").forEach((rail) => {
        const step = 100 / rail.children.length, y = gsap.getProperty(rail, "yPercent");
        gsap.set(rail, { yPercent: Math.round(y / step) * step });
      });
    }, t);
    const pdf = path.join(OUT, name + ".pdf");
    await page.pdf({ path: pdf, width: "1920px", height: "1080px", printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, pageRanges: "1" });
    const svg = path.join(OUT, name + ".svg");
    execFileSync("pdftocairo", ["-svg", pdf, svg]);
    // pdftocairo sizes the SVG in PDF points (1440 × 810); present it at the video's 1920 × 1080
    fs.writeFileSync(svg, fs.readFileSync(svg, "utf8").replace('width="1440" height="810" viewBox="0 0 1440 810"', 'width="1920" height="1080" viewBox="0 0 1440 810"'));
    fs.unlinkSync(pdf);
    console.log("wrote", name + ".svg", "@", t + "s");
  }
  await browser.close();
})();
