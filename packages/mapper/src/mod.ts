type BaseOptions = {
  /**
   * Number of concurrently pending promises returned by `mapper`.
   *
   * Must be an integer from 1 and up or `Infinity`.
   *
   * @default Infinity
   */
  readonly concurrency?: number;
};

export type Options = BaseOptions & {
  /**
   * When `true`, the first mapper rejection will be rejected back to the consumer.
   *
   * When `false`, instead of stopping when a promise rejects, it will wait for all
   * the promises to settle and then reject with an `AggregateError` containing all
   * the errors from the rejected promises.
   *
   * Caveat: When `true`, any already-started async mappers will continue to run
   * until they resolve or reject. In the case of infinite concurrency with sync
   * iterables, all mappers are invoked on startup and will continue after the first
   * rejection. AbortControl can be used to stop pulling new items.
   *
   * @default true
   */
  readonly stopOnError?: boolean;

  /**
   * You can abort the promises using `AbortController`.
   *
   * Rejects with the `signal.reason` immediately, stops pulling new items, and
   * attempts to close the underlying iterator via `.return()` if available.
   */
  readonly signal?: AbortSignal;
};

export type IterableOptions = BaseOptions & {
  /**
   * Maximum number of promises returned by `mapper` that have resolved but not yet
   * collected by the consumer of the async iterable. Calls to `mapper` will be
   * limited so that there is never too much backpressure.
   *
   * Useful whenever you are consuming the iterable slower than what the mapper
   * function can produce concurrently.
   *
   * Default: `options.concurrency`
   */
  readonly backpressure?: number;
};

type MaybePromise<T> = T | Promise<T>;

/**
 * Function which is called for every item in `input`. Expected to return a
 * `Promise` or value.
 *
 * @param element - Iterated element.
 * @param index - Index of the element in the source array.
 */
export type Mapper<Element = unknown, NewElement = unknown> = (
  element: Element,
  index: number,
) => MaybePromise<NewElement | typeof pMapSkip>;

/**
 * Return this value from a `mapper` function to skip including the value in the
 * returned array.
 */
export const pMapSkip = Symbol("skip");

/**
 * @param input - Synchronous or asynchronous iterable that is iterated over
 * concurrently, calling the `mapper` function for each element. Each iterated
 * item is `await`'d before the `mapper` is invoked so the iterable may return a
 * `Promise` that resolves to an item.
 * @param mapper - Function which is called for every item in `input`. Expected
 * to return a `Promise` or value.
 * @returns A `Promise` that is fulfilled when all promises in `input` and ones
 * returned from `mapper` are fulfilled, or rejects if any of the promises
 * reject. The fulfilled value is an `Array` of the fulfilled values returned
 * from `mapper` in `input` order, excluding `pMapSkip`.
 */
