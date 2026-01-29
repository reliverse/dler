/**
 * GitHub Repository File Counter (programmatic module)
 *
 * Example:
 *   const result = await analyzeRepository("owner/repo", { format: "text", stats: true }, token);
 *   const output = formatOutput(result, "text");
 */

interface GitHubRepo {
  default_branch: string;
  full_name: string;
  size: number;
  language: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

interface GitHubTreeItem {
  path: string;
  type: 'blob' | 'tree';
  size?: number;
  url?: string;
}

interface GitHubTreeResponse {
  tree: GitHubTreeItem[];
  truncated: boolean;
}

interface FileStats {
  totalFiles: number;
  totalSize: number;
  averageSize: number;
  largestFile: { path: string; size: number };
  smallestFile: { path: string; size: number };
  extensions: Record<string, { count: number; totalSize: number }>;
  directories: Record<string, number>;
}

interface LanguageStats {
  [language: string]: {
    files: number;
    size: number;
    percentage: number;
  };
}

interface AnalysisResult {
  repository: {
    owner: string;
    name: string;
    fullName: string;
    branch: string;
    description?: string;
    language: string;
    size: number;
  };
  files: {
    total: number;
    filtered: number;
    included: string[];
    excluded: string[];
  };
  statistics?: FileStats;
  languages?: LanguageStats;
  analysisTime: number;
  apiCalls: number;
  truncated: boolean;
}

export interface CLIOptions {
  branch?: string;
  exclude?: string[];
  include?: string[];
  format: 'text' | 'json' | 'csv';
  stats: boolean;
  languages: boolean;
  output?: string;
  quiet: boolean;
  verbose: boolean;
}

const BASE_URL = 'https://api.github.com';

// Language detection based on file extensions
const LANGUAGE_EXTENSIONS: Record<string, string> = {
  // Programming Languages
  'rs': 'Rust',
  'ts': 'TypeScript',
  'tsx': 'TypeScript',
  'js': 'JavaScript',
  'jsx': 'JavaScript',
  'py': 'Python',
  'java': 'Java',
  'cpp': 'C++',
  'c': 'C',
  'cs': 'C#',
  'php': 'PHP',
  'rb': 'Ruby',
  'go': 'Go',
  'swift': 'Swift',
  'kt': 'Kotlin',
  'scala': 'Scala',
  'clj': 'Clojure',
  'hs': 'Haskell',
  'ml': 'OCaml',
  'fs': 'F#',
  'elm': 'Elm',
  'dart': 'Dart',
  'lua': 'Lua',
  'r': 'R',
  'jl': 'Julia',
  'pl': 'Perl',
  'tcl': 'Tcl',

  // Web Technologies
  'html': 'HTML',
  'css': 'CSS',
  'scss': 'SCSS',
  'sass': 'Sass',
  'less': 'Less',
  'vue': 'Vue',
  'svelte': 'Svelte',
  'astro': 'Astro',

  // Config/Data Formats
  'json': 'JSON',
  'xml': 'XML',
  'yaml': 'YAML',
  'yml': 'YAML',
  'toml': 'TOML',
  'ini': 'INI',

  // Documentation
  'md': 'Markdown',
  'txt': 'Text',
  'rst': 'reStructuredText',
  'adoc': 'AsciiDoc',

  // Shell/Scripts
  'sh': 'Shell',
  'bash': 'Bash',
  'zsh': 'Zsh',
  'fish': 'Fish',
  'ps1': 'PowerShell',
  'bat': 'Batch',
  'cmd': 'Command',

  // Other
  'dockerfile': 'Dockerfile',
  'makefile': 'Makefile'
};

function parsePatterns(patterns: string[]): RegExp[] {
  return patterns.map(pattern => {
    // Convert glob patterns to regex
    // First escape existing dots, then replace wildcards
    const escaped = pattern.replace(/\./g, '\\.');
    const withWildcards = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
    const finalRegex = `^${withWildcards}$`;
    return new RegExp(finalRegex, 'i');
  });
}

function matchesPattern(path: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(path));
}

function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function getLanguageFromExtension(extension: string): string {
  return LANGUAGE_EXTENSIONS[extension] || 'Other';
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'GitHub-File-Counter/1.0'
  };

  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  return headers;
}

