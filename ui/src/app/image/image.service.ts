import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { helperUrl, toProxyUrl } from '../shared/helpers';
import { pollJob, type JobStatus, type PollOptions } from '../shared/poll';

export interface ImageJob extends JobStatus {
  image_url?: string;
}

export interface GeneratedImage {
  jobId: string;
  url: string;
}

@Service()
export class ImageService {
  private readonly http = inject(HttpClient);

  async generate(
    prompt: string,
    negativePrompt: string,
    pollOptions?: PollOptions,
  ): Promise<GeneratedImage> {
    const { job_id: jobId } = await firstValueFrom(
      this.http.post<{ job_id: string }>(helperUrl('image', '/api/v1/images:generate'), {
        prompt,
        negative_prompt: negativePrompt || undefined,
      }),
    );
    const job = await pollJob(
      () =>
        firstValueFrom(this.http.get<ImageJob>(helperUrl('image', `/api/v1/imageJobs/${jobId}`))),
      pollOptions,
    );
    return { jobId, url: toProxyUrl('image', job.image_url ?? `/output/image/${jobId}.png`) };
  }
}
