import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { narration as narrationEnv } from "./env";
import { ensureOutDir } from "./manifest";
import { probeDurationSeconds } from "./ffmpeg";

/**
 * Narration is synthesised BEFORE capture, and its measured duration is what
 * the capture dwells for on each step.
 *
 * Doing it the other way round — record first, then narrate — is what makes
 * tutorial videos drift: the voice finishes while the pointer is still moving,
 * or the screen changes mid-sentence. Generating audio first and measuring it
 * with ffprobe means picture, voice and captions are locked together by
 * construction rather than by a guessed words-per-minute constant.
 */

const TTS_MODEL = "gemini-2.5-flash-preview-tts";
const TTS_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent`;

/** Minimum time a step stays on screen, so a three-word caption is still readable. */
const MIN_STEP_SECONDS = 2.2;
/** Breathing room after the voice stops before the next step begins. */
const TAIL_SECONDS = 0.45;

export type NarratedStep = {
  index: number;
  text: string;
  /** Absent when running with NARRATION_PROVIDER=none. */
  audioPath?: string;
  /** Seconds the capture should hold this step, including the tail. */
  dwellSeconds: number;
  startSeconds: number;
  endSeconds: number;
};

function scriptHash(text: string, voice: string): string {
  return createHash("sha256").update(`${TTS_MODEL}|${voice}|${text}`).digest("hex").slice(0, 16);
}

/**
 * Gemini returns raw little-endian PCM (audio/L16, 24 kHz, mono). It is not a
 * playable file until it carries a RIFF header, so wrap it here rather than
 * making every consumer know that.
 */
function pcmToWav(pcm: Buffer, sampleRate = 24_000, channels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function parseSampleRate(mimeType: string | undefined): number {
  const match = /rate=(\d+)/.exec(mimeType ?? "");
  return match ? Number.parseInt(match[1], 10) : 24_000;
}

async function synthesise(text: string, voice: string, apiKey: string): Promise<Buffer> {
  const response = await fetch(`${TTS_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini TTS HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }

  const body = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }>;
  };
  const inline = body.candidates?.[0]?.content?.parts?.find((part) => part.inlineData)?.inlineData;
  if (!inline?.data) throw new Error("Gemini TTS returned no audio for this line.");

  return pcmToWav(Buffer.from(inline.data, "base64"), parseSampleRate(inline.mimeType));
}

/**
 * Produce (or reuse) one audio clip per narration line and return the timing
 * plan the capture must follow. Cached by script hash, so a re-run after a
 * failed capture costs nothing and does not re-pay for identical lines.
 */
export async function narrateLesson(lessonSlug: string, lines: string[]): Promise<NarratedStep[]> {
  const provider = narrationEnv.provider;
  const voice = narrationEnv.voice;
  const dir = resolve(ensureOutDir("audio"), lessonSlug);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const steps: NarratedStep[] = [];
  let cursor = 0;

  for (const [index, text] of lines.entries()) {
    let audioPath: string | undefined;
    let spoken = 0;

    if (provider === "gemini") {
      const apiKey = narrationEnv.geminiApiKey;
      if (!apiKey) throw new Error("GEMINI_API_KEY is required unless NARRATION_PROVIDER=none.");

      const file = resolve(dir, `${String(index).padStart(2, "0")}-${scriptHash(text, voice)}.wav`);
      if (!existsSync(file)) {
        writeFileSync(file, await synthesise(text, voice, apiKey));
      }
      audioPath = file;
      spoken = probeDurationSeconds(file);
    }

    const dwellSeconds = Math.max(MIN_STEP_SECONDS, spoken + TAIL_SECONDS);
    steps.push({
      index,
      text,
      audioPath,
      dwellSeconds,
      startSeconds: cursor,
      endSeconds: cursor + dwellSeconds,
    });
    cursor += dwellSeconds;
  }

  return steps;
}

function vttTimestamp(seconds: number): string {
  const whole = Math.floor(seconds);
  const ms = Math.round((seconds - whole) * 1000);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

/** WebVTT built from measured audio, so captions match the voice exactly. */
export function writeCaptions(lessonSlug: string, steps: NarratedStep[]): string {
  const cues = steps.map(
    (step, i) => `${i + 1}\n${vttTimestamp(step.startSeconds)} --> ${vttTimestamp(step.endSeconds)}\n${step.text}`
  );
  const path = resolve(ensureOutDir("captions"), `${lessonSlug}.vtt`);
  writeFileSync(path, `WEBVTT\n\n${cues.join("\n\n")}\n`);
  return path;
}

export function writeScript(lessonSlug: string, steps: NarratedStep[]): string {
  const path = resolve(ensureOutDir("scripts"), `${lessonSlug}.txt`);
  writeFileSync(path, `${steps.map((step) => step.text).join("\n\n")}\n`);
  return path;
}

export function readScript(lessonSlug: string): string | null {
  const path = resolve(ensureOutDir("scripts"), `${lessonSlug}.txt`);
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}
