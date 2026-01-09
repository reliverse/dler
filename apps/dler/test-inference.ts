import { type as arktype } from "arktype";

// Test direct arktype inference
const schema = arktype("string | undefined");
type DirectInfer = typeof schema.infer;

// Test through interface
interface TestOption<T> {
  type: T;
}

const option: TestOption<typeof schema> = { type: schema };
type OptionInfer = typeof option.type.infer;

export type { DirectInfer, OptionInfer };
