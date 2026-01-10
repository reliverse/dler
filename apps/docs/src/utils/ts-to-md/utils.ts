import { fetchAllRepoData } from "./fetch";
import type {
  FeaturedUser,
  GenerateOptions,
  Project,
  ProjectCategory,
  ProjectFetchOptions,
  ProjectId,
  ProjectSortOption,
  ProjectStatus,
  ProjectTag,
  RepoData,
  RepoInfo,
  RepositoryPlatform,
  SortDirection,
  TechStack,
  UserName,
  WhoUses,
} from "./types";

/**
 * User links mapped by name
 */
export const USER_LINKS: Record<UserName, string> = {
  cli: "https://github.com/reliverse/cli",
  gem: "https://github.com/blefnk/gem",
};

/**
 * Find a project by id.
 *
 * @param id - The project id.
 * @returns The matching project or undefined if not found.
 */
export function findProjectById(projects: readonly Project[], id: string): Project | undefined {
  return projects.find((p) => p.id.toLowerCase() === id.toLowerCase());
}

/**
 * Get all projects.
 * @returns A copy of all projects to prevent unintended mutations.
 */
export function getAllProjects(projects: readonly Project[]): Project[] {
  return [...projects];
}

/**
 * Get all open source projects.
 * @returns Array of open source projects.
 */
export function getOpenSourceProjects(projects: readonly Project[]): Project[] {
  return projects.filter((project) => project.oss);
}

/**
 * Find a project by its unique id.
 *
 * @param id - The id of the project.
 * @returns The matching project or undefined if not found.
 */
export function getProjectById(projects: readonly Project[], id: ProjectId): Project | undefined {
  return projects.find((project) => project.id === id);
}

/**
 * Get projects by category.
 *
 * @param category - The category to filter by
 * @returns Array of projects in the specified category
 */
export function getProjectsByCategory(
  projects: readonly Project[],
  category: ProjectCategory
): Project[] {
  return projects.filter((project) => project.category === category);
}

/**
 * Get projects by their status.
 *
 * @param status - The status to filter by.
 * @returns Array of projects with the specified status.
 */
export function getProjectsByStatus(
  projects: readonly Project[],
  status: ProjectStatus
): Project[] {
  return projects.filter((project) => project.status === status);
}

/**
 * Get projects by tag.
 *
 * @param tag - The tag to search for
 * @returns Array of projects with the specified tag
 */
export function getProjectsByTag(projects: readonly Project[], tag: ProjectTag): Project[] {
  return projects.filter((project) => project.tags.some((t) => t === tag));
}

/**
 * Get projects by tag.
 *
 * @param tag - The tag to search for
 * @returns Array of projects with the specified tag
 */
export function getProjectsByTech(projects: readonly Project[], tech: TechStack): Project[] {
  return projects.filter((project) => project.technologies.some((t) => t === tech));
}

/**
 * Get projects with no release information available
 *
 * @param options - Options for filtering and sorting results
 * @returns Promise resolving to an array of projects with no release information
 * @example
 *   // Get all projects with no release information
 *   const projects = await getProjectsWithNoReleases();
 *
 *   // Get only open-source projects with no releases, sorted by name
 *   const projects = await getProjectsWithNoReleases({
 *     ossOnly: true,
 *     sortBy: "name",
 *     sortDirection: "asc"
 *   });
 */
export async function getProjectsWithNoReleases(
  projects: readonly Project[],
  options: ProjectFetchOptions = {}
): Promise<Project[]> {
  console.log("Finding projects with no release information...");

  // Use the helper function to fetch repository data
  const { projectsWithValidRepos, repoData } = await getValidRepositoryProjects(projects);

  // Apply OSS filter if specified
  const filteredProjects = options.ossOnly
    ? projectsWithValidRepos.filter((p) => p.oss)
    : projectsWithValidRepos;

  // Filter projects with no release information
  const projectsWithNoReleaseInfo = filteredProjects.filter((project) => {
    const repoInfo = getRepoInfoFromProject(project);
    if (!repoInfo) return false;

    const repoDataEntry = repoData[repoInfo.apiPath];
    return !repoDataEntry?.lastUpdated;
  });

  // Sort the results if specified
  let finalResults = projectsWithNoReleaseInfo;
  if (options.sortBy) {
    finalResults = sortProjects(
      finalResults,
      options.sortBy,
      options.sortDirection || "desc",
      repoData
    );
  }

  console.log(`Found ${finalResults.length} projects with no release information.`);

  return finalResults;
}

