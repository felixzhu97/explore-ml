export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body?.detail === 'string' ? body.detail : JSON.stringify(body);
    } catch {
      /* keep statusText */
    }
    throw new HttpError(res.status, `${res.status} ${detail}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : { status: res.status }) as T;
}

export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  return parse<T>(await fetch(url, init));
}

export async function postJson<T>(url: string, body: unknown, init?: RequestInit): Promise<T> {
  return parse<T>(
    await fetch(url, {
      ...init,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

export async function postForm<T>(url: string, form: FormData): Promise<T> {
  return parse<T>(await fetch(url, { method: 'POST', body: form }));
}

export async function deleteJson<T>(url: string): Promise<T> {
  return parse<T>(await fetch(url, { method: 'DELETE' }));
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
