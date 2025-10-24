import type { EventEmitter } from "node:events";

import { PassThrough, type Readable } from "node:stream";

export const waitForEvent = (
  emitter: EventEmitter,
  name: string,
): Promise<void> =>
  new Promise((resolve) => {
    emitter.on(name, resolve);
  });

export const combineStreams = (streams: Readable[]): Readable => {
  let streamCount = streams.length;
  const combined = new PassThrough();
  const maybeEmitEnd = () => {
    if (--streamCount === 0) {
      combined.emit("end");
    }
  };
  for (const stream of streams) {
    stream.pipe(combined, { end: false });
    stream.on("end", maybeEmitEnd);
  }
  return combined;
};
