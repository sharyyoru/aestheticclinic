import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { OUT_DIR } from "../../lib/manifest";
import type { AvatarProvider, AvatarRenderRequest, AvatarRenderResult } from "./types";

export class ManualArtlistAvatarProvider implements AvatarProvider {
  async render(request: AvatarRenderRequest): Promise<AvatarRenderResult> {
    const source = resolve(OUT_DIR, "presenter-inbox", `${request.lessonSlug}.webm`);
    if (!existsSync(source)) {
      throw new Error(`Missing Artlist presenter render for ${request.lessonSlug}: ${source}`);
    }
    copyFileSync(source, request.outputPath);
    return { provider: "artlist-manual", outputPath: request.outputPath };
  }
}
