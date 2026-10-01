import { readSse } from './sse';

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      chunks.forEach((c) => controller.enqueue(encoder.encode(c)));
      controller.close();
    },
  });
}

describe('readSse', () => {
  it('should emit each data payload until the DONE sentinel', async () => {
    const out: string[] = [];
    await readSse(
      streamOf('data: Hel', 'lo\n\ndata:  world\n\n', 'data: [DONE]\n\ndata: late\n\n'),
      (d) => out.push(d),
    );
    expect(out).toEqual(['Hello', ' world']);
  });

  it('should join multi-line data and accept CRLF separators', async () => {
    const out: string[] = [];
    await readSse(streamOf('data: a\r\ndata: b\r\n\r\n'), (d) => out.push(d));
    expect(out).toEqual(['a\nb']);
  });

  it('should ignore comments and events without data', async () => {
    const out: string[] = [];
    await readSse(streamOf(': keep-alive\n\nevent: ping\n\ndata: x\n\n'), (d) => out.push(d));
    expect(out).toEqual(['x']);
  });
});
