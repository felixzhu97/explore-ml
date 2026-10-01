import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Explore ML',
    loadComponent: () => import('./home/home.page').then((m) => m.Home),
  },
  {
    path: 'rec',
    title: '推荐 · Explore ML',
    loadComponent: () => import('./rec/rec.page').then((m) => m.RecPage),
  },
  {
    path: 'vision',
    title: '视觉 · Explore ML',
    loadComponent: () => import('./vision/vision.page').then((m) => m.VisionPage),
  },
  {
    path: 'rag',
    title: 'RAG · Explore ML',
    loadComponent: () => import('./rag/rag.page').then((m) => m.RagPage),
  },
  {
    path: 'image',
    title: '图像生成 · Explore ML',
    loadComponent: () => import('./image/image.page').then((m) => m.ImagePage),
  },
  {
    path: 'speech',
    title: '语音 · Explore ML',
    loadComponent: () => import('./speech/speech.page').then((m) => m.SpeechPage),
  },
  {
    path: 'video',
    title: '视频生成 · Explore ML',
    loadComponent: () => import('./video/video.page').then((m) => m.VideoPage),
  },
  { path: '**', redirectTo: '' },
];
