import { postForm, postJson } from '../shared/http';
import { svcUrl } from '../shared/services';
import type { ModerationResult, VisionInput } from './vision.model';

function visionPost<T>(path: string, input: VisionInput, urlKey = 'image_url'): Promise<T> {
  if ('file' in input) {
    const form = new FormData();
    form.append('file', input.file);
    return postForm<T>(svcUrl('vision', path), form);
  }
  return postJson<T>(svcUrl('vision', path), { [urlKey]: input.url });
}

export function predictImage(input: VisionInput) {
  return visionPost<{ labels: string[] }>('/api/v1/images:predict', input);
}

export function moderateImage(input: VisionInput) {
  return visionPost<ModerationResult>('/api/v1/images:moderate', input);
}

export function moderateVideo(input: VisionInput) {
  return visionPost<ModerationResult>('/api/v1/videos:moderate', input, 'video_url');
}
