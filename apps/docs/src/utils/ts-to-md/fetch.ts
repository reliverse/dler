import { DEFAULT_RETRIES_NUMBER } from "./constants";
import type { CacheItem, GenerateOptions, RepoData, RepoInfo, RequestConfig } from "./types";

/**
 * API endpoints for different services
 */
export const API_ENDPOINTS = {
  BITBUCKET: "https://api.bitbucket.org/2.0",
  GITHUB: "https://api.github.com",
  GITLAB: "https://gitlab.com/api/v4",
  UNGH: "https://ungh.cc",
};

/**
 * Default API request configuration
 */
export const DEFAULT_REQUEST_CONFIG = {
  cacheDuration: 3600, // 1 hour
  enableCache: true,
  retries: 2,
  timeout: 5000, // 5 seconds
};

/**
 * Cache configuration
 */
const CACHE_CONFIG = {
  /** How often to run cache maintenance (ms) */
  CLEANUP_INTERVAL: 15 * 60 * 1000, // 15 minutes
  /** Default TTL if not specified (seconds) */
  DEFAULT_TTL: 3600, // 1 hour
  /** Max number of items to keep in cache */
  MAX_ITEMS: 100,
};

// Cache implementation as a module
export const apiCache = (() => {
  const cache = new Map<string, CacheItem>();
  let cleanupTimer: null | ReturnType<typeof setInterval> = null;

  // Start the cleanup timer
  function startCleanupTimer(): void {
    if (cleanupTimer === null) {
      cleanupTimer = setInterval(maintenance, CACHE_CONFIG.CLEANUP_INTERVAL);
    }
  }

  // Stop the cleanup timer
  function stopCleanupTimer(): void {
    if (cleanupTimer !== null) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }

  // Perform cache maintenance - remove expired items and trim to max size
  function maintenance(): void {
    const now = Date.now();

    // First, remove expired items
    for (const [key, item] of cache.entries()) {
      if (now > item.expiry) {
        cache.delete(key);
      }
    }

    // If we're still over capacity, remove least recently accessed items
    if (cache.size > CACHE_CONFIG.MAX_ITEMS) {
      const entries = Array.from(cache.entries())
        .sort((a, b) => a[1].accessed - b[1].accessed)
        .slice(0, cache.size - CACHE_CONFIG.MAX_ITEMS);

      for (const [key] of entries) {
        cache.delete(key);
      }
    }
  }

  // Get data from cache if available and not expired
  function get<T>(key: string): null | T {
    const item = cache.get(key) as CacheItem<T> | undefined;
    if (!item) return null;

    const now = Date.now();
    if (now > item.expiry) {
      cache.delete(key);
      return null;
    }

    // Update last accessed time
    item.accessed = now;
    return item.data;
  }

  // Store data in cache with expiration
  function set<T>(key: string, data: T, ttlSeconds = CACHE_CONFIG.DEFAULT_TTL): void {
    const now = Date.now();
    const expiry = now + ttlSeconds * 1000;

    cache.set(key, {
      accessed: now,
      data,
      expiry,
    });

    // If we've hit the limit, run maintenance
    if (cache.size > CACHE_CONFIG.MAX_ITEMS) {
      maintenance();
    }
  }

  // Clear the entire cache
  function clear(): void {
    cache.clear();
  }

  // Get the number of items in the cache
  function size(): number {
    return cache.size;
  }

  // Initialize the module
  startCleanupTimer();

  return {
    clear,
    get,
    maintenance,
    set,
    size,
    stopCleanupTimer,
  };
})();

/**
 * Fetch repository data for all platforms
 */