/**
 * Get projects with a last release date no later than the specified date or projects with no release date
 *
 * @param dateString - The date string in any format (DD-MM-YYYY, YYYY-MM-DD, MM/DD/YYYY, etc.)
 * @param options - Options for filtering and sorting results
 * @returns Promise resolving to an array of projects meeting the criteria
 * @example
 *   // Get projects with releases before 2025
 *   const projects = await getProjectsWithReleasesBeforeDate("01-01-2025");
 *
 *   // Get OSS projects with releases before last month, sorted by name
 *   const projects = await getProjectsWithReleasesBeforeDate("1 month ago", {
 *     ossOnly: true,
 *     sortBy: "name",
 *     sortDirection: "asc"
 *   });
 */
export async function getProjectsWithReleasesBeforeDate(
  projects: readonly Project[],
  dateString: string,
  options: ProjectFetchOptions = {}
): Promise<Project[]> {
  // Parse the input date string intelligently
  const parsedDate = parseFlexibleDateFormat(dateString);

  if (!parsedDate) {
    throw new Error(`Unable to parse date: ${dateString}. Please provide a valid date format.`);
  }

  console.log(`Finding projects with releases before ${parsedDate.toISOString().split("T")[0]}...`);

  // Use the helper function to fetch repository data
  const { projectsWithValidRepos, repoData } = await getValidRepositoryProjects(projects);

  // Apply OSS filter if specified
  const filteredProjects = options.ossOnly
    ? projectsWithValidRepos.filter((p) => p.oss)
    : projectsWithValidRepos;

  // Filter projects based on release date
  const projectsWithEarlierReleases: Project[] = [];
  const projectsWithNoReleaseDate: Project[] = [];

  for (const project of filteredProjects) {
    const repoInfo = getRepoInfoFromProject(project);
    if (!repoInfo) continue;

    const repoDataEntry = repoData[repoInfo.apiPath];

    // If no release date is available, inject to separate list
    if (!repoDataEntry?.lastUpdated) {
      projectsWithNoReleaseDate.push(project);
      continue;
    }

    // Compare the last updated date with the parsed date
    if (repoDataEntry.lastUpdated <= parsedDate) {
      projectsWithEarlierReleases.push(project);
    }
  }

  // Combine results: projects with release before the specified date + projects with no release date
  let finalResults = [...projectsWithEarlierReleases, ...projectsWithNoReleaseDate];

  // Sort the results if specified
  if (options.sortBy) {
    finalResults = sortProjects(
      finalResults,
      options.sortBy,
      options.sortDirection || "desc",
      repoData
    );
  }

  console.log(
    `Found ${projectsWithEarlierReleases.length} projects with releases before the date and ` +
      `${projectsWithNoReleaseDate.length} projects with no release date.`
  );

  return finalResults;
}

/**
 * Get projects with releases between two dates
 *
 * @param startDateString - The start date string in any format including:
 *   - Standard date formats (YYYY-MM-DD, DD/MM/YYYY, etc.)
 *   - Relative expressions: "today", "yesterday", "tomorrow"
 *   - Time periods: "X days/weeks/months/years ago", "X days/weeks/months/years from now"
 * @param endDateString - The end date string in any format (same options as startDateString)
 * @param options - Options for filtering and sorting results
 * @returns Promise resolving to an array of projects with releases between the specified dates
 * @example
 *   // Find projects released in the last month
 *   getProjectsWithReleasesBetweenDates("1 month ago", "today")
 *
 *   // Find projects released in 2025, sorted by release date
 *   getProjectsWithReleasesBetweenDates("01-01-2025", "31-12-2025", {
 *     sortBy: "releaseDate",
 *     sortDirection: "asc"
 *   })
 */
