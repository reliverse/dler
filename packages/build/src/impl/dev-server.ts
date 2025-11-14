// packages/build/src/impl/dev-server.ts

import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { logger } from "@reliverse/dler-logger";
import type { BuildOptions, DevServerOptions, PackageInfo } from "./types";

interface DevServerConfig {
  port: number;
  host: string;
  hmr: boolean;
  publicDir?: string;
}

export class DevServer {
  private server: any = null;
  private config: DevServerConfig;
  private packages: PackageInfo[];
  private options: BuildOptions;
  private watchers: Map<string, any> = new Map();
  private rebuildQueue: Set<string> = new Set();
  private rebuildTimeout: NodeJS.Timeout | null = null;

  constructor(
    packages: PackageInfo[],
    options: BuildOptions,
    devServerOptions?: DevServerOptions,
  ) {
    this.packages = packages;
    this.options = options;
    this.config = {
      port: devServerOptions?.port ?? 3000,
      host: devServerOptions?.host ?? "localhost",
      hmr: devServerOptions?.hmr ?? true,
      publicDir: options.publicAssets ?? "public",
    };
  }

  async start(): Promise<void> {
    if (this.server) {
      logger.warn("Dev server is already running");
      return;
    }

    try {
      this.server = Bun.serve({
        port: this.config.port,
        hostname: this.config.host,
        fetch: async (request) => {
          const url = new URL(request.url);
          const pathname = url.pathname;

          // Add CORS headers for API requests
          const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          };

          // Handle OPTIONS requests for CORS
          if (request.method === "OPTIONS") {
            return new Response(null, {
              status: 200,
              headers: corsHeaders,
            });
          }

          // Handle root path - serve index.html
          if (pathname === "/" || pathname === "/index.html") {
            const response = await this.serveIndexHtml();
            if (response) {
              Object.entries(corsHeaders).forEach(([key, value]) => {
                response.headers.set(key, value);
              });
            }
            return response;
          }

          // Handle static assets
          const assetResponse = await this.serveStaticAsset(pathname);
          if (assetResponse) {
            Object.entries(corsHeaders).forEach(([key, value]) => {
              assetResponse.headers.set(key, value);
            });
            return assetResponse;
          }

          // Handle built files
          const builtResponse = await this.serveBuiltFile(pathname);
          if (builtResponse) {
            Object.entries(corsHeaders).forEach(([key, value]) => {
              builtResponse.headers.set(key, value);
            });
            return builtResponse;
          }

          // 404
          return new Response("Not Found", {
            status: 404,
            headers: corsHeaders,
          });
        },
        websocket: {
          open: (ws) => {
            // Subscribe to HMR channel
            if (this.config.hmr) {
              ws.subscribe("hmr");
            }
          },
          message: (ws, message) => {
            // Handle WebSocket messages for HMR
            if (this.config.hmr) {
              this.handleHMRMessage(ws, message);
            }
          },
        },
      });

      const url = `http://${this.config.host}:${this.config.port}`;
      logger.success(`🚀 Dev server running at ${url}`);

      // Start file watching for HMR
      if (this.config.hmr) {
        await this.startFileWatching();
      }
    } catch (error) {
      logger.error(`Failed to start dev server: ${error}`);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.stop();
      this.server = null;
    }

    // Stop all watchers
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();

