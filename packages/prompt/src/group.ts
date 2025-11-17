import { PromptCancelledError } from "./cancel";

type MaybePromise<T> = T | Promise<T>;

export interface GroupPromptContext<
  TResult extends Record<string, unknown>,
  TKey extends keyof TResult,
> {
  key: TKey;
  results: Readonly<Partial<TResult>>;
}

export interface GroupPromptHandler<
  TResult extends Record<string, unknown>,
  TKey extends keyof TResult,
> {
  (context: GroupPromptContext<TResult, TKey>): MaybePromise<TResult[TKey]>;
}

export type GroupPromptHandlers<TResult extends Record<string, unknown>> = {
  [K in keyof TResult]: GroupPromptHandler<TResult, K>;
};

export interface GroupPromptOptions {
  onCancel?: (error: PromptCancelledError) => MaybePromise<void>;
}

export async function groupPrompt<TResult extends Record<string, unknown>>(
  handlers: GroupPromptHandlers<TResult>,
  options?: GroupPromptOptions,
): Promise<TResult> {
  const results: Partial<TResult> = {};
  const keys = Object.keys(handlers) as (keyof TResult)[];

  for (const key of keys) {
    const handler = handlers[key] as GroupPromptHandler<TResult, typeof key>;

    try {
      const value = await handler({
        key,
        results: results as Readonly<Partial<TResult>>,
      });
      results[key] = value;
    } catch (error) {
      if (error instanceof PromptCancelledError && options?.onCancel) {
        await options.onCancel(error);
      }
      throw error;
    }
  }

  return results as TResult;
}

export const group = groupPrompt;
