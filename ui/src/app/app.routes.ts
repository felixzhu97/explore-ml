import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Explore ML',
    loadComponent: () => import('./home/home.page').then((module) => module.Home),
  },
  {
    path: 'recommendation',
    title: '推荐 · Explore ML',
    loadComponent: () =>
      import('./recommendation/recommendation.page').then((module) => module.RecommendationPage),
  },
  {
    path: 'vision',
    title: '视觉 · Explore ML',
    loadComponent: () => import('./vision/vision.page').then((module) => module.VisionPage),
  },
  {
    path: 'rag',
    title: 'RAG · Explore ML',
    loadComponent: () => import('./rag/rag.page').then((module) => module.RagPage),
  },
  {
    path: 'image',
    title: '图像生成 · Explore ML',
    loadComponent: () => import('./image/image.page').then((module) => module.ImagePage),
  },
  {
    path: 'speech',
    title: '语音 · Explore ML',
    loadComponent: () => import('./speech/speech.page').then((module) => module.SpeechPage),
  },
  {
    path: 'video',
    title: '视频生成 · Explore ML',
    loadComponent: () => import('./video/video.page').then((module) => module.VideoPage),
  },
  { path: '**', redirectTo: '' },
];
