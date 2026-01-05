import * as http from "http";
import { URL } from "url";
import type { RoonConnection } from "./roon.js";

/**
 * HTTP server for serving album art images
 */
export class HttpServer {
  private server: http.Server | null = null;
  private roon: RoonConnection;
  private port: number;

  constructor(roon: RoonConnection, port: number) {
    this.roon = roon;
    this.port = port;
  }

  /**
   * Get the base URL for album art
   */
  getBaseUrl(): string {
    return `http://localhost:${this.port}`;
  }

  /**
   * Build album art URL for an image key
   */
  getAlbumArtUrl(imageKey: string, size?: number): string {
    const url = new URL(`/album-art/${encodeURIComponent(imageKey)}`, this.getBaseUrl());
    if (size) {
      url.searchParams.set("size", size.toString());
    }
    return url.toString();
  }

  /**
   * Start the HTTP server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on("error", (err) => {
        console.error("HTTP server error:", err);
        reject(err);
      });

      this.server.listen(this.port, () => {
        console.log(`HTTP server listening on port ${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the HTTP server
   */
  async stop(): Promise<void> {
    if (!this.server) return;

    return new Promise((resolve) => {
      this.server!.close(() => {
        console.log("HTTP server stopped");
        resolve();
      });
    });
  }

  /**
   * Handle incoming HTTP request
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== "GET") {
      res.writeHead(405, { "Content-Type": "text/plain" });
      res.end("Method not allowed");
      return;
    }

    const url = new URL(req.url || "/", `http://localhost:${this.port}`);
    const pathname = url.pathname;

    // Route: /album-art/:imageKey
    const albumArtMatch = pathname.match(/^\/album-art\/(.+)$/);
    if (albumArtMatch) {
      const imageKey = decodeURIComponent(albumArtMatch[1]);
      await this.handleAlbumArt(req, res, imageKey, url.searchParams);
      return;
    }

    // 404 for unknown routes
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }

  /**
   * Handle album art request
   */
  private async handleAlbumArt(
    _req: http.IncomingMessage,
    res: http.ServerResponse,
    imageKey: string,
    params: URLSearchParams
  ): Promise<void> {
    if (!this.roon.getState().isReady()) {
      res.writeHead(503, { "Content-Type": "text/plain" });
      res.end("Not connected to Roon Core");
      return;
    }

    try {
      const size = parseInt(params.get("size") || "300", 10);
      const format = params.get("format") === "png" ? "image/png" : "image/jpeg";
      const scale = (params.get("scale") as "fit" | "fill" | "stretch") || "fit";

      const result = await this.roon.getAlbumArt(imageKey, {
        scale,
        width: size,
        height: size,
        format,
      });

      const imageBuffer = Buffer.from(result.data, "base64");

      res.writeHead(200, {
        "Content-Type": result.contentType,
        "Content-Length": imageBuffer.length,
        "Cache-Control": "public, max-age=86400", // Cache for 24 hours
      });
      res.end(imageBuffer);
    } catch (err) {
      console.error("Album art error:", err);
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Image not found");
    }
  }
}
