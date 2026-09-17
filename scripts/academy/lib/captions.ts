import type { Page } from "@playwright/test";

/**
 * The tutorials have no audio, so captions carry the whole explanation. They are
 * injected as real DOM, which means they record naturally into the screencast
 * and need no post-processing.
 *
 * Dwell time is deliberate: with no narration to pace the viewer, a caption that
 * disappears before it can be read makes the video useless.
 */

const OVERLAY_ID = "__aliice_capture_overlay__";
const MIN_DWELL_MS = 1800;
const MS_PER_CHARACTER = 45;

export function dwellFor(text: string): number {
  return Math.max(MIN_DWELL_MS, Math.round(text.length * MS_PER_CHARACTER));
}

export async function installOverlay(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      #${OVERLAY_ID} {
        position: fixed; inset: auto 0 0 0; z-index: 2147483647;
        display: flex; align-items: center; gap: 16px;
        padding: 18px 28px;
        background: linear-gradient(to top, rgba(2,6,23,0.94), rgba(2,6,23,0.82));
        color: #f8fafc; font-size: 19px; line-height: 1.45; font-weight: 500;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        opacity: 0; transition: opacity 180ms ease; pointer-events: none;
      }
      #${OVERLAY_ID}[data-visible="true"] { opacity: 1; }
      #${OVERLAY_ID} .step {
        flex: none; min-width: 58px; padding: 4px 10px; border-radius: 999px;
        background: rgba(56,189,248,0.18); color: #7dd3fc;
        font-size: 13px; font-weight: 600; text-align: center;
      }
      #${OVERLAY_ID} .title-card {
        position: fixed; inset: 0; display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 12px;
        background: #020617; color: #f8fafc; text-align: center;
      }
      /* Deterministic frames: animation makes diffs and recordings noisy. */
      *, *::before, *::after {
        animation-duration: 0s !important; animation-delay: 0s !important;
        transition-duration: 0s !important; transition-delay: 0s !important;
        scroll-behavior: auto !important;
      }
    `,
  });

  await page.evaluate((id) => {
    if (document.getElementById(id)) return;
    const bar = document.createElement("div");
    bar.id = id;
    bar.innerHTML = `<span class="step"></span><span class="text"></span>`;
    document.body.appendChild(bar);
  }, OVERLAY_ID);
}

export async function showCaption(
  page: Page,
  text: string,
  step?: { index: number; total: number }
): Promise<void> {
  await page.evaluate(
    ({ id, text, step }) => {
      const bar = document.getElementById(id);
      if (!bar) return;
      const stepEl = bar.querySelector<HTMLElement>(".step");
      const textEl = bar.querySelector<HTMLElement>(".text");
      if (stepEl) {
        stepEl.textContent = step ? `${step.index} / ${step.total}` : "";
        stepEl.style.display = step ? "block" : "none";
      }
      if (textEl) textEl.textContent = text;
      bar.setAttribute("data-visible", "true");
    },
    { id: OVERLAY_ID, text, step }
  );
}

export async function hideCaption(page: Page): Promise<void> {
  await page.evaluate((id) => {
    document.getElementById(id)?.setAttribute("data-visible", "false");
  }, OVERLAY_ID);
}

/** Full-screen card used to open and close each tutorial. */
export async function showCard(
  page: Page,
  title: string,
  subtitle: string,
  ms = 2200
): Promise<void> {
  await page.evaluate(
    ({ title, subtitle }) => {
      const card = document.createElement("div");
      card.className = "title-card";
      card.id = "__aliice_capture_card__";
      card.style.cssText =
        "position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;" +
        "align-items:center;justify-content:center;gap:14px;background:#020617;color:#f8fafc;" +
        'text-align:center;font-family:ui-sans-serif,system-ui,"Segoe UI",sans-serif;';
      card.innerHTML =
        `<div style="font-size:15px;letter-spacing:.14em;text-transform:uppercase;color:#38bdf8">${subtitle}</div>` +
        `<div style="font-size:40px;font-weight:700;max-width:70%">${title}</div>`;
      document.body.appendChild(card);
    },
    { title, subtitle }
  );
  await page.waitForTimeout(ms);
  await page.evaluate(() => document.getElementById("__aliice_capture_card__")?.remove());
}

/** Screenshots should be clean, so the caption bar is hidden around them. */
export async function withoutOverlay<T>(page: Page, fn: () => Promise<T>): Promise<T> {
  await page.evaluate((id) => {
    const bar = document.getElementById(id);
    if (bar) bar.style.display = "none";
  }, OVERLAY_ID);
  try {
    return await fn();
  } finally {
    await page.evaluate((id) => {
      const bar = document.getElementById(id);
      if (bar) bar.style.display = "flex";
    }, OVERLAY_ID);
  }
}