export async function getProjectsWithReleasesBetweenDates(
  projects: readonly Project[],
  startDateString: string,
  endDateString: string,
  options: ProjectFetchOptions = {}
): Promise<Project[]> {
  const startDate = parseFlexibleDateFormat(startDateString);
  const endDate = parseFlexibleDateFormat(endDateString);

  if (!(startDate && endDate)) {
    throw new Error("Unable to parse one or both dates. Please provide valid date formats.");
  }

  // If start and end dates are the same day, adjust end date to end of day
  if (
    startDate.getFullYear() === endDate.getFullYear() &&
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getDate() === endDate.getDate()
  ) {
    endDate.setHours(23, 59, 59, 999);
  } else if (startDate > endDate) {
    throw new Error("Start date must be before end date.");
  }

  console.log(
    `Finding projects with releases between ${startDate.toISOString().split("T")[0]} and ${endDate.toISOString().split("T")[0]}...`
  );

  // Use the helper function to fetch repository data
  const { projectsWithValidRepos, repoData } = await getValidRepositoryProjects(projects);

  // Apply OSS filter if specified
  const filteredProjects = options.ossOnly
    ? projectsWithValidRepos.filter((p) => p.oss)
    : projectsWithValidRepos;

  // Filter projects with releases between the dates
  const result: Project[] = [];

  for (const project of filteredProjects) {
    const repoInfo = getRepoInfoFromProject(project);
    if (!repoInfo) continue;

    const repoDataEntry = repoData[repoInfo.apiPath];

    if (
      repoDataEntry?.lastUpdated &&
      repoDataEntry.lastUpdated >= startDate &&
      repoDataEntry.lastUpdated <= endDate
    ) {
      result.push(project);
    }
  }

  // Sort the results if specified
  let finalResults = result;
  if (options.sortBy) {
    finalResults = sortProjects(
      finalResults,
      options.sortBy,
      options.sortDirection || "desc",
      repoData
    );
  }

  console.log(`Found ${finalResults.length} projects with releases between the specified dates.`);

  return finalResults;
}

/**
 * Helper function to get a unique identifier for a project.
 */
export function getProjectUniqueId(project: Project): string {
  return project.id;
}

// ===================================
// SORTING & FILTERING
// ===================================

/**
 * Get related projects based on the category or explicit relations.
 *
 * @param id - Unique id of the current project.
 * @param count - Number of related projects to return (default is 3).
 * @returns Array of related projects or empty array if the project is not found.
 */
export function getRelatedProjects(
  projects: readonly Project[],
  id: ProjectId,
  count = 3
): Project[] {
  const currentProject = getProjectById(projects, id);
  if (!currentProject) return [];

  // 1. Use explicitly defined related projects first
  const explicitRelated = currentProject.relatedProjects
    .map((relatedId) => getProjectById(projects, relatedId))
    .filter((p): p is Project => p !== undefined);

  if (explicitRelated.length >= count) {
    return explicitRelated.slice(0, count);
  }

  // 2. If not enough explicit relations, fill with projects from the same category
  const needed = count - explicitRelated.length;
  const explicitRelatedIds = new Set(explicitRelated.map((p) => p.id));
  explicitRelatedIds.add(id); // Exclude self

  const sameCategory = projects
    .filter(
      (p) =>
        !explicitRelatedIds.has(p.id) && // Exclude self and already added relations
        p.category === currentProject.category
    )
    .slice(0, needed);

  const combined = [...explicitRelated, ...sameCategory];

  if (combined.length >= count) {
    return combined;
  }

  // 3. If still not enough, fill with *any* other projects (excluding added ones)
  const stillNeeded = count - combined.length;
  const combinedIds = new Set(combined.map((p) => p.id));
  combinedIds.add(id); // Exclude self

  const others = projects.filter((p) => !combinedIds.has(p.id)).slice(0, stillNeeded);

  return [...combined, ...others];
}

/**
 * Get repository information from a Project object.
 * Prioritizes platformInfo. Falls back to parsing url.
 */