    logger.info("Dev server stopped");
  }

  private async serveIndexHtml(): Promise<Response> {
    // Look for index.html in package roots
    for (const pkg of this.packages) {
      if (pkg.hasHtmlEntry) {
        const htmlFiles = pkg.entryPoints.filter((ep) => ep.endsWith(".html"));
        if (htmlFiles.length > 0) {
          const htmlPath = htmlFiles[0];
          if (htmlPath && existsSync(htmlPath)) {
            const content = readFileSync(htmlPath, "utf-8");
            return new Response(content, {
              headers: { "Content-Type": "text/html" },
            });
          }
        }
      }
    }

    // Fallback: generate a basic HTML page
    const html = this.generateFallbackHtml();
    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  }

  private async serveStaticAsset(pathname: string): Promise<Response | null> {
    // Remove leading slash
    const assetPath = pathname.slice(1);

    // Check in public directories
    for (const pkg of this.packages) {
      if (pkg.hasPublicDir) {
        const publicPath = join(pkg.path, "public", assetPath);
        if (existsSync(publicPath)) {
          return this.serveFile(publicPath);
        }
      }
    }

    return null;
  }

  private async serveBuiltFile(pathname: string): Promise<Response | null> {
    // Remove leading slash
    const filePath = pathname.slice(1);

    // Check in output directories
    for (const pkg of this.packages) {
      const builtPath = join(pkg.outputDir, filePath);
      if (existsSync(builtPath)) {
        return this.serveFile(builtPath);
      }
    }

    return null;
  }

  private async serveFile(filePath: string): Promise<Response | null> {
    try {
      if (!existsSync(filePath)) {
        return null;
      }

      const content = readFileSync(filePath);
      const ext = extname(filePath);
      const contentType = this.getContentType(ext);

      return new Response(content, {
        headers: { "Content-Type": contentType },
      });
    } catch (error) {
      logger.error(`Error serving file ${filePath}: ${error}`);
      return null;
    }
  }

  private getContentType(ext: string): string {
    const types: Record<string, string> = {
      ".html": "text/html",
      ".js": "application/javascript",
      ".mjs": "application/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".svg": "image/svg+xml",
      ".webp": "image/webp",
      ".ico": "image/x-icon",
      ".woff": "font/woff",
      ".woff2": "font/woff2",
      ".ttf": "font/ttf",
      ".eot": "application/vnd.ms-fontobject",
    };

    return types[ext] || "application/octet-stream";
  }

  private generateFallbackHtml(): string {
    const title =
      this.packages.length === 1
        ? this.packages[0]?.name || "Frontend App"
        : "Frontend App";

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 2rem;
            background: #f5f5f5;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { color: #333; }
        p { color: #666; line-height: 1.6; }
        .status { 
            background: #e8f5e8; 
            color: #2d5a2d; 
            padding: 1rem; 
            border-radius: 4px; 
            margin: 1rem 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${title}</h1>
        <div class="status">
            ✅ Dev server is running successfully!
        </div>
        <p>This is a fallback page. To customize this page:</p>
        <ul>
            <li>Add an <code>index.html</code> file to your project root</li>
            <li>Or add HTML files to your <code>public/</code> directory</li>
            <li>Or configure entry points in your <code>package.json</code></li>
        </ul>
        <p>Hot Module Replacement (HMR) is enabled for development.</p>
    </div>
    <script>
        // Basic HMR client
        if (typeof WebSocket !== 'undefined') {
            const ws = new WebSocket('ws://${this.config.host}:${this.config.port}');
            ws.onmessage = (event) => {
                if (event.data === 'reload') {
                    window.location.reload();
                }
            };
        }
    </script>
</body>
</html>`;
  }

  private async startFileWatching(): Promise<void> {
    for (const pkg of this.packages) {
      if (pkg.entryPoints.length === 0) continue;

      // Watch source files
      const sourceFiles = pkg.entryPoints.filter((ep) => !ep.endsWith(".html"));
      for (const file of sourceFiles) {
        if (existsSync(file)) {
          await this.watchFile(file, pkg);
        }
      }

      // Watch HTML files
      const htmlFiles = pkg.entryPoints.filter((ep) => ep.endsWith(".html"));
      for (const file of htmlFiles) {
        if (existsSync(file)) {
          await this.watchFile(file, pkg);
        }
      }

      // Watch source directory if it exists
      const srcDir = join(pkg.path, "src");
      if (existsSync(srcDir) && statSync(srcDir).isDirectory()) {
        await this.watchDirectory(srcDir, pkg);
      }
    }

    logger.info("👀 File watching started for HMR");
  }

  private async watchFile(filePath: string, pkg: PackageInfo): Promise<void> {
    if (this.watchers.has(filePath)) return;

    try {
      // Use fs.watch as fallback since Bun.file().watch() doesn't exist
      const { watch } = await import("node:fs");
      const watcher = watch(filePath, (eventType) => {
        if (eventType === "change") {
          this.handleFileChange(filePath, pkg);
        }
      });

      watcher.on("error", (error) => {
        logger.warn(`File watcher error for ${filePath}: ${error.message}`);
        this.watchers.delete(filePath);
      });

      this.watchers.set(filePath, watcher);
    } catch (error) {
      logger.warn(`Failed to watch file ${filePath}: ${error}`);
    }
  }

  private async watchDirectory(
    dirPath: string,
    pkg: PackageInfo,
  ): Promise<void> {
    if (this.watchers.has(dirPath)) return;

    try {
      const { watch } = await import("node:fs");
      const watcher = watch(
        dirPath,
        { recursive: true },
        (eventType, filename) => {
          if (eventType === "change" && filename) {
            const fullPath = join(dirPath, filename);
            this.handleFileChange(fullPath, pkg);
          }
        },
      );

      watcher.on("error", (error) => {
        logger.warn(`Directory watcher error for ${dirPath}: ${error.message}`);
        this.watchers.delete(dirPath);
      });

      this.watchers.set(dirPath, watcher);
    } catch (error) {
      logger.warn(`Failed to watch directory ${dirPath}: ${error}`);
    }
  }

  private handleFileChange(filePath: string, pkg: PackageInfo): void {
    logger.info(`📝 File changed: ${filePath}`);

    // Add package to rebuild queue
    this.rebuildQueue.add(pkg.name);

    // Debounce rebuilds
    if (this.rebuildTimeout) {
      clearTimeout(this.rebuildTimeout);
    }

    this.rebuildTimeout = setTimeout(() => {
      this.processRebuildQueue();
    }, 300);
  }

  private async processRebuildQueue(): Promise<void> {
    if (this.rebuildQueue.size === 0) return;

    const packagesToRebuild = Array.from(this.rebuildQueue)
      .map((name) => this.packages.find((pkg) => pkg.name === name))
      .filter(Boolean) as PackageInfo[];

    this.rebuildQueue.clear();

    logger.info(`🔄 Rebuilding ${packagesToRebuild.length} packages...`);

    for (const pkg of packagesToRebuild) {
      try {
        // Import buildPackage dynamically to avoid circular dependency
        const { buildPackage } = await import("../mod");
        const result = await buildPackage(pkg, this.options);

        if (result.success) {
          logger.success(`✅ ${pkg.name}: Rebuilt successfully`);
          this.notifyClients("reload");
        } else {
          logger.error(`❌ ${pkg.name}: Rebuild failed`);
          for (const error of result.errors) {
            logger.error(`   ${error}`);
          }
          this.notifyClients("error", {
            message: `Build failed: ${result.errors.join(", ")}`,
          });
        }
      } catch (error) {
        logger.error(`❌ ${pkg.name}: Rebuild error - ${error}`);
        this.notifyClients("error", { message: `Build error: ${error}` });
      }
    }
  }

  private handleHMRMessage(ws: any, message: any): void {
    try {
      const data = JSON.parse(message.toString());

      switch (data.type) {
        case "ping":
          ws.send(JSON.stringify({ type: "pong" }));
          break;
        case "reload":
          this.notifyClients("reload");
          break;
      }
    } catch (error) {
      // Ignore invalid messages
    }
  }

  private notifyClients(type: string, data?: any): void {
    if (this.server && this.server.publish) {
      const message = JSON.stringify({ type, data, timestamp: Date.now() });
      this.server.publish("hmr", message);
    }
  }
}

export async function startDevServer(
  packages: PackageInfo[],
  options: BuildOptions,
  devServerOptions?: DevServerOptions,
): Promise<DevServer> {
  const server = new DevServer(packages, options, devServerOptions);
  await server.start();
  return server;
}
