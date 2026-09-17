import type { DocModule, DocSection } from "../../../src/app/documentation/content/types";
import type { ManifestShot } from "./manifest";

/**
 * Renders a documentation module as lesson HTML for the Academy.
 *
 * The Academy lesson page renders `content` with dangerouslySetInnerHTML inside a
 * `prose` wrapper, so figures and images work with no component change.
 *
 * This replaces the previous hardcoded LESSON_CONTENT_MAP plus Gemini fallback,
 * which invented features the platform does not have (two-factor auth, CSV
 * export, a "New Patient" button, Lead/Prospect/VIP lifecycle stages).
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function figure(shot: ManifestShot): string {
  const src = shot.publicUrl;
  if (!src) return "";
  return `<figure class="not-prose my-6">
  <img src="${escapeHtml(src)}" alt="${escapeHtml(shot.alt)}" loading="lazy" class="w-full rounded-xl border border-slate-200" />
  <figcaption class="mt-2 text-xs text-slate-500">${escapeHtml(shot.alt)}</figcaption>
</figure>`;
}

function renderSection(section: DocSection, shots: ManifestShot[]): string {
  const parts: string[] = [`<h3>${escapeHtml(section.heading)}</h3>`];

  if (section.intro) parts.push(`<p>${escapeHtml(section.intro)}</p>`);

  for (const shot of shots.filter((s) => s.sectionId === section.id)) {
    const html = figure(shot);
    if (html) parts.push(html);
  }

  if (section.features?.length) {
    parts.push(
      `<ul>${section.features
        .map(
          (f) =>
            `<li><strong>${escapeHtml(f.name)}</strong> — ${escapeHtml(f.description)}${
              f.where ? ` <em>${escapeHtml(f.where)}</em>` : ""
            }</li>`
        )
        .join("")}</ul>`
    );
  }

  if (section.steps?.length) {
    parts.push(
      `<ol>${section.steps
        .map(
          (s) =>
            `<li><strong>${escapeHtml(s.title)}</strong><br/>${escapeHtml(s.body)}${
              s.note ? `<br/><em>${escapeHtml(s.note)}</em>` : ""
            }</li>`
        )
        .join("")}</ol>`
    );
  }

  if (section.bullets?.length) {
    parts.push(`<ul>${section.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`);
  }

  if (section.table) {
    parts.push(
      `<table><thead><tr>${section.table.columns
        .map((c) => `<th>${escapeHtml(c)}</th>`)
        .join("")}</tr></thead><tbody>${section.table.rows
        .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
        .join("")}</tbody></table>`
    );
  }

  for (const callout of section.callouts ?? []) {
    const label = callout.title ?? callout.kind;
    parts.push(
      `<blockquote><p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(callout.body)}</p></blockquote>`
    );
  }

  return parts.join("\n");
}

export function lessonHtml(doc: DocModule, shots: ManifestShot[], docsUrl: string): string {
  const parts: string[] = [`<p class="lead">${escapeHtml(doc.summary)}</p>`];

  // Screenshots with no section of their own lead the lesson.
  const sectionIds = new Set(doc.sections.map((s) => s.id));
  for (const shot of shots.filter((s) => !s.sectionId || !sectionIds.has(s.sectionId))) {
    const html = figure(shot);
    if (html) parts.push(html);
  }

  if (doc.keyCapabilities.length) {
    parts.push("<h3>What you can do here</h3>");
    parts.push(`<ul>${doc.keyCapabilities.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>`);
  }

  if (doc.appPath.length) {
    parts.push(
      `<p><strong>Where to find it:</strong> ${doc.appPath.map(escapeHtml).join(" › ")}</p>`
    );
  }

  for (const section of doc.sections) parts.push(renderSection(section, shots));

  if (doc.faqs?.length) {
    parts.push("<h3>Frequently asked</h3>");
    parts.push(
      `<dl>${doc.faqs
        .map(
          (f) => `<dt><strong>${escapeHtml(f.question)}</strong></dt><dd>${escapeHtml(f.answer)}</dd>`
        )
        .join("")}</dl>`
    );
  }

  parts.push(
    `<p><a href="${escapeHtml(docsUrl)}/${escapeHtml(doc.slug)}">Full reference: ${escapeHtml(
      doc.title
    )}</a></p>`
  );

  return `<div class="lesson-content">\n${parts.join("\n")}\n</div>`;
}

/** Reading time from content volume plus video length. */
export function estimateMinutes(doc: DocModule, videoSeconds?: number): number {
  const words =
    (doc.summary + doc.keyCapabilities.join(" ")).split(/\s+/).length +
    doc.sections.reduce((total, section) => {
      const text = [
        section.intro ?? "",
        ...(section.bullets ?? []),
        ...(section.features ?? []).map((f) => `${f.name} ${f.description}`),
        ...(section.steps ?? []).map((s) => `${s.title} ${s.body}`),
      ].join(" ");
      return total + text.split(/\s+/).length;
    }, 0);

  const readingMinutes = words / 180;
  const videoMinutes = (videoSeconds ?? 0) / 60;
  return Math.max(2, Math.round(readingMinutes + videoMinutes));
}
