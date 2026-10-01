import { readSse } from './sse';

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });
}

describe('readSse', () => {
  it('should emit each data payload until the DONE sentinel', async () => {
    const payloads: string[] = [];
    await readSse(
      streamOf('data: Hel', 'lo\n\ndata:  world\n\n', 'data: [DONE]\n\ndata: late\n\n'),
      (data) => payloads.push(data),
    );
    expect(payloads).toEqual(['Hello', ' world']);
  });

  it('should join multi-line data and accept CRLF separators', async () => {
    const payloads: string[] = [];
    await readSse(streamOf('data: a\r\ndata: b\r\n\r\n'), (data) => payloads.push(data));
    expect(payloads).toEqual(['a\nb']);
  });

  it('should ignore comments and events without data', async () => {
    const payloads: string[] = [];
    await readSse(streamOf(': keep-alive\n\nevent: ping\n\ndata: x\n\n'), (data) =>
      payloads.push(data),
    );
    expect(payloads).toEqual(['x']);
  });
});