export default async function pMap<Element, NewElement>(
  input:
    | AsyncIterable<Element | Promise<Element>>
    | Iterable<Element | Promise<Element>>,
  mapper: Mapper<Element, NewElement>,
  options: Options = {},
): Promise<Array<Exclude<NewElement, typeof pMapSkip>>> {
  const {
    concurrency = Number.POSITIVE_INFINITY,
    stopOnError = true,
    signal,
  } = options;

  if (
    !("Symbol" in globalThis) ||
    ((input as any)[Symbol.iterator] === undefined &&
      (input as any)[Symbol.asyncIterator] === undefined)
  ) {
    throw new TypeError(
      `Expected \`input\` to be either an \`Iterable\` or \`AsyncIterable\`, ` +
        `got (${typeof input})`,
    );
  }

  if (typeof mapper !== "function") {
    throw new TypeError("Mapper function is required");
  }

  if (
    !(
      (Number.isSafeInteger(concurrency) && concurrency >= 1) ||
      concurrency === Number.POSITIVE_INFINITY
    )
  ) {
    throw new TypeError(
      `Expected \`concurrency\` to be an integer from 1 and up or ` +
        `\`Infinity\`, got \`${concurrency}\` (${typeof concurrency})`,
    );
  }

  return new Promise((resolve, reject) => {
    const iterator =
      (input as any)[Symbol.asyncIterator] !== undefined
        ? (input as any)[Symbol.asyncIterator]()
        : (input as any)[Symbol.iterator]();

    const results: Array<NewElement | typeof pMapSkip> = [];
    const errors: Error[] = [];

    let activeCount = 0;
    let currentIndex = 0;
    let isIterableDone = false;
    let isSettled = false;
    let isPumping = false;
    let iteratorClosed = false;

    const safeCloseIterator = async () => {
      if (iteratorClosed) return;
      const ret = (iterator as any)?.return;
      if (typeof ret === "function") {
        try {
          iteratorClosed = true;
          await ret.call(iterator);
        } catch {
          // Swallow errors closing the iterator
        }
      } else {
        iteratorClosed = true;
      }
    };

    const onAbort = () => {
      if (isSettled) return;
      isSettled = true;
      void safeCloseIterator();
      cleanup();
      reject(signal!.reason);
    };

    signal?.addEventListener("abort", onAbort, { once: true });

    function cleanup() {
      signal?.removeEventListener("abort", onAbort);
    }

    function settleWithAggregateIfNeeded() {
      if (errors.length > 0 && !stopOnError) {
        cleanup();
        reject(new AggregateError(errors, "One or more promises rejected"));
        return true;
      }

      return false;
    }

    function resolveResults() {
      cleanup();
      // Build filtered array in one pass, preserving order
      const out: Array<Exclude<NewElement, typeof pMapSkip>> = [];
      for (let i = 0; i < results.length; i++) {
        const v = results[i];
        if (v !== undefined && v !== pMapSkip) {
          out.push(v as Exclude<NewElement, typeof pMapSkip>);
        }
      }
      resolve(out);
    }

    function checkCompletion() {
      if (isSettled) return;
      if (!isIterableDone) return;
      if (activeCount > 0) return;

      isSettled = true;

      if (settleWithAggregateIfNeeded()) {
        return;
      }

      resolveResults();
    }

    async function startMapper(
      valueOrPromise: Element | Promise<Element>,
      index: number,
    ) {
      try {
        const item = await valueOrPromise;
        const result = await mapper(item, index);
        if (!isSettled) {
          results[index] = result;
        }
      } catch (error) {
        if (isSettled) return;

        if (stopOnError) {
          isSettled = true;
          void safeCloseIterator();
          cleanup();
          reject(error);
          return;
        }

        errors.push(error as Error);
      } finally {
        if (!isSettled) {
          activeCount--;
          checkCompletion();
          void pump();
        }
      }
    }

    async function pump() {
      if (isSettled || isPumping) return;
      isPumping = true;

      try {
        // Pull new items sequentially; never call iterator.next() concurrently.
        while (!isSettled && !isIterableDone && activeCount < concurrency) {
          let next:
            | IteratorResult<Element | Promise<Element>>
            | Promise<IteratorResult<Element | Promise<Element>>>;

          try {
            next = iterator.next();
            // Ensure we await next in case it's a promise
            next = await next;
          } catch (error) {
            if (!isSettled) {
              isSettled = true;
              void safeCloseIterator();
              cleanup();
              reject(error);
            }
            return;
          }

          if (next.done) {
            isIterableDone = true;
            break;
          }

          const index = currentIndex++;
          activeCount++;
          void startMapper(next.value, index);
        }

        checkCompletion();
      } finally {
        isPumping = false;
      }
    }

    void pump();
  });
}

/**
 * @param input - Synchronous or asynchronous iterable that is iterated over
 * concurrently, calling the `mapper` function for each element. Each iterated
 * item is `await`'d before the `mapper` is invoked so the iterable may return a
 * `Promise` that resolves to an item.
 * @param mapper - Function which is called for every item in `input`. Expected
 * to return a `Promise` or value.
 * @returns An async iterable that streams each return value from `mapper` in
 * order, excluding `pMapSkip`.
 */
