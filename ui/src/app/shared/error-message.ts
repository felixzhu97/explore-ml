import { HttpErrorResponse } from '@angular/common/http';

/** Readable message for a failed request; surfaces FastAPI `detail` as `"<status> <detail>"`. */
export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const detail: unknown = error.error?.detail ?? error.error;
    const description =
      typeof detail === 'string' && detail
        ? detail
        : detail
          ? JSON.stringify(detail)
          : error.statusText;
    return `${error.status} ${description}`;
  }
  return error instanceof Error ? error.message : String(error);
}
