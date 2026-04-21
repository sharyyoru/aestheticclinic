import {
  GoogleGenerativeAI,
  GenerationConfig,
  Part,
  Content,
  GenerateContentResult,
} from "@google/generative-ai";

/**
 * Gemini models in order of preference. Each has its own quota so if one is
 * rate-limited we can fall back to the next. Gemini 1.5 models were
 * deprecated in September 2025 and return 404, so we only use 2.x models.
 */
const MODEL_FALLBACK_CHAIN = [
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash-lite",
];

/** Errors that indicate the model itself doesn't exist / isn't usable. */
function isModelNotFoundError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes("404") ||
    message.toLowerCase().includes("not found") ||
    message.toLowerCase().includes("is not supported")
  );
}

export type GenerateArgs = {
  apiKey: string;
  systemInstruction?: string;
  generationConfig?: GenerationConfig;
  contents: Content[];
  /** If true, log every attempt */
  verbose?: boolean;
};

function isRateLimitError(err: unknown): boolean {
  if (!err) return false;
  const message =
    err instanceof Error ? err.message : String(err);
  return (
    message.includes("429") ||
    message.toLowerCase().includes("too many requests") ||
    message.toLowerCase().includes("resource exhausted") ||
    message.toLowerCase().includes("quota")
  );
}

function isRetryableError(err: unknown): boolean {
  if (isRateLimitError(err)) return true;
  const message = err instanceof Error ? err.message : String(err);
  // 5xx and network errors are retryable
  return /\b(500|502|503|504)\b/.test(message) || message.toLowerCase().includes("fetch failed");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call Gemini's generateContent with:
 *  - Automatic retry with exponential backoff on transient errors
 *  - Automatic fallback to alternative Gemini models on 429 (quota)
 */
export async function generateContentWithFallback(
  args: GenerateArgs,
): Promise<GenerateContentResult> {
  const { apiKey, systemInstruction, generationConfig, contents, verbose } = args;
  const genAI = new GoogleGenerativeAI(apiKey);

  let lastError: unknown = null;

  for (const modelName of MODEL_FALLBACK_CHAIN) {
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction,
      generationConfig,
    });

    // Try each model up to 3 times with exponential backoff on transient errors
    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (verbose) {
          console.log(`[gemini] Trying model=${modelName} attempt=${attempt}`);
        }
        const result = await model.generateContent({ contents });
        return result;
      } catch (err) {
        lastError = err;
        const rateLimited = isRateLimitError(err);
        const retryable = isRetryableError(err);

        if (verbose) {
          console.warn(
            `[gemini] model=${modelName} attempt=${attempt} failed (rateLimited=${rateLimited}, retryable=${retryable}):`,
            err instanceof Error ? err.message : err,
          );
        }

        if (rateLimited) {
          // 429: skip remaining retries for this model and move to next fallback
          break;
        }

        if (isModelNotFoundError(err)) {
          // Model doesn't exist (deprecated / not enabled): skip to next fallback
          if (verbose) {
            console.warn(`[gemini] model=${modelName} unavailable, moving to next fallback`);
          }
          break;
        }

        if (!retryable || attempt === maxAttempts) {
          // Non-retryable or exhausted retries: throw
          throw err;
        }

        // Exponential backoff: 500ms, 1500ms, 4500ms
        const backoff = 500 * Math.pow(3, attempt - 1);
        await delay(backoff);
      }
    }
  }

  // All models exhausted
  throw lastError ?? new Error("All Gemini model fallbacks failed");
}

/** Re-export convenience so callers don't need to import from SDK */
export type { Part, Content };
