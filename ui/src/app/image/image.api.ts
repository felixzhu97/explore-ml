import { getJson, postJson } from '../shared/http';
import { pollJob, type JobStatus, type PollOptions } from '../shared/poll';
import { svcUrl, toProxyUrl } from '../shared/services';

interface ImageJob extends JobStatus {
  image_url?: string;
}

export async function generateImage(prompt: string, negative_prompt: string, opts?: PollOptions) {
  const { job_id } = await postJson<{ job_id: string }>(
    svcUrl('image', '/api/v1/images:generate'),
    {
      prompt,
      negative_prompt: negative_prompt || undefined,
    },
  );
  const job = await pollJob(
    () => getJson<ImageJob>(svcUrl('image', `/api/v1/imageJobs/${job_id}`)),
    opts,
  );
  return {
    jobId: job_id,
    url: toProxyUrl('image', job.image_url ?? `/output/image/${job_id}.png`),
  };
}
