export type VisionInput = { file: File } | { url: string };

export interface ModerationResult {
  safe: boolean;
  categories: { label: string; score: number }[];
}
