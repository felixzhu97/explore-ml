import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface NavItem {
  path: string;
  label: string;
  exact: boolean;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './app.css',
  template: `
    <nav class="global-nav" aria-label="主导航">
      <a class="brand" routerLink="/">Explore ML</a>
      <ul>
        @for (item of nav; track item.path) {
          <li>
            <a
              [routerLink]="item.path"
              routerLinkActive="active"
              ariaCurrentWhenActive="page"
              [routerLinkActiveOptions]="{ exact: item.exact }"
              >{{ item.label }}</a
            >
          </li>
        }
      </ul>
    </nav>
    <main><router-outlet /></main>
  `,
})
export class App {
  protected readonly nav: NavItem[] = [{ path: '/', label: '总览', exact: true }];
}