export function pMapIterable<Element, NewElement>(
  input:
    | AsyncIterable<Element | Promise<Element>>
    | Iterable<Element | Promise<Element>>,
  mapper: Mapper<Element, NewElement>,
  options: IterableOptions = {},
): AsyncIterable<Exclude<NewElement, typeof pMapSkip>> {
  const { concurrency = Number.POSITIVE_INFINITY, backpressure = concurrency } =
    options;

  if (
    !("Symbol" in globalThis) ||
    ((input as any)[Symbol.iterator] === undefined &&
      (input as any)[Symbol.asyncIterator] === undefined)
  ) {
    throw new TypeError(
      `Expected \`input\` to be either an \`Iterable\` or \`AsyncIterable\`, ` +
        `got (${typeof input})`,
    );
  }

  if (typeof mapper !== "function") {
    throw new TypeError("Mapper function is required");
  }

  if (
    !(
      (Number.isSafeInteger(concurrency) && concurrency >= 1) ||
      concurrency === Number.POSITIVE_INFINITY
    )
  ) {
    throw new TypeError(
      `Expected \`concurrency\` to be an integer from 1 and up or ` +
        `\`Infinity\`, got \`${concurrency}\` (${typeof concurrency})`,
    );
  }

  if (
    !(
      (Number.isSafeInteger(backpressure) && backpressure >= concurrency) ||
      backpressure === Number.POSITIVE_INFINITY
    )
  ) {
    throw new TypeError(
      `Expected \`backpressure\` to be an integer from ` +
        `\`concurrency\` (${concurrency}) and up or \`Infinity\`, got ` +
        `\`${backpressure}\` (${typeof backpressure})`,
    );
  }

  return {
    async *[Symbol.asyncIterator]() {
      const iterator =
        (input as any)[Symbol.asyncIterator] !== undefined
          ? (input as any)[Symbol.asyncIterator]()
          : (input as any)[Symbol.iterator]();

      type ResultItem = {
        value?: NewElement | typeof pMapSkip;
        error?: Error;
        done: boolean;
      };

      const resultQueue: Array<Promise<ResultItem>> = [];
      let runningCount = 0;
      let currentIndex = 0;
      let isDone = false;
      let pulling = false;
      let iteratorClosed = false;

      const safeCloseIterator = async () => {
        if (iteratorClosed) return;
        const ret = (iterator as any)?.return;
        if (typeof ret === "function") {
          try {
            iteratorClosed = true;
            await ret.call(iterator);
          } catch {
            // Ignore errors closing the iterator
          }
        } else {
          iteratorClosed = true;
        }
      };

      const schedulePull = () => {
        if (pulling || isDone) return;
        pulling = true;

        (async () => {
          try {
            while (
              !isDone &&
              runningCount < concurrency &&
              resultQueue.length < backpressure
            ) {
              let next:
                | IteratorResult<Element | Promise<Element>>
                | Promise<IteratorResult<Element | Promise<Element>>>;

              try {
                next = iterator.next();
                next = await next;
              } catch (error) {
                isDone = true;
                resultQueue.push(
                  Promise.resolve({
                    error: error as Error,
                    done: false,
                  }),
                );
                break;
              }

              if (next.done) {
                isDone = true;
                // Push a terminal marker so the consumer can finish cleanly
                resultQueue.push(Promise.resolve({ done: true }));
                break;
              }

              const index = currentIndex++;
              runningCount++;

              const promise = (async (): Promise<ResultItem> => {
                try {
                  const element = await next.value;
                  const result = await mapper(element, index);
                  return { value: result, done: false };
                } catch (error) {
                  return { error: error as Error, done: false };
                } finally {
                  runningCount--;
                  schedulePull();
                }
              })();

              resultQueue.push(promise);
            }
          } finally {
            pulling = false;
          }
        })();
      };

      schedulePull();

      while (resultQueue.length > 0) {
        const result = await resultQueue.shift()!;

        if (result.error) {
          await safeCloseIterator();
          throw result.error;
        }

        if (result.done) {
          await safeCloseIterator();
          return;
        }

        schedulePull();

        if (result.value !== pMapSkip) {
          yield result.value as Exclude<NewElement, typeof pMapSkip>;
        }
      }

      // If we exhausted the queue without seeing a done marker, ensure cleanup.
      await safeCloseIterator();
    },
  };
}