export async function fetchAllRepoData(
  repos: RepoInfo[],
  options: GenerateOptions
): Promise<Record<string, RepoData>> {
  // Group repositories by platform
  const githubRepos = repos.filter((repo) => repo.platform === "github");
  const gitlabRepos = repos.filter((repo) => repo.platform === "gitlab");
  const bitbucketRepos = repos.filter((repo) => repo.platform === "bitbucket");

  // Fetch data for each platform in parallel
  console.log(
    `Fetching data for ${githubRepos.length} GitHub, ${gitlabRepos.length} GitLab, ${bitbucketRepos.length} Bitbucket repos...`
  );

  const fetchStartTime = Date.now();
  const useUngh = options.useUngh !== false;

  const [githubData, gitlabData, bitbucketData] = await Promise.all([
    githubRepos.length > 0
      ? useUngh
        ? fetchGitHubRepoDataWithUngh(githubRepos, options)
        : fetchGitHubRepoDataWithGitHubAPI(githubRepos, options)
      : Promise.resolve({}),
    gitlabRepos.length > 0 ? fetchGitLabRepoData(gitlabRepos, options) : Promise.resolve({}),
    bitbucketRepos.length > 0
      ? fetchBitbucketRepoData(bitbucketRepos, options)
      : Promise.resolve({}),
  ]);

  const fetchEndTime = Date.now();
  console.log(`Repository data fetching complete in ${fetchEndTime - fetchStartTime}ms.`);

  // Return combined data
  return {
    ...githubData,
    ...gitlabData,
    ...bitbucketData,
  };
}

/**
 * Fetch Bitbucket repository data
 */
export async function fetchBitbucketRepoData(
  repos: RepoInfo[],
  options: GenerateOptions
): Promise<Record<string, RepoData>> {
  const repoData: Record<string, RepoData> = {};
  const config = getRequestConfig(options);

  if (repos.length === 0) return repoData;

  const concurrencyLimit = 3;
  const needsData = options.versions || options.autoVersion || options.sortBy === "updated";

  if (needsData) {
    await processBatch(
      repos,
      async (repo) => {
        try {
          const cacheKey = `bitbucket_${repo.apiPath}`;
          const { data } = await fetchWithRetry<{ updated_on?: string }>(
            `${API_ENDPOINTS.BITBUCKET}/repositories/${repo.apiPath}`,
            { ...config, cacheKey, retries: DEFAULT_RETRIES_NUMBER }
          );

          if (!repoData[repo.apiPath]) repoData[repo.apiPath] = {};

          if (data.updated_on) {
            repoData[repo.apiPath].lastUpdated = new Date(data.updated_on);
          }
        } catch (error) {
          console.warn(`Failed to fetch Bitbucket data for ${repo.apiPath}:`, error);
        }
      },
      concurrencyLimit
    );
  }

  return repoData;
}

/**
 * Fetch GitHub repository data using GitHub API directly
 */
export async function fetchGitHubRepoDataWithGitHubAPI(
  repos: RepoInfo[],
  options: GenerateOptions
): Promise<Record<string, RepoData>> {
  const repoData: Record<string, RepoData> = {};
  const config = getRequestConfig(options);

  if (repos.length === 0) return repoData;

  // 1. Fetch release versions if requested (with limited concurrency)
  if (options.versions || options.autoVersion) {
    const concurrencyLimit = 3; // GitHub has strict rate limits

    await processBatch(
      repos,
      async (repo) => {
        try {
          const cacheKey = `github_release_${repo.apiPath}`;
          const { data } = await fetchWithRetry<{
            published_at?: string;
            tag_name?: string;
          }>(`${API_ENDPOINTS.GITHUB}/repos/${repo.apiPath}/releases/latest`, {
            ...config,
            cacheKey,
            retries: DEFAULT_RETRIES_NUMBER,
          });

          if (data.tag_name) {
            if (!repoData[repo.apiPath]) repoData[repo.apiPath] = {};
            repoData[repo.apiPath].version = data.tag_name.replace(/^v/i, "");

            if (data.published_at) {
              repoData[repo.apiPath].lastUpdated = new Date(data.published_at);
            }
          }
        } catch (error) {
          if (error instanceof Error && !error.message.includes("not found")) {
            console.warn(`Failed to fetch GitHub version for ${repo.apiPath}:`, error);
          }
        }
      },
      concurrencyLimit
    );
  }

  // 2. Fetch repo details for stars and other metadata
  if (options.stars || options.sortBy === "stars" || options.sortBy === "updated") {
    const concurrencyLimit = 3;

    await processBatch(
      repos,
      async (repo) => {
        try {
          const cacheKey = `github_repo_${repo.apiPath}`;
          const { data } = await fetchWithRetry<{
            stargazers_count?: number;
            updated_at?: string;
          }>(`${API_ENDPOINTS.GITHUB}/repos/${repo.apiPath}`, {
            ...config,
            cacheKey,
            retries: DEFAULT_RETRIES_NUMBER,
          });

          if (!repoData[repo.apiPath]) repoData[repo.apiPath] = {};

          if (options.stars && data.stargazers_count !== undefined) {
            repoData[repo.apiPath].stars = data.stargazers_count;
          }

          if (
            options.sortBy === "updated" &&
            !repoData[repo.apiPath]?.lastUpdated &&
            data.updated_at
          ) {
            repoData[repo.apiPath].lastUpdated = new Date(data.updated_at);
          }
        } catch (error) {
          console.warn(`Failed to fetch GitHub repo data for ${repo.apiPath}:`, error);
        }
      },
      concurrencyLimit
    );
  }

  return repoData;
}

