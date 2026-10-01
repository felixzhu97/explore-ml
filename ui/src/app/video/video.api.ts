import { getJson, postJson } from '../shared/http';
import { pollJob, type JobStatus, type PollOptions } from '../shared/poll';
import { svcUrl, toProxyUrl } from '../shared/services';

interface VideoJob extends JobStatus {
  video_url?: string;
}

export async function generateVideo(prompt: string, opts?: PollOptions) {
  const { job_id } = await postJson<{ job_id: string }>(
    svcUrl('video', '/api/v1/videos:generate'),
    { prompt },
  );
  const job = await pollJob(
    () => getJson<VideoJob>(svcUrl('video', `/api/v1/videoJobs/${job_id}`)),
    opts,
  );
  return {
    jobId: job_id,
    url: toProxyUrl('video', job.video_url ?? `/output/video/${job_id}.mp4`),
  };
}
