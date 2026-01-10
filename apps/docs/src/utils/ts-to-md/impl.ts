import { projects } from "~/utils/ts-to-md/projects";
import { AVAILABLE_CATEGORIES, TABLE_SEPARATOR } from "./constants";
import { fetchAllRepoData } from "./fetch";
import type {
  GenerateOptions,
  Project,
  ProjectCategory,
  ProjectStatus,
  RepoData,
  RepoInfo,
  TableParams,
} from "./types";
import { getRepoInfoFromProject, validateAllProjects } from "./utils";

/**
 * Constants for markdown rendering
 */
const ICONS = {
  COMING_SOON: "🔜",
  OSS: "🔓",
  PRIVATE: "🔐",
  STAR: "⭐",
  STATUS: {
    ACTIVE: "🟢",
    DEPRECATED: "⚫",
    MAINTENANCE: "🟠",
    PLANNING: "🟣",
  } as const satisfies Record<ProjectStatus, string>,
  VERSION: "📦",
};

/**
 * Generates a Markdown table of projects organized by category.
 * @param params - Categories and options for the table generation.
 * @returns Promise resolving to formatted Markdown table as a string.
 * @example
 * // Basic usage with default options
 * await generateMarkdownTable({ categories: ['template', 'library'] });
 *
 * // With automatic version fetching and stars
 * await generateMarkdownTable({
 *   categories: ['template', 'library'],
 *   autoVersion: true,
 *   stars: true
 * });
 *
 * // With sorting and caching
 * await generateMarkdownTable({
 *   categories: ['template', 'library'],
 *   stars: true,
 *   sortBy: "stars",
 *   sortDirection: "desc",
 *   enableCache: true,
 *   cacheDuration: 7200  // 2 hours
 * });
 */
export async function generateMarkdownTable(params: TableParams): Promise<string> {
  // Validate project data structure first
  const validationResult = validateAllProjects(projects);
  if (!validationResult.valid) {
    console.error("❌ Project data validation failed:", validationResult.errors);
    throw new Error("Project data validation failed. Cannot generate table.");
  }
  console.log("✅ All projects validated successfully.");

  // Destructure the category keys and remaining options
  const { categories: selectedCategoryKeys, ...options } = params;

  if (!selectedCategoryKeys || selectedCategoryKeys.length === 0) {
    throw new Error("No categories provided for markdown table generation.");
  }

  // Ensure selected categories are valid
  const validCategoryKeys = selectedCategoryKeys.filter((catKey) => AVAILABLE_CATEGORIES[catKey]);

  if (validCategoryKeys.length === 0) {
    return "<!-- No valid categories selected for table generation. -->";
  }

  // Group projects by the valid categories provided
  const groupedCategories = validCategoryKeys.map((catKey) => {
    const categoryProjects = projects.filter((p) => p.category === catKey);
    return {
      key: catKey,
      projects: categoryProjects,
      title: AVAILABLE_CATEGORIES[catKey].title,
    };
  });

  // Collect repositories that need data fetching
  const reposToFetch: RepoInfo[] = [];
  const needsRepoData =
    options.stars ||
    options.autoVersion ||
    options.sortBy === "stars" ||
    options.sortBy === "updated";

  if (needsRepoData) {
    for (const group of groupedCategories) {
      for (const project of group.projects) {
        // Skip soon projects and non-OSS projects for data fetching
        if (project.soon || !project.oss) continue;

        const repoInfo = getRepoInfoFromProject(project);
        if (
          repoInfo &&
          !reposToFetch.some(
            (r) => r.apiPath === repoInfo.apiPath && r.platform === repoInfo.platform
          )
        ) {
          reposToFetch.push(repoInfo);
        }
      }
    }
  }

  // Fetch repository data
  let repoData: Record<string, RepoData> = {};

  if (needsRepoData && reposToFetch.length > 0) {
    repoData = await fetchAllRepoData(reposToFetch, options);
  }

  // Sort projects and create processed categories
  const processedCategories = groupedCategories.map((group) => ({
    ...group,
    projects: sortProjects(group.projects, options, repoData),
  }));

  // Filter out empty categories
  const finalCategories = processedCategories.filter((group) => group.projects.length > 0);

  if (finalCategories.length === 0) {
    return "<!-- No projects found for the selected categories. -->";
  }

  // Generate the markdown table
  return generateTable(finalCategories, options, repoData);
}

/**
 * Format a project's status as markdown
 */
function formatProjectStatus(project: Project, options: GenerateOptions): string {
  if (!options.showStatus) return "";

  const statusIcons = options.statusIcons || ICONS.STATUS;
  const icon = statusIcons[project.status] || "ACTIVE";
  return icon ? ` <sub>${icon}</sub>` : "";
}

/**
 * Generate markdown table from categories and projects
 */