export function getRepoInfoFromProject(project: Project): null | RepoInfo {
  const url = project.link;

  // Parsing the URL
  try {
    const parsed = new URL(url);
    let detectedPlatform: null | RepositoryPlatform = null;
    let parts: string[];

    if (parsed.hostname === "github.com") {
      detectedPlatform = "github";
      parts = parsed.pathname.split("/").filter(Boolean);
    } else if (parsed.hostname === "gitlab.com") {
      detectedPlatform = "gitlab";
      parts = parsed.pathname.split("/").filter(Boolean);
    } else if (parsed.hostname === "bitbucket.org") {
      detectedPlatform = "bitbucket";
      parts = parsed.pathname.split("/").filter(Boolean);
    } else {
      return null; // Unsupported hostname
    }

    if (detectedPlatform && parts.length >= 2) {
      return {
        apiPath: `${parts[0]}/${parts[1]}`,
        name: parts[1],
        owner: parts[0],
        platform: detectedPlatform,
        url,
      };
    }

    return null;
  } catch (e) {
    console.warn(`Could not derive RepoInfo for project ${project.id}:`, e);
    return null;
  }
}

/**
 * Convert user names to full FeaturedUser objects
 */
export function normalizeWhoUses(whoUses: WhoUses): readonly FeaturedUser[] {
  return whoUses.map((user) => {
    if (typeof user === "string") {
      // Check if it's a known user name
      if (USER_LINKS[user as UserName]) {
        return {
          link: USER_LINKS[user as UserName],
          name: user,
        };
      }
      // Fallback for unknown users (should not happen with proper typing)
      return {
        link: `https://github.com/${user}`,
        name: user,
      };
    }
    return user;
  });
}

/**
 * Validate if all projects conform to the Project interface requirements.
 * This is mostly for runtime, as TypeScript handles compile-time checks.
 *
 * @returns Object with validation result and any error messages
 */
export function validateAllProjects(projects: readonly Project[]): {
  errors: string[];
  valid: boolean;
} {
  const errors: string[] = [];

  if (!projects) {
    return { errors: [], valid: true };
  }

  if (projects.length === 0) {
    return { errors: [], valid: true };
  }

  // Required keys in the Project interface
  const requiredKeys: Array<keyof Project> = [
    "id",
    "title",
    "description",
    "longDescription",
    "icon",
    "link",
    "docs",
    "category",
    "technologies",
    "features",
    "oss",
    "screenshots",
    "relatedProjects",
    "ver",
    "soon",
    "tags",
    "status",
    "whoUses",
  ];

  for (const [index, project] of projects.entries()) {
    for (const key of requiredKeys) {
      if (project[key] === undefined || project[key] === null) {
        errors.push(`Project[${index}] (id: ${project.id}) is missing required key: ${key}`);
      }
    }

    // Validate whoUses entries
    if (project.whoUses) {
      for (const [userIndex, user] of project.whoUses.entries()) {
        if (typeof user === "string" && !USER_LINKS[user as UserName]) {
          errors.push(
            `Project[${index}] (id: ${project.id}) has unknown user name at whoUses[${userIndex}]: ${user}`
          );
        }
      }
    }
  }

  return { errors, valid: errors.length === 0 };
}

/**
 * Helper function to gather repository information for projects with valid repository links
 * @returns Object containing filtered projects and their repo info
 */
async function getValidRepositoryProjects(projects: readonly Project[]): Promise<{
  projectsWithValidRepos: Project[];
  repoData: Record<string, RepoData>;
}> {
  const allProjects = getAllProjects(projects);
  const projectsWithValidRepos: Project[] = [];
  const reposToFetch: RepoInfo[] = [];

  // Filter projects with valid repository links
  for (const project of allProjects) {
    if (!/github\.com|gitlab\.com|bitbucket\.org/i.test(project.link)) {
      continue;
    }

    const repoInfo = getRepoInfoFromProject(project);
    if (repoInfo) {
      projectsWithValidRepos.push(project);
      reposToFetch.push(repoInfo);
    }
  }

  // Fetch repository data
  const fetchOptions: GenerateOptions = {
    autoVersion: true,
    cacheDuration: 3600,
    enableCache: true,
    retries: 2,
    timeout: 10_000,
  };

  const repoData = await fetchAllRepoData(reposToFetch, fetchOptions);

  return { projectsWithValidRepos, repoData };
}

/**
 * Parse a date string including relative date expressions
 *
 * @param dateString - The date string to parse (absolute or relative)
 * @returns A Date object or null if parsing fails
 */
