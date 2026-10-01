import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Explore ML',
    loadComponent: () => import('./pages/overview/overview').then((m) => m.Overview),
  },
  { path: 'playground', redirectTo: 'playground/rec' },
  {
    path: 'playground/:helper',
    title: '调试台 · Explore ML',
    loadComponent: () => import('./pages/playground/playground').then((m) => m.Playground),
  },
  { path: '**', redirectTo: '' },
];
