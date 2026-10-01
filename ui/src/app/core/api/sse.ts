/**
 * Reads a `text/event-stream` body and calls `onData` for every `data:` payload
 * until the stream ends or a `[DONE]` sentinel arrives.
 */
export async function readSse(
  body: ReadableStream<Uint8Array>,
  onData: (data: string) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.search(/\r?\n\r?\n/)) !== -1) {
        const event = buffer.slice(0, sep);
        buffer = buffer.slice(sep).replace(/^\r?\n\r?\n/, '');
        const data = event
          .split(/\r?\n/)
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).replace(/^ /, ''))
          .join('\n');
        if (data === '[DONE]') return;
        if (data) onData(data);
      }
    }
  } finally {
    reader.releaseLock();
  }
}