function generateTable(
  categories: Array<{
    key: ProjectCategory;
    projects: Project[];
    title: string;
  }>,
  options: GenerateOptions,
  repoData: Record<string, RepoData>
): string {
  if (categories.length === 0) {
    return "<!-- No categories to display in table. -->";
  }

  // Create table headers and separator row
  const headers = categories.map((group) => group.title).join(" | ");
  const separator = categories.map(() => TABLE_SEPARATOR).join(" | ");

  // Find the maximum number of projects in any category
  const maxRows = Math.max(...categories.map((group) => group.projects.length), 0);

  if (maxRows === 0) {
    return `| ${headers} |\n| ${separator} |\n<!-- No project rows to display. -->`;
  }

  // Generate table rows, padding empty cells
  const rows = Array.from({ length: maxRows }, (_, rowIndex) =>
    categories
      .map((group) => projectToMarkdownCell(group.projects[rowIndex], options, repoData))
      .join(" | ")
  );

  // Combine everything into the final table string
  return [`| ${headers} |`, `| ${separator} |`, ...rows.map((row) => `| ${row} |`)].join("\n");
}

/**
 * Converts a project to a Markdown table cell.
 */
function projectToMarkdownCell(
  project: Project | undefined,
  options: GenerateOptions = {},
  repoData: Record<string, RepoData> = {}
): string {
  if (!project) return ""; // Return empty string if no project (for padding)

  // Handle "coming soon" projects
  if (project.soon) {
    return `*${ICONS.COMING_SOON} ${project.id}*<br />${project.description}`;
  }

  // Determine the appropriate icon
  const icon = project.oss
    ? (options.ossIcon ?? ICONS.OSS)
    : (options.privateIcon ?? ICONS.PRIVATE);

  // Get repository information
  const repoInfo: null | RepoInfo = getRepoInfoFromProject(project);
  let repoDataEntry: RepoData | undefined;

  if (repoInfo) {
    repoDataEntry = repoData[repoInfo.apiPath];
  }

  // Prepare version text
  let versionText = "";
  if (options.versions !== false) {
    // Priority: use manually specified version if present
    if (typeof project.ver === "string" && project.ver.length > 0) {
      versionText = ` <sub>${ICONS.VERSION} ${project.ver}</sub>`;
    } else if (options.autoVersion && project.oss && repoDataEntry?.version) {
      // Otherwise, use auto-fetched version if available and enabled
      versionText = ` <sub>${ICONS.VERSION} ${repoDataEntry.version}</sub>`;
    }
  }

  // Inject star count if requested and available
  let starsText = "";
  if (options.stars && project.oss && repoDataEntry?.stars !== undefined) {
    starsText = ` <sub>${ICONS.STAR} ${repoDataEntry.stars.toLocaleString()}</sub>`;
  }

  // Inject status indicator if applicable
  const statusText = formatProjectStatus(project, options);

  // Format the final cell
  const name = project.id.trim();
  const description = project.description.trim();

  return `[${icon} ${name}](${project.link})${versionText}${starsText}${statusText}<br />${description}`;
}

/**
 * Sort projects based on specified criteria
 */
function sortProjects(
  projectsToSort: Project[],
  options: GenerateOptions,
  repoData: Record<string, RepoData>
): Project[] {
  if (!options.sortBy) return [...projectsToSort]; // Return copy if no sorting

  const sortDirection = options.sortDirection === "desc" ? -1 : 1;

  return [...projectsToSort].sort((a, b) => {
    // Handle 'soon' projects: They always come last regardless of sort direction
    if (a.soon && !b.soon) return 1;
    if (!a.soon && b.soon) return -1;
    if (a.soon && b.soon) return 0;

    const repoInfoA: null | RepoInfo = getRepoInfoFromProject(a);
    const repoInfoB: null | RepoInfo = getRepoInfoFromProject(b);
    const repoDataA: RepoData | undefined = repoInfoA ? repoData[repoInfoA.apiPath] : undefined;
    const repoDataB: RepoData | undefined = repoInfoB ? repoData[repoInfoB.apiPath] : undefined;

    switch (options.sortBy) {
      case "id":
        return a.id.localeCompare(b.id) * sortDirection;
      case "stars": {
        const starsA = repoDataA?.stars ?? 0; // Default to 0 if undefined
        const starsB = repoDataB?.stars ?? 0;
        // Handle potential equality to avoid inconsistent sorting
        if (starsA === starsB) {
          return a.id.localeCompare(b.id); // Secondary sort by id for stability
        }
        return (starsA - starsB) * sortDirection;
      }
      case "updated": {
        // Default to epoch start if undefined
        const dateA = repoDataA?.lastUpdated ?? new Date(0);
        const dateB = repoDataB?.lastUpdated ?? new Date(0);
        const timeDiff = dateA.getTime() - dateB.getTime();
        // Handle potential equality
        if (timeDiff === 0) {
          return a.id.localeCompare(b.id); // Secondary sort by id
        }
        return timeDiff * sortDirection;
      }
      default:
        return 0;
    }
  });
}
