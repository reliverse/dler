// apps/dler/src/cmds/perf/utils/formatter.ts

export const formatDuration = (ms: number): string => {
  if (ms < 1000) {
    return `${ms.toFixed(2)}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(2);
  return `${minutes}m ${seconds}s`;
};

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const formatPercentage = (value: number, total: number): string => {
  if (total === 0) return "0.00%";
  return `${((value / total) * 100).toFixed(2)}%`;
};

export const formatNumber = (num: number): string => {
  if (num < 1000) return num.toString();
  if (num < 1000000) return `${(num / 1000).toFixed(1)}K`;
  if (num < 1000000000) return `${(num / 1000000).toFixed(1)}M`;
  return `${(num / 1000000000).toFixed(1)}B`;
};

export const formatMemory = (bytes: number): string => {
  return formatBytes(bytes);
};

export const formatImprovement = (improvement: number): string => {
  const sign = improvement > 0 ? "+" : "";
  return `${sign}${improvement.toFixed(2)}%`;
};

export const formatRegression = (regression: number): string => {
  return `+${regression.toFixed(2)}%`;
};

export const formatConfidenceInterval = (
  lower: number,
  upper: number,
  formatter = formatDuration,
): string => {
  return `${formatter(lower)} - ${formatter(upper)}`;
};

export const formatProgress = (current: number, total: number): string => {
  const percentage = total === 0 ? 0 : (current / total) * 100;
  const barLength = 20;
  const filled = Math.floor((percentage / 100) * barLength);
  const bar = "█".repeat(filled) + "░".repeat(barLength - filled);
  return `[${bar}] ${percentage.toFixed(1)}% (${current}/${total})`;
};

export const formatTable = (headers: string[], rows: string[][]): string => {
  if (rows.length === 0) return "";

  // Calculate column widths
  const widths = headers.map((header, i) => {
    const maxRowWidth = Math.max(...rows.map((row) => row[i]?.length ?? 0));
    return Math.max(header.length, maxRowWidth);
  });

  // Create separator
  const separator = "─".repeat(widths.reduce((sum, w) => sum + w + 3, 0) - 1);

  // Format header
  const headerRow = headers
    .map((header, i) => header.padEnd(widths[i]!))
    .join(" │ ");

  // Format rows
  const dataRows = rows.map((row) =>
    row.map((cell, i) => (cell ?? "").padEnd(widths[i]!)).join(" │ "),
  );

  return [headerRow, separator, ...dataRows].join("\n");
};

export const formatDurationBar = (
  value: number,
  max: number,
  width = 20,
): string => {
  const percentage = max === 0 ? 0 : (value / max) * 100;
  const filled = Math.floor((percentage / 100) * width);
  const bar = "█".repeat(filled) + "░".repeat(width - filled);
  return `${bar} ${formatDuration(value)}`;
};

export const formatSizeBar = (
  value: number,
  max: number,
  width = 20,
): string => {
  const percentage = max === 0 ? 0 : (value / max) * 100;
  const filled = Math.floor((percentage / 100) * width);
  const bar = "█".repeat(filled) + "░".repeat(width - filled);
  return `${bar} ${formatBytes(value)}`;
};

export const formatRelativeChange = (
  baseline: number,
  current: number,
): string => {
  if (baseline === 0) return "N/A";

  const change = ((current - baseline) / baseline) * 100;
  const sign = change > 0 ? "+" : "";
  const color = change > 0 ? "🔴" : change < 0 ? "🟢" : "⚪";

  return `${color} ${sign}${change.toFixed(2)}%`;
};

export const truncatePath = (path: string, maxLength = 50): string => {
  if (path.length <= maxLength) return path;

  const start = path.substring(0, Math.floor(maxLength / 2) - 2);
  const end = path.substring(path.length - Math.floor(maxLength / 2) + 2);

  return `${start}...${end}`;
};

export const formatFileType = (extension: string): string => {
  const typeMap: Record<string, string> = {
    ".js": "JavaScript",
    ".ts": "TypeScript",
    ".jsx": "React JSX",
    ".tsx": "React TSX",
    ".json": "JSON",
    ".css": "CSS",
    ".scss": "SCSS",
    ".sass": "Sass",
    ".less": "Less",
    ".html": "HTML",
    ".svg": "SVG",
    ".png": "PNG",
    ".jpg": "JPEG",
    ".jpeg": "JPEG",
    ".gif": "GIF",
    ".webp": "WebP",
    ".woff": "WOFF",
    ".woff2": "WOFF2",
    ".ttf": "TrueType",
    ".eot": "EOT",
    ".map": "Source Map",
    ".d.ts": "TypeScript Declarations",
  };

  return typeMap[extension] ?? extension.toUpperCase();
};

export const formatSeverity = (severity: "low" | "medium" | "high"): string => {
  const icons = {
    low: "🟡",
    medium: "🟠",
    high: "🔴",
  };

  return `${icons[severity]} ${severity.toUpperCase()}`;
};

export const formatBottleneckType = (
  type: "slow-build" | "many-dependencies" | "circular-dependency",
): string => {
  const icons = {
    "slow-build": "⏱️",
    "many-dependencies": "🔗",
    "circular-dependency": "🔄",
  };

  const labels = {
    "slow-build": "Slow Build",
    "many-dependencies": "Many Dependencies",
    "circular-dependency": "Circular Dependency",
  };

  return `${icons[type]} ${labels[type]}`;
};
