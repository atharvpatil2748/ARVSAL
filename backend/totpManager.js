const speakeasy = require("speakeasy");
const fs = require("fs");
const path = require("path");

const SECRET_FILE = path.join(__dirname, "totp_secret.json");

function generateSecret() {

  // If secret already exists, reuse it
  if (fs.existsSync(SECRET_FILE)) {
    const saved = JSON.parse(fs.readFileSync(SECRET_FILE));
    return saved.base32;
  }

  const secret = speakeasy.generateSecret({ length: 20 });

  fs.writeFileSync(
    SECRET_FILE,
    JSON.stringify({ base32: secret.base32 })
  );

  return secret.base32;
}

function verifyToken(token) {

  if (!fs.existsSync(SECRET_FILE)) return false;

  const saved = JSON.parse(fs.readFileSync(SECRET_FILE));

  return speakeasy.totp.verify({
    secret: saved.base32,
    encoding: "base32",
    token,
    window: 1
  });
}

module.exports = {
  generateSecret,
  verifyToken
};