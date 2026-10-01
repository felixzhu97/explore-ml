import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Explore ML',
    loadComponent: () => import('./pages/home').then((m) => m.Home),
  },
  {
    path: 'rec',
    title: '推荐 · Explore ML',
    loadComponent: () => import('./pages/rec').then((m) => m.RecPage),
  },
  {
    path: 'vision',
    title: '视觉 · Explore ML',
    loadComponent: () => import('./pages/vision').then((m) => m.VisionPage),
  },
  {
    path: 'rag',
    title: 'RAG · Explore ML',
    loadComponent: () => import('./pages/rag').then((m) => m.RagPage),
  },
  {
    path: 'image',
    title: '图像生成 · Explore ML',
    loadComponent: () => import('./pages/image').then((m) => m.ImagePage),
  },
  {
    path: 'speech',
    title: '语音 · Explore ML',
    loadComponent: () => import('./pages/speech').then((m) => m.SpeechPage),
  },
  {
    path: 'video',
    title: '视频生成 · Explore ML',
    loadComponent: () => import('./pages/video').then((m) => m.VideoPage),
  },
  { path: '**', redirectTo: '' },
];
