import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { helperUrl, toProxyUrl } from '../shared/helpers';

export interface Transcription {
  text: string;
  language?: string;
}

@Service()
export class SpeechService {
  private readonly http = inject(HttpClient);

  /** Resolves to the synthesized audio URL, rewritten onto the dev-server proxy. */
  async synthesize(text: string, voice?: string): Promise<string> {
    const { audio_url: audioUrl } = await firstValueFrom(
      this.http.post<{ audio_url: string }>(helperUrl('speech', '/api/v1/voices:synthesize'), {
        text,
        voice: voice || undefined,
      }),
    );
    return toProxyUrl('speech', audioUrl);
  }

  transcribe(audio: Blob, filename: string, language?: string): Promise<Transcription> {
    const formData = new FormData();
    formData.append('file', audio, filename);
    if (language) formData.append('language', language);
    return firstValueFrom(
      this.http.post<Transcription>(helperUrl('speech', '/api/v1/audios:transcribe'), formData),
    );
  }
}