/**
 * Fetch GitHub repository data using UNGH
 */
export async function fetchGitHubRepoDataWithUngh(
  repos: RepoInfo[],
  options: GenerateOptions
): Promise<Record<string, RepoData>> {
  const repoData: Record<string, RepoData> = {};
  const config = getRequestConfig(options);

  if (repos.length === 0) return repoData;

  // 1. Fetch stars in batch if requested (UNGH supports this)
  if (options.stars) {
    try {
      const batchSize = 10; // Reasonable batch size for URL length

      // Process in batches to avoid excessively long URLs
      for (let i = 0; i < repos.length; i += batchSize) {
        const batchRepos = repos.slice(i, i + batchSize);
        const batchPaths = batchRepos.map((repo) => repo.apiPath).join("+");
        const cacheKey = `ungh_stars_${batchPaths}`;

        const { data } = await fetchWithRetry<{
          stars?: Record<string, number>;
        }>(`${API_ENDPOINTS.UNGH}/stars/${batchPaths}`, {
          ...config,
          cacheKey,
          retries: DEFAULT_RETRIES_NUMBER,
        });

        if (data.stars) {
          for (const [repoPath, count] of Object.entries(data.stars)) {
            if (!repoData[repoPath]) repoData[repoPath] = {};
            repoData[repoPath].stars = count;
          }
        }
      }
    } catch (error) {
      console.warn("Failed to fetch GitHub stars with UNGH:", error);
    }
  }

  // 2. Fetch release info if requested (with concurrency limits)
  if (options.versions || options.autoVersion) {
    const concurrencyLimit = 5;

    await processBatch(
      repos,
      async (repo) => {
        try {
          const cacheKey = `ungh_release_${repo.apiPath}`;

          const { data } = await fetchWithRetry<{
            release?: { publishedAt?: string; tag: string };
          }>(`${API_ENDPOINTS.UNGH}/repos/${repo.apiPath}/releases/latest`, {
            ...config,
            cacheKey,
            retries: DEFAULT_RETRIES_NUMBER,
          });

          if (data.release?.tag) {
            if (!repoData[repo.apiPath]) repoData[repo.apiPath] = {};
            repoData[repo.apiPath].version = data.release.tag.replace(/^v/i, "");

            if (data.release.publishedAt) {
              repoData[repo.apiPath].lastUpdated = new Date(data.release.publishedAt);
            }
          }
        } catch (error) {
          if (error instanceof Error && !error.message.includes("not found")) {
            console.warn(`Failed to fetch release info for ${repo.apiPath} with UNGH:`, error);
          }
        }
      },
      concurrencyLimit
    );
  }

  // 3. Fetch general repo data for sorting
  if (options.sortBy === "updated" || (options.sortBy === "stars" && !options.stars)) {
    const reposToFetch = repos.filter((repo) => {
      const repoEntry = repoData[repo.apiPath] || {};
      return (
        (options.sortBy === "updated" && !repoEntry.lastUpdated) ||
        (options.sortBy === "stars" && !repoEntry.stars)
      );
    });

    if (reposToFetch.length > 0) {
      const concurrencyLimit = 5;

      await processBatch(
        reposToFetch,
        async (repo) => {
          try {
            const cacheKey = `ungh_repo_${repo.apiPath}`;
            const { data } = await fetchWithRetry<{
              repo?: { stars?: number; updatedAt?: string };
            }>(`${API_ENDPOINTS.UNGH}/repos/${repo.apiPath}`, {
              ...config,
              cacheKey,
              retries: DEFAULT_RETRIES_NUMBER,
            });

            if (data.repo) {
              if (!repoData[repo.apiPath]) repoData[repo.apiPath] = {};

              if (!repoData[repo.apiPath].stars && data.repo.stars) {
                repoData[repo.apiPath].stars = data.repo.stars;
              }

              if (!repoData[repo.apiPath].lastUpdated && data.repo.updatedAt) {
                repoData[repo.apiPath].lastUpdated = new Date(data.repo.updatedAt);
              }
            }
          } catch (error) {
            console.warn(`Failed to fetch repo data for ${repo.apiPath} with UNGH:`, error);
          }
        },
        concurrencyLimit
      );
    }
  }

  return repoData;
}

