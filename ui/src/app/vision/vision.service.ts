import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { mlUrl } from '../shared/helpers';

export type VisionInput = { file: File } | { url: string };

export interface PredictionResult {
  labels: string[];
}

export interface ModerationResult {
  safe: boolean;
  categories: { label: string; score: number }[];
}

@Service()
export class VisionService {
  private readonly http = inject(HttpClient);

  predictImage(input: VisionInput): Promise<PredictionResult> {
    return this.post('/api/v1/images:predict', input, 'image_url');
  }

  moderateImage(input: VisionInput): Promise<ModerationResult> {
    return this.post('/api/v1/images:moderate', input, 'image_url');
  }

  moderateVideo(input: VisionInput): Promise<ModerationResult> {
    return this.post('/api/v1/videos:moderate', input, 'video_url');
  }

  /** Uploads the file as multipart form data, or sends the URL under `urlField` as JSON. */
  private post<T>(path: string, input: VisionInput, urlField: string): Promise<T> {
    const url = mlUrl(path);
    if ('file' in input) {
      const formData = new FormData();
      formData.append('file', input.file);
      return firstValueFrom(this.http.post<T>(url, formData));
    }
    return firstValueFrom(this.http.post<T>(url, { [urlField]: input.url }));
  }
}
