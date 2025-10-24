import type {
  DEST_FILE_EXISTS_BEHAVIOURS,
  FILE_TYPES,
  INIT_BEHAVIOURS,
} from "./init-const";

export type FileType = (typeof FILE_TYPES)[number]["type"];
export type InitBehaviour = (typeof INIT_BEHAVIOURS)[number];
export type DestFileExistsBehaviour =
  (typeof DEST_FILE_EXISTS_BEHAVIOURS)[number];

/** Library-level interface for hooking into the file init process. */
export interface ReinitUserConfig {
  /** The default approach for copying vs. creating. */
  defaultInitBehaviour?: InitBehaviour;
  /** Default approach if a file already exists. */
  defaultDestFileExistsBehaviour?: DestFileExistsBehaviour;
  /** Whether `initFiles` should run in parallel by default. */
  parallelByDefault?: boolean;
  /** Concurrency limit for parallel tasks. If omitted, 4 is used. */
  parallelConcurrency?: number;
  /** Called before each file operation. */
  onFileStart?: (req: InitFileRequest) => void;
  /** Called after each file operation. */
  onFileComplete?: (res: InitFileResult) => void;
}

/** Data describing a single request to initFile. */
export interface InitFileRequest {
  fileType: FileType;
  destDir: string;
  initBehaviour?: InitBehaviour;
  destFileExistsBehaviour?: DestFileExistsBehaviour;
  options?: InitFileOptions;
}

/** Extended per-file options. */
export interface InitFileOptions {
  destFileName?: string;
  srcCopyMode?: string;
  contentCreateMode?: string;
  fallbackSource?: string;
}

/** The result of a single initFile operation. */
export interface InitFileResult {
  requested: InitFileRequest;
  finalPath?: string;
  status: "created" | "copied" | "skipped" | "error";
  error?: any;
}
