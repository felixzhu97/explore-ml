import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Explore ML',
    loadComponent: () => import('./pages/overview/overview').then((m) => m.Overview),
  },
  { path: '**', redirectTo: '' },
];