/**
 * Fetch GitLab repository data
 */
export async function fetchGitLabRepoData(
  repos: RepoInfo[],
  options: GenerateOptions
): Promise<Record<string, RepoData>> {
  const repoData: Record<string, RepoData> = {};
  const config = getRequestConfig(options);

  if (repos.length === 0) return repoData;

  const concurrencyLimit = 3;
  const needsData =
    options.stars ||
    options.versions ||
    options.autoVersion ||
    options.sortBy === "stars" ||
    options.sortBy === "updated";

  if (needsData) {
    await processBatch(
      repos,
      async (repo) => {
        try {
          // GitLab API expects URL-encoded path
          const encodedPath = encodeURIComponent(repo.apiPath);
          const cacheKey = `gitlab_${encodedPath}`;

          const { data } = await fetchWithRetry<{
            last_activity_at?: string;
            star_count?: number;
          }>(`${API_ENDPOINTS.GITLAB}/projects/${encodedPath}`, {
            ...config,
            cacheKey,
            retries: DEFAULT_RETRIES_NUMBER,
          });

          if (!repoData[repo.apiPath]) repoData[repo.apiPath] = {};

          if ((options.stars || options.sortBy === "stars") && data.star_count !== undefined) {
            repoData[repo.apiPath].stars = data.star_count;
          }

          if (
            (options.versions || options.autoVersion || options.sortBy === "updated") &&
            data.last_activity_at
          ) {
            repoData[repo.apiPath].lastUpdated = new Date(data.last_activity_at);
          }
        } catch (error) {
          console.warn(`Failed to fetch GitLab data for ${repo.apiPath}:`, error);
        }
      },
      concurrencyLimit
    );
  }

  return repoData;
}

/**
 * Fetch data with timeout, retry logic, and caching
 */
