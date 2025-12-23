import * as net from "net";
import * as fs from "fs";
import type { IPCRequest, IPCResponse, Methods } from "../shared/protocol.js";
import { ErrorCodes } from "../shared/protocol.js";
import type { RoonConnection } from "./roon.js";
import type { LoopMode, BrowseItem, BrowseResult } from "../shared/types.js";

/**
 * IPCServer listens on a Unix socket and handles JSON-RPC style requests
 * from CLI clients, routing them to Roon API methods.
 */
export class IPCServer {
  private server: net.Server | null = null;
  private socketPath: string;
  private roon: RoonConnection;
  private clients: Set<net.Socket> = new Set();
  private lastBrowseItems: BrowseItem[] = [];
  private lastBrowseHierarchy: string = "browse";

  constructor(roon: RoonConnection, socketPath: string) {
    this.roon = roon;
    this.socketPath = socketPath;
  }

  /**
   * Start the IPC server
   */
  async start(): Promise<void> {
    // Remove existing socket file if it exists
    try {
      if (fs.existsSync(this.socketPath)) {
        fs.unlinkSync(this.socketPath);
      }
    } catch (err) {
      console.error(`Failed to remove existing socket: ${err}`);
    }

    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.handleConnection(socket);
      });

      this.server.on("error", (err) => {
        console.error("Server error:", err);
        reject(err);
      });

      this.server.listen(this.socketPath, () => {
        console.log(`IPC server listening on ${this.socketPath}`);
        resolve();
      });
    });
  }

  /**
   * Stop the IPC server
   */
  async stop(): Promise<void> {
    if (!this.server) return;

    // Close all client connections
    for (const client of this.clients) {
      client.destroy();
    }
    this.clients.clear();

    return new Promise((resolve) => {
      this.server!.close(() => {
        console.log("IPC server stopped");
        // Remove socket file
        try {
          if (fs.existsSync(this.socketPath)) {
            fs.unlinkSync(this.socketPath);
          }
        } catch (err) {
          console.error(`Failed to remove socket file: ${err}`);
        }
        resolve();
      });
    });
  }

  /**
   * Handle a new client connection
   */
  private handleConnection(socket: net.Socket): void {
    this.clients.add(socket);
    console.log("Client connected");

    let buffer = "";

    socket.on("data", (data) => {
      buffer += data.toString();

      // Process complete messages (one per line)
      let lineEnd: number;
      while ((lineEnd = buffer.indexOf("\n")) !== -1) {
        const line = buffer.substring(0, lineEnd).trim();
        buffer = buffer.substring(lineEnd + 1);

        if (line) {
          this.handleRequest(socket, line);
        }
      }
    });

    socket.on("end", () => {
      this.clients.delete(socket);
      console.log("Client disconnected");
    });

    socket.on("error", (err) => {
      console.error("Socket error:", err);
      this.clients.delete(socket);
    });
  }

  /**
   * Handle a single request
   */
  private async handleRequest(socket: net.Socket, message: string): Promise<void> {
    let request: IPCRequest;
    try {
      request = JSON.parse(message);
    } catch (err) {
      this.sendError(socket, "invalid", ErrorCodes.INVALID_PARAMS, "Invalid JSON");
      return;
    }

    if (!request.id || !request.method) {
      this.sendError(socket, request.id || "unknown", ErrorCodes.INVALID_PARAMS, "Missing id or method");
      return;
    }

    try {
      const result = await this.handleMethod(request.method, request.params || {});
      this.sendResponse(socket, request.id, result);
    } catch (err: any) {
      const errorCode = err.code || ErrorCodes.UNKNOWN;
      const errorMessage = err.message || "Unknown error";
      this.sendError(socket, request.id, errorCode, errorMessage);
    }
  }

  /**
   * Route method to appropriate handler
   */
  private async handleMethod(method: string, params: Record<string, unknown>): Promise<unknown> {
    const state = this.roon.getState();

    switch (method) {
      // Status
      case "status":
        return state.getState();

      // Transport controls
      case "play":
        return this.handleTransportControl("play", params);
      case "pause":
        return this.handleTransportControl("pause", params);
      case "playpause":
        return this.handleTransportControl("playpause", params);
      case "stop":
        return this.handleTransportControl("stop", params);
      case "next":
        return this.handleTransportControl("next", params);
      case "previous":
        return this.handleTransportControl("previous", params);

      case "seek":
        return this.handleSeek(params);

      // Volume
      case "volume":
        return this.handleVolume(params);
      case "mute":
        return this.handleMute(params, true);
      case "unmute":
        return this.handleMute(params, false);

      // Zones
      case "zones":
        return state.getZones();
      case "zone":
        return this.handleGetZone(params);
      case "outputs":
        return state.getOutputs();

      // Settings
      case "shuffle":
        return this.handleShuffle(params);
      case "loop":
        return this.handleLoop(params);
      case "radio":
        return this.handleRadio(params);

      // Browse
      case "browse":
        return this.handleBrowse(params);
      case "search":
        return this.handleSearch(params);
      case "select":
        return this.handleSelect(params);
      case "back":
        return this.handleBack(params);

      // Queue
      case "queue":
        return this.handleQueue(params);

      default:
        throw { code: ErrorCodes.INVALID_PARAMS, message: `Unknown method: ${method}` };
    }
  }

  /**
   * Handle transport control
   */
  private async handleTransportControl(action: "play" | "pause" | "playpause" | "stop" | "previous" | "next", params: Record<string, unknown>): Promise<{ success: boolean }> {
    if (!this.roon.getState().isReady()) {
      throw { code: ErrorCodes.NOT_CONNECTED, message: "Not connected to Roon Core" };
    }

    const zone = params.zone as string | undefined;
    await this.roon.control(zone, action);
    return { success: true };
  }

  /**
   * Handle seek
   */
  private async handleSeek(params: Record<string, unknown>): Promise<{ success: boolean }> {
    if (!this.roon.getState().isReady()) {
      throw { code: ErrorCodes.NOT_CONNECTED, message: "Not connected to Roon Core" };
    }

    const zone = params.zone as string | undefined;
    const seconds = params.seconds as number;
    const relative = (params.relative as boolean) || false;

    if (typeof seconds !== "number") {
      throw { code: ErrorCodes.INVALID_PARAMS, message: "seconds parameter required" };
    }

    await this.roon.seek(zone, seconds, relative);
    return { success: true };
  }

  /**
   * Handle volume
   */
  private async handleVolume(params: Record<string, unknown>): Promise<{ success: boolean }> {
    if (!this.roon.getState().isReady()) {
      throw { code: ErrorCodes.NOT_CONNECTED, message: "Not connected to Roon Core" };
    }

    const output = params.output as string | undefined;
    const value = params.value as number;
    const relative = (params.relative as boolean) || false;

    if (typeof value !== "number") {
      throw { code: ErrorCodes.INVALID_PARAMS, message: "value parameter required" };
    }

    await this.roon.changeVolume(output, value, relative);
    return { success: true };
  }

  /**
   * Handle mute/unmute
   */
  private async handleMute(params: Record<string, unknown>, mute: boolean): Promise<{ success: boolean }> {
    if (!this.roon.getState().isReady()) {
      throw { code: ErrorCodes.NOT_CONNECTED, message: "Not connected to Roon Core" };
    }

    const output = params.output as string | undefined;
    await this.roon.mute(output, mute);
    return { success: true };
  }

  /**
   * Get a specific zone
   */
  private handleGetZone(params: Record<string, unknown>): any {
    const state = this.roon.getState();
    const zone = params.zone as string | undefined;

    if (zone) {
      return state.getZone(zone) || null;
    } else {
      return state.getFirstZone() || null;
    }
  }

  /**
   * Handle shuffle toggle/set
   */
  private async handleShuffle(params: Record<string, unknown>): Promise<{ success: boolean; enabled: boolean }> {
    if (!this.roon.getState().isReady()) {
      throw { code: ErrorCodes.NOT_CONNECTED, message: "Not connected to Roon Core" };
    }

    const zoneIdOrName = params.zone as string | undefined;
    const zone = zoneIdOrName ? this.roon.getState().getZone(zoneIdOrName) : this.roon.getState().getFirstZone();

    if (!zone) {
      throw { code: ErrorCodes.ZONE_NOT_FOUND, message: "Zone not found" };
    }

    let enabled: boolean;
    if (params.enabled !== undefined) {
      enabled = params.enabled as boolean;
    } else {
      // Toggle
      enabled = !zone.settings.shuffle;
    }

    await this.roon.changeSettings(zoneIdOrName, { shuffle: enabled });
    return { success: true, enabled };
  }

  /**
   * Handle loop mode toggle/set
   */
  private async handleLoop(params: Record<string, unknown>): Promise<{ success: boolean; mode: string }> {
    if (!this.roon.getState().isReady()) {
      throw { code: ErrorCodes.NOT_CONNECTED, message: "Not connected to Roon Core" };
    }

    const zoneIdOrName = params.zone as string | undefined;
    const zone = zoneIdOrName ? this.roon.getState().getZone(zoneIdOrName) : this.roon.getState().getFirstZone();

    if (!zone) {
      throw { code: ErrorCodes.ZONE_NOT_FOUND, message: "Zone not found" };
    }

    let mode: LoopMode;
    const modeParam = params.mode as string | undefined;

    if (modeParam === "next") {
      // Cycle through modes
      if (zone.settings.loop === "disabled") {
        mode = "loop";
      } else if (zone.settings.loop === "loop") {
        mode = "loop_one";
      } else {
        mode = "disabled";
      }
    } else if (modeParam === "loop" || modeParam === "loop_one" || modeParam === "disabled") {
      mode = modeParam;
    } else if (modeParam !== undefined) {
      throw { code: ErrorCodes.INVALID_PARAMS, message: "Invalid loop mode" };
    } else {
      // Toggle between loop and disabled
      mode = zone.settings.loop === "disabled" ? "loop" : "disabled";
    }

    await this.roon.changeSettings(zoneIdOrName, { loop: mode });
    return { success: true, mode };
  }

  /**
   * Handle radio toggle/set
   */
  private async handleRadio(params: Record<string, unknown>): Promise<{ success: boolean; enabled: boolean }> {
    if (!this.roon.getState().isReady()) {
      throw { code: ErrorCodes.NOT_CONNECTED, message: "Not connected to Roon Core" };
    }

    const zoneIdOrName = params.zone as string | undefined;
    const zone = zoneIdOrName ? this.roon.getState().getZone(zoneIdOrName) : this.roon.getState().getFirstZone();

    if (!zone) {
      throw { code: ErrorCodes.ZONE_NOT_FOUND, message: "Zone not found" };
    }

    let enabled: boolean;
    if (params.enabled !== undefined) {
      enabled = params.enabled as boolean;
    } else {
      // Toggle
      enabled = !zone.settings.autoRadio;
    }

    await this.roon.changeSettings(zoneIdOrName, { autoRadio: enabled });
    return { success: true, enabled };
  }

  /**
   * Handle browse
   */
  private async handleBrowse(params: Record<string, unknown>): Promise<BrowseResult> {
    if (!this.roon.getState().isReady()) {
      throw { code: ErrorCodes.NOT_CONNECTED, message: "Not connected to Roon Core" };
    }

    const hierarchy = params.hierarchy as string || "browse";

    try {
      const result = await this.roon.browseBrowse({
        hierarchy,
        itemKey: params.itemKey as string | undefined,
        input: params.input as string | undefined,
        zoneIdOrName: params.zone as string | undefined,
        popAll: params.popAll as boolean | undefined,
        popLevels: params.popLevels as number | undefined,
        refresh: params.refresh as boolean | undefined,
        offset: params.offset as number | undefined,
        count: params.count as number | undefined,
      });

      // Store results for select command
      if (result.items && result.items.length > 0) {
        this.lastBrowseItems = result.items;
        this.lastBrowseHierarchy = hierarchy;
      }

      return result;
    } catch (err: any) {
      throw { code: ErrorCodes.BROWSE_ERROR, message: err.message };
    }
  }

  /**
   * Handle search
   */
  private async handleSearch(params: Record<string, unknown>): Promise<BrowseResult> {
    if (!this.roon.getState().isReady()) {
      throw { code: ErrorCodes.NOT_CONNECTED, message: "Not connected to Roon Core" };
    }

    const query = params.query as string;
    if (!query) {
      throw { code: ErrorCodes.INVALID_PARAMS, message: "query parameter required" };
    }

    try {
      const result = await this.roon.browseBrowse({
        hierarchy: "search",
        input: query,
        popAll: true,  // Reset browse session before new search
        zoneIdOrName: params.zone as string | undefined,
      });

      // Store results for select command
      if (result.items && result.items.length > 0) {
        this.lastBrowseItems = result.items;
        this.lastBrowseHierarchy = "search";
      }

      return result;
    } catch (err: any) {
      throw { code: ErrorCodes.BROWSE_ERROR, message: err.message };
    }
  }

  /**
   * Handle select - select an item from last browse/search results
   */
  private async handleSelect(params: Record<string, unknown>): Promise<BrowseResult> {
    if (!this.roon.getState().isReady()) {
      throw { code: ErrorCodes.NOT_CONNECTED, message: "Not connected to Roon Core" };
    }

    let itemKey: string | undefined = params.itemKey as string | undefined;

    // If index provided, look up from last results
    if (params.index !== undefined) {
      const index = (params.index as number) - 1; // Convert to 0-based
      if (index < 0 || index >= this.lastBrowseItems.length) {
        throw {
          code: ErrorCodes.INVALID_PARAMS,
          message: `Invalid index ${params.index}. Last browse had ${this.lastBrowseItems.length} items.`
        };
      }
      itemKey = this.lastBrowseItems[index].itemKey;
    }

    if (!itemKey) {
      throw { code: ErrorCodes.INVALID_PARAMS, message: "itemKey or index required" };
    }

    try {
      const result = await this.roon.browseBrowse({
        hierarchy: this.lastBrowseHierarchy,
        itemKey,
        zoneIdOrName: params.zone as string | undefined,
      });

      // Update stored results if we got a new list
      if (result.items && result.items.length > 0) {
        this.lastBrowseItems = result.items;
      }

      return result;
    } catch (err: any) {
      throw { code: ErrorCodes.BROWSE_ERROR, message: err.message };
    }
  }

  /**
   * Handle back - go back one level in browse hierarchy
   */
  private async handleBack(params: Record<string, unknown>): Promise<BrowseResult> {
    if (!this.roon.getState().isReady()) {
      throw { code: ErrorCodes.NOT_CONNECTED, message: "Not connected to Roon Core" };
    }

    const levels = (params.levels as number) || 1;

    try {
      const result = await this.roon.browseBrowse({
        hierarchy: this.lastBrowseHierarchy,
        popLevels: levels,
        zoneIdOrName: params.zone as string | undefined,
      });

      // Update stored results
      if (result.items && result.items.length > 0) {
        this.lastBrowseItems = result.items;
      }

      return result;
    } catch (err: any) {
      throw { code: ErrorCodes.BROWSE_ERROR, message: err.message };
    }
  }

  /**
   * Handle queue
   */
  private async handleQueue(params: Record<string, unknown>): Promise<any> {
    if (!this.roon.getState().isReady()) {
      throw { code: ErrorCodes.NOT_CONNECTED, message: "Not connected to Roon Core" };
    }

    const zone = params.zone as string | undefined;
    try {
      return await this.roon.getQueue(zone);
    } catch (err: any) {
      throw { code: ErrorCodes.ROON_ERROR, message: err.message };
    }
  }

  /**
   * Send a successful response
   */
  private sendResponse(socket: net.Socket, id: string, result: unknown): void {
    const response: IPCResponse = { id, result };
    socket.write(JSON.stringify(response) + "\n");
  }

  /**
   * Send an error response
   */
  private sendError(socket: net.Socket, id: string, code: number, message: string): void {
    const response: IPCResponse = {
      id,
      error: { code, message },
    };
    socket.write(JSON.stringify(response) + "\n");
  }
}
