import type {
  AVAILABLE_CATEGORIES,
  MY_FEATURES,
  MY_META_TAGS,
  MY_META_TECH,
  MY_PROJECTS,
  PROJECT_STATUS,
  USER_NAMES,
} from "./constants";

/**
 * Cache item structure with typed data
 */
export interface CacheItem<T = unknown> {
  accessed: number; // Track when the item was last accessed
  data: T;
  expiry: number;
}

/**
 * Features for type checking and intellisense
 */
export type Feature = (typeof MY_FEATURES)[number];

/**
 * Featured user type for showcasing project adopters
 */
export interface FeaturedUser {
  link: string;
  name: string;
}

/**
 * Options for generating markdown tables
 */
export interface GenerateOptions {
  /** Whether to fetch version information automatically */
  autoVersion?: boolean;

  /** Cache duration in seconds */
  cacheDuration?: number;

  /** Enable cache for API requests */
  enableCache?: boolean;

  /** Custom icon for open-source projects (default: 🔓) */
  ossIcon?: string;

  /** Custom icon for private projects (default: 🔐) */
  privateIcon?: string;

  /** Number of retries for failed API requests */
  retries?: number;

  /** Whether to show project status */
  showStatus?: boolean;

  /** Sort projects by property */
  sortBy?: "id" | "stars" | "updated";

  /** Sort direction */
  sortDirection?: "asc" | "desc";

  /** Whether to show repository stars counts */
  stars?: boolean;

  /** Custom status indicators (keyed by ProjectStatus) */
  statusIcons?: Record<ProjectStatus, string>;

  /** Timeout for API requests in milliseconds */
  timeout?: number;

  /** Use UNGH for GitHub repos (default: true) */
  useUngh?: boolean;

  /** Whether to show version information */
  versions?: boolean;
}

/**
 * Project interface.
 */
export interface Project {
  /**
   * The project category. Use one of:
   * "template", "collection", "library", "cli", or "saas"
   */
  category: ProjectCategory;

  /** Brief description of the project's purpose */
  description: string;

  /** Link to documentation */
  docs: string;

  /** List of key features */
  features: Feature[];

  /** Icon representation (e.g., emoji or path) */
  icon: string;

  /** Unique identifier from MY_PROJECTS */
  id: ProjectId;

  /** Primary link (e.g., homepage or repo) */
  link: string;

  /** Detailed description of the project */
  longDescription: string;

  /** Whether the project is open source */
  oss: boolean;

  /** List of IDs of related projects */
  relatedProjects: ProjectId[];

  /** Array of screenshot URLs or paths */
  screenshots: string[];

  /** Indicates a planned project not yet released */
  soon: boolean;

  /** Project status (active, planning, maintenance, deprecated) */
  status: ProjectStatus;

  /** Tags for categorization */
  tags: ProjectTag[];

  /** Key technologies used */
  technologies: TechStack[];

  /** Display title */
  title: string;

  /** Version identifier (if applicable) */
  ver?: string;

  /** List of featured users or projects using this */
  whoUses: WhoUses;
}

/**
 * Derived type for valid project categories.
 */
export type ProjectCategory = keyof typeof AVAILABLE_CATEGORIES;

/**
 * Options for project fetching functions
 */
export interface ProjectFetchOptions {
  /**
   * Include only open source projects
   * @default true - Include all projects
   */
  ossOnly?: boolean;

  /**
   * Sort results by specified criteria
   * @default 'releaseDate'
   */
  sortBy?: ProjectSortOption;

  /**
   * Sort direction
   * @default 'desc'
   */
  sortDirection?: SortDirection;
}

/**
 * Project ID type for type checking and intellisense
 */
export type ProjectId = (typeof MY_PROJECTS)[number];

/**
 * Sort option for project results
 */
export type ProjectSortOption = "category" | "name" | "releaseDate";

/**
 * Project status type
 * @category Core Types
 */
export type ProjectStatus = keyof typeof PROJECT_STATUS;

/**
 * Tag type for type checking and intellisense
 */
export type ProjectTag = (typeof MY_META_TAGS)[number];

/**
 * Repository data including stars and version information
 */
export interface RepoData {
  lastUpdated?: Date;
  stars?: number;
  version?: string;
}

/**
 * Repository information derived from a Project
 */
export interface RepoInfo {
  /** Combination of owner/name suitable for API calls (e.g., 'owner/repo') */
  apiPath: string;
  name: string;
  owner: string;
  platform: RepositoryPlatform;
  /** Full URL to the repository */
  url: string;
}

/**
 * Repository platform types
 */
export type RepositoryPlatform = "bitbucket" | "github" | "gitlab";

/**
 * Request configuration for API calls
 */
export interface RequestConfig {
  cacheDuration: number;
  enableCache: boolean;
  headers?: Record<string, string>;
  retries: number;
  timeout: number;
}

/**
 * Sort direction
 */
export type SortDirection = "asc" | "desc";

/**
 * Parameter type for the generateMarkdownTable function
 */
export type TableParams = GenerateOptions & {
  /** Categories to include in the table (array of project category keys) */
  categories: ProjectCategory[];
};

/**
 * Technologies type for type checking and intellisense
 */
export type TechStack = (typeof MY_META_TECH)[number];

/**
 * User name type for type checking and intellisense
 */
export type UserName = (typeof USER_NAMES)[number];

/**
 * Who uses type that supports both string keys and full objects
 */
export type WhoUses = ReadonlyArray<FeaturedUser | UserName>;
