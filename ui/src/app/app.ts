import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SERVICES } from './core/services';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="sticky top-0 z-10 bg-black text-fine text-white/80" aria-label="主导航">
      <div class="mx-auto flex h-11 max-w-page items-center gap-6 overflow-x-auto px-6">
        <a class="font-semibold text-white hover:text-white" routerLink="/">Explore ML</a>
        @for (s of services; track s.id) {
          <a
            class="whitespace-nowrap text-white/80 hover:text-white"
            [routerLink]="'/' + s.id"
            routerLinkActive="text-white!"
            ariaCurrentWhenActive="page"
            >{{ s.name }}</a
          >
        }
      </div>
    </nav>
    <main><router-outlet /></main>
  `,
})
export class App {
  protected readonly services = SERVICES;
}