async function makeRequest<T>(
  url: string,
  token?: string,
  retries: number = 3,
  delay: number = 1000,
  quiet: boolean = false
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Create AbortController for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(url, {
        headers: getHeaders(token),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Repository not found. Please check the URL and ensure the repository is public.');
        }
        if (response.status === 403) {
          const resetTime = response.headers.get('X-RateLimit-Reset');
          const resetDate = resetTime ? new Date(parseInt(resetTime) * 1000).toLocaleString() : 'unknown';
          throw new Error(`API rate limit exceeded. Resets at ${resetDate}. Consider setting GITHUB_TOKEN environment variable.`);
        }
        if (response.status === 422) {
          throw new Error('Repository is empty or the requested branch/tree does not exist.');
        }
        if (response.status >= 500) {
          // Retry on server errors
          if (attempt < retries) {
            await new Promise(resolve => setTimeout(resolve, delay * attempt));
            continue;
          }
        }
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      return response.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      if (attempt < retries && (
        lastError.message.includes('rate limit') ||
        lastError.message.includes('timeout') ||
        lastError.message.includes('network') ||
        lastError.message.includes('abort') ||
        lastError.message.includes('AbortError') ||
        lastError.message.includes('500') ||
        lastError.message.includes('502') ||
        lastError.message.includes('503') ||
        lastError.message.includes('504')
      )) {
        if (!quiet) {
          console.log(`⚠️  Attempt ${attempt} failed, retrying in ${delay * attempt}ms...`);
        }
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
        continue;
      }

      throw lastError;
    }
  }

  throw lastError!;
}

function parseGitHubUrl(url: string): { owner: string; repo: string } {
  // Handle various GitHub URL formats
  const patterns = [
    /github\.com\/([^\/]+)\/([^\/]+?)(?:\.git)?(?:\/.*)?$/,
    /^([^\/]+)\/([^\/]+)$/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, '')
      };
    }
  }

  throw new Error('Invalid GitHub URL format. Expected: https://github.com/owner/repo or owner/repo');
}

