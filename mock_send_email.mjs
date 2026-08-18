import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

function plainTextToHtml(text) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return escaped
    .split(/\n\n+/)
    .map((paragraph) => {
      const lines = paragraph
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      if (lines.length === 0) return "";
      return `<p>${lines.join("<br>")}</p>`;
    })
    .filter((p) => p.length > 0)
    .join("");
}

const to = process.argv[2] || "macarioloupresto@gmail.com";

const subject = "Your consultation with Aesthetics Clinic";

const plainBody = `Dear Mr. Lou Presto,

Thank you for your message. We would be delighted to welcome you for a consultation with one of our specialists.

During the appointment, we will review your expectations, explain the available options, and answer all your questions in a relaxed and confidential setting.

Please feel free to contact us if you need any further information.

Best regards,
Aesthetics Clinic`;

const htmlBody = plainTextToHtml(plainBody);

const payload = {
  to,
  subject,
  from: `${process.env.MAILGUN_FROM_NAME || "Clinic"} <${process.env.MAILGUN_FROM_EMAIL || `clinic@${process.env.MAILGUN_DOMAIN}`}>`,
  html: htmlBody,
};

console.log("--- MOCK EMAIL SEND ---");
console.log("NOTE: this is a mock — no actual request was made to Mailgun.");
console.log("Payload that would be sent:\n");
console.log(JSON.stringify(payload, null, 2));