function parseFlexibleDateFormat(dateString: string): Date | null {
  // Handle case-insensitive comparison
  const normalizedInput = dateString.trim().toLowerCase();

  // Current date for relative calculations
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Handle common relative date strings
  switch (normalizedInput) {
    case "last month":
      return new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    case "last week":
      return new Date(today.getTime() - 7 * 86_400_000);
    case "last year":
      return new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    case "next month":
      return new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
    case "next week":
      return new Date(today.getTime() + 7 * 86_400_000);
    case "next year":
      return new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
    case "today":
      return today;
    case "tomorrow":
      return new Date(today.getTime() + 86_400_000); // +1 day in ms
    case "yesterday":
      return new Date(today.getTime() - 86_400_000); // -1 day in ms
  }

  // Handle dynamic relative expressions (X days/months/years ago/from now)
  const dynamicRegex = /^(\d+)\s+(day|days|week|weeks|month|months|year|years)\s+(ago|from now)$/i;
  const match = normalizedInput.match(dynamicRegex);

  if (match) {
    const amount = Number.parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    const direction = match[3].toLowerCase();
    const multiplier = direction === "ago" ? -1 : 1;

    switch (unit) {
      case "day":
      case "days":
        return new Date(today.getTime() + multiplier * amount * 86_400_000);
      case "month":
      case "months":
        return new Date(
          today.getFullYear(),
          today.getMonth() + multiplier * amount,
          today.getDate()
        );
      case "week":
      case "weeks":
        return new Date(today.getTime() + multiplier * amount * 7 * 86_400_000);
      case "year":
      case "years":
        return new Date(
          today.getFullYear() + multiplier * amount,
          today.getMonth(),
          today.getDate()
        );
    }
  }

  // If not a relative date, fall back to the original parsing logic for absolute dates
  // Remove any non-alphanumeric characters and try to guess the format
  const cleanedDateString = normalizedInput.replace(/[^\d]/g, "/");

  // Common date formats to try
  const formats = [
    // Day-Month-Year formats
    (parts: number[]) => new Date(parts[2], parts[1] - 1, parts[0]),
    // Month-Day-Year formats
    (parts: number[]) => new Date(parts[2], parts[0] - 1, parts[1]),
    // Year-Month-Day formats
    (parts: number[]) => new Date(parts[0], parts[1] - 1, parts[2]),
  ];

  // Try to extract numeric parts
  const parts = cleanedDateString.split("/").map((part) => Number.parseInt(part, 10));

  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    // Try direct parsing as a fallback
    const directParse = new Date(dateString);
    return Number.isNaN(directParse.getTime()) ? null : directParse;
  }

  // Try each format until one works
  for (const formatFn of formats) {
    try {
      const date = formatFn(parts);
      // Validate the parsed date
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_e) {}
  }

  // If we reach here, try direct parsing as a last resort
  const directParse = new Date(dateString);
  return Number.isNaN(directParse.getTime()) ? null : directParse;
}

/**
 * Sort projects by the specified criteria
 */
function sortProjects(
  projects: Project[],
  sortBy: ProjectSortOption = "releaseDate",
  direction: SortDirection = "desc",
  repoData?: Record<string, RepoData>
): Project[] {
  return [...projects].sort((a, b) => {
    const multiplier = direction === "asc" ? 1 : -1;

    switch (sortBy) {
      case "category":
        return a.category.localeCompare(b.category) * multiplier;
      case "name":
        return a.title.localeCompare(b.title) * multiplier;
      case "releaseDate": {
        if (!repoData) return 0;

        const repoInfoA = getRepoInfoFromProject(a);
        const repoInfoB = getRepoInfoFromProject(b);

        const dateA =
          repoInfoA && repoData[repoInfoA.apiPath]?.lastUpdated
            ? // @ts-expect-error TODO: fix undefined
              repoData[repoInfoA.apiPath].lastUpdated.getTime()
            : 0;
        const dateB =
          repoInfoB && repoData[repoInfoB.apiPath]?.lastUpdated
            ? // @ts-expect-error TODO: fix undefined
              repoData[repoInfoB.apiPath].lastUpdated.getTime()
            : 0;

        return (dateA - dateB) * multiplier;
      }
      default:
        return 0;
    }
  });
}
