export type AvatarRenderRequest = {
  lessonSlug: string;
  audioPath: string;
  scriptPath: string;
  outputPath: string;
};

export type AvatarRenderResult = {
  provider: string;
  outputPath: string;
  jobId?: string;
};

export interface AvatarProvider {
  render(request: AvatarRenderRequest): Promise<AvatarRenderResult>;
}
