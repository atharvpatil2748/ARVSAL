const puppeteer = require("puppeteer");
const fs = require("fs");

async function saveSession() {
  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox"]
  });

  const page = await browser.newPage();

  await page.goto("https://webmail.iitk.ac.in/squirrelmail/src/login.php", {
    waitUntil: "networkidle2"
  });

  console.log("👉 LOGIN MANUALLY (take your time)");

  // Wait until login completes
  await page.waitForFunction(() => {
    return !window.location.href.includes("login.php");
  }, { timeout: 180000 });

  console.log("✅ Login detected");

  // Wait for UI
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Save cookies
  const cookies = await page.cookies();
  fs.writeFileSync("cookies.json", JSON.stringify(cookies, null, 2));

  console.log("💾 Session saved successfully!");

  await browser.close();
}

saveSession();