export async function fetchWithRetry<T>(
  url: string,
  options: {
    cacheDuration?: number;
    cacheKey?: string;
    enableCache?: boolean;
    headers?: Record<string, string>;
    retries: number;
    timeout: number;
  }
): Promise<{ data: T; fromCache: boolean }> {
  const {
    cacheDuration = DEFAULT_REQUEST_CONFIG.cacheDuration,
    cacheKey,
    enableCache = true,
    headers = {},
    retries,
    timeout,
  } = options;

  // Check cache first if enabled and cache key provided
  if (enableCache && cacheKey) {
    const cachedData = apiCache.get<T>(cacheKey);
    if (cachedData) {
      return { data: cachedData, fromCache: true };
    }
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("Timeout"), timeout);

  let lastError: Error | null = null;
  let attempts = 0;

  while (attempts <= retries) {
    try {
      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId); // Clear timeout on response

      if (!response.ok) {
        const errorMsg = `HTTP error ${response.status}: ${response.statusText}`;

        // Special handling for common error responses
        if (response.status === 404) {
          // For 404s, we don't need to retry
          throw new Error(
            `Resource not found (404 / Does the repo have at least 1 release?): ${url}`
          );
        }

        if (response.status === 403) {
          // Likely rate limited
          const resetTime = response.headers.get("X-RateLimit-Reset");
          const waitTime = resetTime ? Number.parseInt(resetTime, 10) * 1000 - Date.now() : 60_000;

          console.warn(`Rate limited (403). Reset in ${Math.ceil(waitTime / 1000)}s`);
          // Don't retry if rate limited - it will just fail again
          throw new Error(`API rate limit exceeded (403): ${url}`);
        }

        // For other errors, allow retries
        throw new Error(errorMsg);
      }

      // Parse JSON response
      const data = (await response.json()) as T;

      // Cache successful responses if caching is enabled
      if (enableCache && cacheKey) {
        apiCache.set<T>(cacheKey, data, cacheDuration);
      }

      return { data, fromCache: false };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      clearTimeout(timeoutId); // Clear timeout if fetch itself fails

      // Don't retry if aborted by our timeout
      if (controller.signal.aborted && controller.signal.reason === "Timeout") {
        throw new Error(`Request timed out after ${timeout}ms: ${url}`);
      }

      // Don't retry certain errors like 404s
      if (
        lastError.message.includes("Resource not found (404)") ||
        lastError.message.includes("API rate limit exceeded")
      ) {
        throw lastError;
      }

      // Log retry attempt if not the last attempt
      attempts++;
      if (attempts <= retries) {
        const delay = Math.min(500 * 2 ** attempts, 10_000); // Cap at 10 seconds
        console.warn(
          `Attempt ${attempts}/${retries} failed for ${url}. Retrying in ${delay}ms. Error: ${lastError.message}`
        );
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // If all retries fail, throw the last encountered error
  throw lastError || new Error(`Failed to fetch ${url} after multiple attempts`);
}

/**
 * Get request configuration from options
 */
export function getRequestConfig(options: GenerateOptions): RequestConfig {
  return {
    cacheDuration: options.cacheDuration ?? DEFAULT_REQUEST_CONFIG.cacheDuration,
    enableCache: options.enableCache ?? DEFAULT_REQUEST_CONFIG.enableCache,
    headers: {
      Accept: "application/json",
    },
    retries: options.retries ?? DEFAULT_REQUEST_CONFIG.retries,
    timeout: options.timeout ?? DEFAULT_REQUEST_CONFIG.timeout,
  };
}

/**
 * Process items in batches with limited concurrency
 */
export async function processBatch<T, R>(
  items: T[],
  handler: (item: T) => Promise<R>,
  concurrencyLimit: number
): Promise<R[]> {
  const results: R[] = [];
  let processed = 0;
  const total = items.length;

  for (let i = 0; i < items.length; i += concurrencyLimit) {
    const batch = items.slice(i, i + concurrencyLimit);
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        const result = await handler(item);
        processed++;
        if (processed % 5 === 0 || processed === total) {
          // Clear previous line (if supported)
          process.stdout.write("\r");
          process.stdout.write(
            `Processing items: ${processed}/${total} (${Math.round((processed / total) * 100)}%)`
          );
        }
        return result;
      })
    );
    results.push(...batchResults);
  }
  // Print newline after progress bar is done
  if (total > 0) {
    process.stdout.write("\n");
  }
  return results;
}
