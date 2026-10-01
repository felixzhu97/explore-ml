import { type ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withHashLocation } from '@angular/router';
import { InboxOutline, UploadOutline } from '@ant-design/icons-angular/icons';
import { provideNzConfig } from 'ng-zorro-antd/core/config';
import { provideNzI18n, zh_CN } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withHashLocation(), withComponentInputBinding()),
    provideNzI18n(zh_CN),
    provideNzIcons([InboxOutline, UploadOutline]),
    // Apple tokens only: Action Blue for interactive and positive states, ink and muted ink otherwise.
    provideNzConfig({
      theme: {
        primaryColor: '#0066cc',
        infoColor: '#0066cc',
        processingColor: '#0066cc',
        successColor: '#0066cc',
        warningColor: '#7a7a7a',
        errorColor: '#1d1d1f',
      },
    }),
  ],
};
