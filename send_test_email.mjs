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

const subject = "Test — Aesthetic Clinic email formatting";

const plainBody = `Hello,

This is a real test email sent from the Aesthetic Clinic production app to verify that AI-generated formatting is preserved when the email is delivered.

The paragraphs you see here were converted from plain text into proper HTML before being sent.

Best regards,
Aesthetic Clinic`;

const html = plainTextToHtml(plainBody);

const prodUrl = "https://aestheticclinic.vercel.app/api/emails/send";

async function main() {
  console.log("Sending real email to:", to);
  console.log("Using production endpoint:", prodUrl);

  const response = await fetch(prodUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to,
      subject,
      html,
    }),
  });

  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  console.log("\nResponse status:", response.status);
  console.log("Response body:", json ?? text);

  if (!response.ok) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
