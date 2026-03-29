const axios = require("axios");
const { fetchEmails } = require("./emailFetcher");

const WEBHOOK = "http://localhost:5678/webhook/email-intelligence";

async function fetchAndProcess() {
  try {
    console.log("🚀 Starting email pipeline...");

    const emails = await fetchEmails();

    console.log("📨 Emails fetched:", emails.length);

    if (!emails || emails.length === 0) {
      return {
        type: "email_summary",
        data: {
          events: [],
          deadlines: [],
          summary: "No new emails in last 24 hours"
        }
      };
    }

    console.log("📡 Sending to n8n...");

    const response = await axios.post(WEBHOOK, {
      emails,
      fetchedAt: new Date().toISOString()
    });

    console.log("✅ n8n response received");

    // 🔥 IMPORTANT CHANGE
    return {
      type: "email_summary",
      data: response.data[0]   // because your response is [ { events, deadlines } ]
    };

  } catch (err) {
    console.error("❌ Email pipeline failed:", err.message);

    return {
      type: "error",
      data: "Email system failed"
    };
  }
}

module.exports = { fetchAndProcess };