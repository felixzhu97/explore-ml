import { postJson } from '../shared/http';
import { svcUrl } from '../shared/services';
import type { RankRequest, RankSurface, RankedItem } from './rec.model';

export function rank(surface: RankSurface, body: RankRequest) {
  return postJson<{ items: RankedItem[] }>(svcUrl('rec', `/api/v1/${surface}:rank`), body);
}

export function recall(user_id: string, limit = 20) {
  return postJson<{ items: RankedItem[] }>(svcUrl('rec', '/api/v1/feeds:recall'), {
    user_id,
    limit,
  });
}
