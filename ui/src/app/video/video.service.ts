import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { mlUrl, toProxyUrl } from '../shared/helpers';
import { pollJob, type JobStatus, type PollOptions } from '../shared/poll';

export interface VideoJob extends JobStatus {
  video_url?: string;
}

export interface GeneratedVideo {
  jobId: string;
  url: string;
}

@Service()
export class VideoService {
  private readonly http = inject(HttpClient);

  async generate(prompt: string, pollOptions?: PollOptions): Promise<GeneratedVideo> {
    const { job_id: jobId } = await firstValueFrom(
      this.http.post<{ job_id: string }>(mlUrl('/api/v1/videos:generate'), {
        prompt,
      }),
    );
    const job = await pollJob(
      () => firstValueFrom(this.http.get<VideoJob>(mlUrl(`/api/v1/videoJobs/${jobId}`))),
      pollOptions,
    );
    return { jobId, url: toProxyUrl(job.video_url!) };
  }
}
