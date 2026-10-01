export type RankSurface = 'feeds' | 'explores' | 'reels';

export interface RankRequest {
  user_id: string;
  candidate_ids: string[];
  limit?: number;
  region?: string;
  language?: string;
  experiment_id?: string;
  variant_id?: string;
}

export interface RankedItem {
  id: string;
  score: number;
}
