import { postForm, postJson } from '../shared/http';
import { svcUrl, toProxyUrl } from '../shared/services';

export async function synthesize(text: string, voice?: string) {
  const { audio_url } = await postJson<{ audio_url: string }>(
    svcUrl('speech', '/api/v1/voices:synthesize'),
    {
      text,
      voice: voice || undefined,
    },
  );
  return toProxyUrl('speech', audio_url);
}

export function transcribe(file: Blob, filename: string, language?: string) {
  const form = new FormData();
  form.append('file', file, filename);
  if (language) form.append('language', language);
  return postForm<{ text: string; language?: string }>(
    svcUrl('speech', '/api/v1/audios:transcribe'),
    form,
  );
}
