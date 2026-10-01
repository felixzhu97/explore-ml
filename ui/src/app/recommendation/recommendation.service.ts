import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { mlUrl } from '../shared/helpers';

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

export interface RankedItemsResponse {
  items: RankedItem[];
}

@Service()
export class RecommendationService {
  private readonly http = inject(HttpClient);

  rank(surface: RankSurface, request: RankRequest): Promise<RankedItemsResponse> {
    return firstValueFrom(
      this.http.post<RankedItemsResponse>(mlUrl(`/api/v1/${surface}:rank`), request),
    );
  }

  recall(userId: string, limit = 20): Promise<RankedItemsResponse> {
    return firstValueFrom(
      this.http.post<RankedItemsResponse>(mlUrl('/api/v1/feeds:recall'), {
        user_id: userId,
        limit,
      }),
    );
  }
}
