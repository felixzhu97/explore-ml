import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { SERVICES, getService } from '../../core/services';
import { ImagePlayground } from './image-playground';
import { RagPlayground } from './rag-playground';
import { RecPlayground } from './rec-playground';
import { SpeechPlayground } from './speech-playground';
import { VideoPlayground } from './video-playground';
import { VisionPlayground } from './vision-playground';

@Component({
  selector: 'app-playground',
  imports: [
    RouterLink,
    RouterLinkActive,
    RecPlayground,
    VisionPlayground,
    RagPlayground,
    ImagePlayground,
    SpeechPlayground,
    VideoPlayground,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="section">
      <div class="container">
        <h1>调试台</h1>
        <nav class="tabs" aria-label="服务">
          @for (s of services; track s.id) {
            <a
              class="tab"
              [routerLink]="['/playground', s.id]"
              routerLinkActive="active"
              ariaCurrentWhenActive="page"
              >{{ s.name }}</a
            >
          }
        </nav>
      </div>
    </section>
    <section class="section parchment">
      <div class="container">
        @switch (service()?.id) {
          @case ('rec') {
            <app-rec-playground />
          }
          @case ('vision') {
            <app-vision-playground />
          }
          @case ('rag') {
            <app-rag-playground />
          }
          @case ('image') {
            <app-image-playground />
          }
          @case ('speech') {
            <app-speech-playground />
          }
          @case ('video') {
            <app-video-playground />
          }
          @default {
            <p>未知服务。</p>
          }
        }
      </div>
    </section>
  `,
  styles: `
    .tabs {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-xs);
    }
    .tab {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      padding: 8px 18px;
      border-radius: var(--radius-pill);
      color: var(--color-ink-muted-80);
      background: var(--color-parchment);
    }
    .tab:hover {
      text-decoration: none;
    }
    .tab.active {
      background: var(--color-ink);
      color: var(--color-on-dark);
    }
  `,
})
export class Playground {
  readonly helper = input('rec');
  protected readonly services = SERVICES;
  protected readonly service = computed(() => getService(this.helper()));
}