async function analyzeRepository(repoUrl: string, cliOptions: CLIOptions, token?: string): Promise<AnalysisResult> {
  const startTime = Date.now();
  let apiCalls = 0;

  if (!cliOptions.quiet) {
    console.log(`🔍 Analyzing repository: ${repoUrl}`);
  }

  const { owner, repo } = parseGitHubUrl(repoUrl);
  if (!cliOptions.quiet) {
    console.log(`📦 Repository: ${owner}/${repo}`);
  }

  // Get repository info
  const repoInfo: GitHubRepo = await makeRequest(
    `${BASE_URL}/repos/${owner}/${repo}`,
    token,
    3,
    1000,
    cliOptions.quiet
  );
  apiCalls++;

  const branch = cliOptions.branch || repoInfo.default_branch;
  if (!cliOptions.quiet) {
    console.log(`🌿 Branch: ${branch}`);
    if (cliOptions.verbose) {
      console.log(`📝 Description: ${repoInfo.description || 'No description'}`);
      console.log(`💾 Size: ${formatFileSize(repoInfo.size * 1024)}`);
    }
  }

  // Get the tree for the specified branch recursively
  if (cliOptions.verbose) {
    console.log(`📊 Fetching repository tree...`);
  }

  const treeResponse: GitHubTreeResponse = await makeRequest(
    `${BASE_URL}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
    token,
    3,
    1000,
    cliOptions.quiet
  );
  apiCalls++;

  if (treeResponse.truncated && !cliOptions.quiet) {
    console.warn('⚠️  Warning: Repository tree was truncated. Analysis may be incomplete.');
  }

  // Filter and analyze files
  const allFiles = treeResponse.tree.filter(item => item.type === 'blob');
  let filteredFiles = allFiles;

  // Apply include/exclude filters
  if (cliOptions.include && cliOptions.include.length > 0) {
    const includePatterns = parsePatterns(cliOptions.include);
    filteredFiles = filteredFiles.filter(file => matchesPattern(file.path, includePatterns));
  }

  if (cliOptions.exclude && cliOptions.exclude.length > 0) {
    const excludePatterns = parsePatterns(cliOptions.exclude);
    filteredFiles = filteredFiles.filter(file => !matchesPattern(file.path, excludePatterns));
  }

  // Calculate statistics if requested
  let statistics: FileStats | undefined;
  if (cliOptions.stats) {
    statistics = calculateFileStats(filteredFiles);
  }

  // Calculate language breakdown if requested
  let languages: LanguageStats | undefined;
  if (cliOptions.languages) {
    languages = calculateLanguageStats(filteredFiles);
  }

  const analysisTime = Date.now() - startTime;

  return {
    repository: {
      owner,
      name: repo,
      fullName: repoInfo.full_name,
      branch,
      description: repoInfo.description,
      language: repoInfo.language,
      size: repoInfo.size
    },
    files: {
      total: allFiles.length,
      filtered: filteredFiles.length,
      included: cliOptions.include || [],
      excluded: cliOptions.exclude || []
    },
    statistics,
    languages,
    analysisTime,
    apiCalls,
    truncated: treeResponse.truncated
  };
}

function calculateFileStats(files: GitHubTreeItem[]): FileStats {
  if (files.length === 0) {
    return {
      totalFiles: 0,
      totalSize: 0,
      averageSize: 0,
      largestFile: { path: '', size: 0 },
      smallestFile: { path: '', size: 0 },
      extensions: {},
      directories: {}
    };
  }

  let totalSize = 0;
  let largestFile = { path: '', size: 0 };
  let smallestFile = { path: '', size: Infinity };
  const extensions: Record<string, { count: number; totalSize: number }> = {};
  const directories: Record<string, number> = {};

  for (const file of files) {
    const size = file.size || 0;
    totalSize += size;

    // Track largest/smallest files
    if (size > largestFile.size) {
      largestFile = { path: file.path, size };
    }
    if (size < smallestFile.size) {
      smallestFile = { path: file.path, size };
    }

    // Track extensions
    const ext = getFileExtension(file.path);
    if (!extensions[ext]) {
      extensions[ext] = { count: 0, totalSize: 0 };
    }
    extensions[ext].count++;
    extensions[ext].totalSize += size;

    // Track directories
    const dir = file.path.split('/').slice(0, -1).join('/') || '.';
    directories[dir] = (directories[dir] || 0) + 1;
  }

  if (smallestFile.size === Infinity) {
    smallestFile = { path: '', size: 0 };
  }

  return {
    totalFiles: files.length,
    totalSize,
    averageSize: totalSize / files.length,
    largestFile,
    smallestFile,
    extensions,
    directories
  };
}

function calculateLanguageStats(files: GitHubTreeItem[]): LanguageStats {
  const languages: Record<string, { files: number; size: number }> = {};

  for (const file of files) {
    const ext = getFileExtension(file.path);
    const language = getLanguageFromExtension(ext);
    const size = file.size || 0;

    if (!languages[language]) {
      languages[language] = { files: 0, size: 0 };
    }
    languages[language].files++;
    languages[language].size += size;
  }

  const totalSize = Object.values(languages).reduce((sum, lang) => sum + lang.size, 0);

  const result: LanguageStats = {};
  for (const [language, stats] of Object.entries(languages)) {
    result[language] = {
      ...stats,
      percentage: totalSize > 0 ? (stats.size / totalSize) * 100 : 0
    };
  }

  return result;
}

function formatOutput(result: AnalysisResult, format: 'text' | 'json' | 'csv'): string {
  switch (format) {
    case 'json':
      return JSON.stringify(result, null, 2);

    case 'csv':
      return formatAsCSV(result);

    default:
      return formatAsText(result);
  }
}

function formatAsText(result: AnalysisResult): string {
  let output = '';

  // Repository info
  output += `📦 ${result.repository.fullName}\n`;
  output += `🌿 Branch: ${result.repository.branch}\n`;
  if (result.repository.description) {
    output += `📝 ${result.repository.description}\n`;
  }
  output += `🏷️  Primary Language: ${result.repository.language}\n`;
  output += `💾 Repository Size: ${formatFileSize(result.repository.size * 1024)}\n\n`;

  // File counts
  output += `📊 File Analysis:\n`;
  output += `   Total files: ${result.files.total.toLocaleString()}\n`;
  if (result.files.included.length > 0) {
    output += `   Included patterns: ${result.files.included.join(', ')}\n`;
  }
  if (result.files.excluded.length > 0) {
    output += `   Excluded patterns: ${result.files.excluded.join(', ')}\n`;
  }
  output += `   Filtered files: ${result.files.filtered.toLocaleString()}\n\n`;

  // Statistics
  if (result.statistics) {
    const stats = result.statistics;
    output += `📈 File Statistics:\n`;
    output += `   Total size: ${formatFileSize(stats.totalSize)}\n`;
    output += `   Average file size: ${formatFileSize(stats.averageSize)}\n`;
    output += `   Largest file: ${stats.largestFile.path} (${formatFileSize(stats.largestFile.size)})\n`;
    output += `   Smallest file: ${stats.smallestFile.path} (${formatFileSize(stats.smallestFile.size)})\n\n`;

    output += `📁 Top Directories:\n`;
    const topDirs = Object.entries(stats.directories)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
    for (const [dir, count] of topDirs) {
      output += `   ${dir}: ${count} files\n`;
    }
    output += '\n';

    output += `🔧 File Extensions:\n`;
    const topExts = Object.entries(stats.extensions)
      .sort(([,a], [,b]) => b.count - a.count)
      .slice(0, 15);
    for (const [ext, data] of topExts) {
      output += `   .${ext}: ${data.count} files (${formatFileSize(data.totalSize)})\n`;
    }
    output += '\n';
  }

  // Languages
  if (result.languages) {
    output += `💻 Programming Languages:\n`;
    const sortedLangs = Object.entries(result.languages)
      .sort(([,a], [,b]) => b.size - a.size);

    for (const [language, stats] of sortedLangs) {
      output += `   ${language}: ${stats.files} files (${formatFileSize(stats.size)}) - ${stats.percentage.toFixed(1)}%\n`;
    }
    output += '\n';
  }

  // Performance info
  output += `⚡ Performance:\n`;
  output += `   Analysis time: ${(result.analysisTime / 1000).toFixed(2)}s\n`;
  output += `   API calls: ${result.apiCalls}\n`;
  if (result.truncated) {
    output += `   ⚠️  Warning: Repository tree was truncated\n`;
  }

  return output;
}

function formatAsCSV(result: AnalysisResult): string {
  let csv = 'Metric,Value\n';

  // Basic info
  csv += `Repository,${result.repository.fullName}\n`;
  csv += `Branch,${result.repository.branch}\n`;
  csv += `Primary Language,${result.repository.language}\n`;
  csv += `Repository Size (KB),${result.repository.size}\n`;
  csv += `Total Files,${result.files.total}\n`;
  csv += `Filtered Files,${result.files.filtered}\n`;
  csv += `Analysis Time (ms),${result.analysisTime}\n`;
  csv += `API Calls,${result.apiCalls}\n`;
  csv += `Truncated,${result.truncated}\n`;

  // File statistics
  if (result.statistics) {
    const stats = result.statistics;
    csv += `Total Size (bytes),${stats.totalSize}\n`;
    csv += `Average Size (bytes),${stats.averageSize}\n`;
    csv += `Largest File,${stats.largestFile.path}\n`;
    csv += `Largest File Size,${stats.largestFile.size}\n`;
    csv += `Smallest File,${stats.smallestFile.path}\n`;
    csv += `Smallest File Size,${stats.smallestFile.size}\n`;

    // Extensions
    csv += '\nExtension,Count,Total Size\n';
    for (const [ext, data] of Object.entries(stats.extensions)) {
      csv += `${ext},${data.count},${data.totalSize}\n`;
    }

    // Directories
    csv += '\nDirectory,File Count\n';
    for (const [dir, count] of Object.entries(stats.directories)) {
      csv += `${dir},${count}\n`;
    }
  }

  // Languages
  if (result.languages) {
    csv += '\nLanguage,Files,Size (bytes),Percentage\n';
    for (const [language, stats] of Object.entries(result.languages)) {
      csv += `${language},${stats.files},${stats.size},${stats.percentage.toFixed(2)}\n`;
    }
  }

  return csv;
}

export {
  analyzeRepository,
  parseGitHubUrl,
  getHeaders,
  makeRequest,
  parsePatterns,
  matchesPattern,
  formatFileSize,
  calculateFileStats,
  calculateLanguageStats,
  formatOutput
};
