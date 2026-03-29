// node backend/email/emailFetcher.js
const puppeteer = require("puppeteer");
const fs = require("fs");
const { execSync } = require("child_process");

async function fetchEmails() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"]
  });

  const page = await browser.newPage();

  // 🔹 Load cookies safely
  let cookies;
  try {
    cookies = JSON.parse(fs.readFileSync("cookies.json"));
    await page.setCookie(...cookies);
  } catch (err) {
    console.log("⚠️ No cookies found. Running saveSession...");
    execSync("node backend/email/saveSession.js", { stdio: "inherit" });
    cookies = JSON.parse(fs.readFileSync("cookies.json"));
    await page.setCookie(...cookies);
  }

  // 🔹 Open inbox
  await page.goto(
    "https://webmail.iitk.ac.in/squirrelmail/src/right_main.php",
    { waitUntil: "networkidle2" }
  );

  console.log("✅ Session restored");

  let inboxFrame = page.frames().find(f => f.url().includes("right_main"));

  if (!inboxFrame) {
    console.log("⚠️ Session expired → Re-login");
    await browser.close();

    execSync("node backend/email/saveSession.js", { stdio: "inherit" });
    return fetchEmails(); // retry
  }

  await inboxFrame.waitForSelector("table");

  console.log("📩 Extracting emails...");

  // 🔹 Extract emails (WITH DATE)
  const emails = await inboxFrame.evaluate(() => {
    const rows = document.querySelectorAll("tr");
    let data = [];

    rows.forEach(row => {
      const cols = row.querySelectorAll("td");

      if (cols.length >= 5) {
        const sender = cols[1]?.innerText.trim();
        const date = cols[2]?.innerText.trim();
        const subject = cols[4]?.innerText.trim();
        const link = cols[4]?.querySelector("a")?.href;

        if (
          sender &&
          subject &&
          link &&
          date &&
          sender !== "Date" &&
          !sender.includes("From") &&
          !sender.includes("\n")
        ) {
          data.push({ sender, subject, link, date });
        }
      }
    });

    return data.slice(0, 15);
  });

  console.log("📩 Raw Emails:", emails);

  // 🚨 Detect session failure (empty inbox is suspicious)
    if (!emails || emails.length === 0) {
    console.log("⚠️ Possible session expiry detected (no emails)");

    await browser.close();

    console.log("🔐 Re-authentication required...");
    execSync("node backend/email/saveSession.js", { stdio: "inherit" });

    return fetchEmails(); // 🔁 retry automatically
    }

  function parseEmailDate(dateStr) {
  const now = new Date();

  // Case 1: "10:30 AM" → today
  if (dateStr.toLowerCase().includes("am") || dateStr.toLowerCase().includes("pm")) {
    const [time, modifier] = dateStr.split(" ");
    let [hours, minutes] = time.split(":").map(Number);

    if (modifier.toLowerCase() === "pm" && hours !== 12) hours += 12;
    if (modifier.toLowerCase() === "am" && hours === 12) hours = 0;

    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    return d;
  }

  // Case 2: "Mar 27"
  const parsed = new Date(`${dateStr} ${now.getFullYear()}`);
  return parsed;
}

  // 🔥 FILTER TODAY EMAILS
  const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const filteredEmails = emails.filter(e => {
    const emailDate = parseEmailDate(e.date);
    return emailDate >= last24Hours;
    });

  console.log("🔥 Today's Emails:", filteredEmails);

  // 🔥 FETCH BODY FOR EACH (limit 5 for speed)
  const finalEmails = [];

  for (let i = 0; i < filteredEmails.length; i++) {
    const email = filteredEmails[i];

    console.log(`📄 Fetching body for: ${email.subject}`);

    await page.goto(email.link, { waitUntil: "networkidle2" });

    const body = await page.evaluate(() => {
      let el =
        document.querySelector(".bodyclass") ||
        document.querySelector("#forwardbody1");

      if (el && el.innerText.trim().length > 20) {
        return el.innerText.trim();
      }

      let best = "";

      document.querySelectorAll("div, td").forEach(node => {
        const text = node.innerText?.trim();

        if (
          text &&
          text.length > best.length &&
          !text.includes("Current Folder") &&
          !text.includes("Move Selected To") &&
          !text.includes("Viewing Messages")
        ) {
          best = text;
        }
      });

      return best;
    });

    finalEmails.push({
      sender: email.sender,
      subject: email.subject,
      body: body
    });
  }

  console.log("🧠 Final Emails (DEBUG):", finalEmails);

  await browser.close();

  return finalEmails;
}

module.exports = { fetchEmails };