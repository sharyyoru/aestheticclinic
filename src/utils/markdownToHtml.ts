/**
 * Convert markdown-style text to HTML for email formatting.
 * Handles: **bold**, *italic*, bullet points (* or -), paragraphs, and line breaks.
 */
export function markdownToHtml(text: string): string {
  if (!text) return "";

  // Split into lines first to identify bullet points
  const lines = text.split("\n");
  const result: string[] = [];
  let inBulletList = false;
  let currentParagraph: string[] = [];

  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function formatInlineMarkdown(str: string): string {
    let formatted = escapeHtml(str);
    // Convert **bold** to <strong> (must come before single *)
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    // Convert *italic* to <em> (single asterisks for inline text)
    formatted = formatted.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
    return formatted;
  }

  function flushParagraph() {
    if (currentParagraph.length > 0) {
      const content = currentParagraph.join("<br>");
      if (content.trim()) {
        result.push(`<p>${content}</p>`);
      }
      currentParagraph = [];
    }
  }

  function closeBulletList() {
    if (inBulletList) {
      result.push("</ul>");
      inBulletList = false;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Check if it's a bullet point (starts with * or - followed by space)
    const bulletMatch = trimmedLine.match(/^[\*\-]\s+(.+)$/);

    if (bulletMatch) {
      // Flush any pending paragraph before starting bullets
      flushParagraph();

      if (!inBulletList) {
        result.push("<ul>");
        inBulletList = true;
      }
      // Format the bullet content (bold/italic) but not the bullet marker
      result.push(`<li>${formatInlineMarkdown(bulletMatch[1])}</li>`);
    } else if (trimmedLine === "") {
      // Empty line = paragraph break
      closeBulletList();
      flushParagraph();
    } else if (trimmedLine === "---" || trimmedLine === "—") {
      // Horizontal rule / separator
      closeBulletList();
      flushParagraph();
      result.push("<hr style=\"border: none; border-top: 1px solid #e2e8f0; margin: 16px 0;\">");
    } else {
      // Regular text line - apply inline formatting
      closeBulletList();
      currentParagraph.push(formatInlineMarkdown(trimmedLine));
    }
  }

  // Flush remaining content
  closeBulletList();
  flushParagraph();

  return result.join("");
}

/**
 * Simple plain text to HTML converter (for non-markdown content).
 * Only handles paragraphs and line breaks, no markdown formatting.
 */
export function plainTextToHtml(text: string): string {
  if (!text) return "";

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
