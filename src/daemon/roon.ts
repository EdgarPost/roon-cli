import RoonApi from "node-roon-api";
import RoonApiTransport from "node-roon-api-transport";
import RoonApiBrowse from "node-roon-api-browse";
import RoonApiStatus from "node-roon-api-status";
import type { Zone, BrowseResult, BrowseItem, BrowseList, QueueItem, LoopMode } from "../shared/types.js";
import { StateManager } from "./state.js";

export interface RoonConfig {
  coreHost?: string;
  corePort?: number;
}

/**
 * RoonConnection manages the connection to Roon Core and provides
 * high-level methods for transport control and browsing.
 */
export class RoonConnection {
  private roon: any;
  private transport: any;
  private browse: any;
  private status: any;
  private state: StateManager;
  private config: RoonConfig;
  private core: any = null;
  private isConnected: boolean = false;

  constructor(state: StateManager, config: RoonConfig = {}) {
    this.state = state;
    this.config = config;

    // Initialize services
    this.transport = new RoonApiTransport();
    this.browse = new RoonApiBrowse();

    // Initialize Roon API with callbacks
    this.roon = new RoonApi({
      extension_id: "com.roon-cli.controller",
      display_name: "Roon CLI",
      display_version: "1.0.0",
      publisher: "roon-cli",
      email: "roon-cli@example.com",
      website: "https://github.com/roon-cli/roon-cli",

      core_paired: (core: any) => {
        console.log(`Connected to Roon Core: ${core.display_name} (${core.core_id})`);
        this.core = core;
        this.isConnected = true;

        // Get transport service from core
        this.transport = core.services.RoonApiTransport;
        this.browse = core.services.RoonApiBrowse;

        // Subscribe to transport updates
        if (this.transport) {
          this.transport.subscribe_zones((response: string, data: any) => {
            if (response === "Subscribed") {
              console.log(`Subscribed to zones: ${data.zones?.length || 0} zones available`);
              this.state.updateZones(data);
              this.state.setConnectionStatus(true, true, core.display_name, core.core_id);
            } else if (response === "Changed") {
              this.state.updateZones(data);
            } else if (response === "Unsubscribed") {
              console.log("Unsubscribed from zones");
              this.state.updateZones({ zones: [] });
              this.state.setConnectionStatus(this.isConnected, false);
            }
          });
        }

        // Update status
        this.status.set_status("Connected to " + core.display_name, false);
      },

      core_unpaired: (core: any) => {
        console.log(`Disconnected from Roon Core: ${core.display_name}`);
        this.core = null;
        this.isConnected = false;
        this.transport = null;
        this.browse = null;
        this.state.setConnectionStatus(false, false);
        this.status.set_status("Disconnected - waiting for reconnection...", false);
      },
    });

    // Initialize status service
    this.status = new RoonApiStatus(this.roon);

    // Initialize services
    this.roon.init_services({
      required_services: [RoonApiTransport, RoonApiBrowse],
      provided_services: [this.status],
    });
  }

  /**
   * Start discovery and connect to Roon Core
   */
  connect(): void {
    console.log("Starting Roon discovery...");
    this.status.set_status("Searching for Roon Core...", false);

    if (this.config.coreHost && this.config.corePort) {
      // Direct connection if host/port specified
      this.roon.ws_connect({
        host: this.config.coreHost,
        port: this.config.corePort,
        onclose: () => {
          console.log("Connection closed");
          this.isConnected = false;
          this.state.setConnectionStatus(false, false);
        },
      });
    } else {
      // Auto-discovery
      this.roon.start_discovery();
    }
  }

  /**
   * Get the transport service (for direct access if needed)
   */
  getTransport(): any {
    return this.transport;
  }

  /**
   * Get the browse service (for direct access if needed)
   */
  getBrowse(): any {
    return this.browse;
  }

  /**
   * Get current state
   */
  getState(): StateManager {
    return this.state;
  }

  /**
   * Resolve a zone ID from a zone name/ID or use first zone
   */
  private resolveZone(zoneIdOrName?: string): Zone | null {
    if (!this.state.isReady()) {
      return null;
    }

    if (zoneIdOrName) {
      return this.state.getZone(zoneIdOrName) || null;
    } else {
      return this.state.getFirstZone() || null;
    }
  }

  /**
   * Transport control
   */
  async control(zoneIdOrName: string | undefined, action: "play" | "pause" | "playpause" | "stop" | "previous" | "next"): Promise<void> {
    const zone = this.resolveZone(zoneIdOrName);
    if (!zone) {
      throw new Error("Zone not found or not connected");
    }

    return new Promise((resolve, reject) => {
      this.transport.control(zone.zoneId, action, (error: any) => {
        if (error) {
          reject(new Error(`Transport control failed: ${error}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Seek to position
   */
  async seek(zoneIdOrName: string | undefined, seconds: number, relative: boolean = false): Promise<void> {
    const zone = this.resolveZone(zoneIdOrName);
    if (!zone) {
      throw new Error("Zone not found or not connected");
    }

    return new Promise((resolve, reject) => {
      this.transport.seek(zone.zoneId, relative ? "relative" : "absolute", seconds, (error: any) => {
        if (error) {
          reject(new Error(`Seek failed: ${error}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Change volume
   */
  async changeVolume(outputIdOrName: string | undefined, value: number, relative: boolean = false): Promise<void> {
    if (!this.state.isReady()) {
      throw new Error("Not connected to Roon Core");
    }

    let output;
    if (outputIdOrName) {
      output = this.state.getOutput(outputIdOrName);
    } else {
      // Use first output of first zone
      const zone = this.state.getFirstZone();
      if (zone) {
        output = zone.outputs[0];
      }
    }

    if (!output) {
      throw new Error("Output not found");
    }

    const how = relative ? "relative_step" : "absolute";

    return new Promise((resolve, reject) => {
      this.transport.change_volume(output.outputId, how, value, (error: any) => {
        if (error) {
          reject(new Error(`Volume change failed: ${error}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Mute/unmute output
   */
  async mute(outputIdOrName: string | undefined, mute: boolean): Promise<void> {
    if (!this.state.isReady()) {
      throw new Error("Not connected to Roon Core");
    }

    let output;
    if (outputIdOrName) {
      output = this.state.getOutput(outputIdOrName);
    } else {
      // Use first output of first zone
      const zone = this.state.getFirstZone();
      if (zone) {
        output = zone.outputs[0];
      }
    }

    if (!output) {
      throw new Error("Output not found");
    }

    return new Promise((resolve, reject) => {
      this.transport.mute(output.outputId, mute ? "mute" : "unmute", (error: any) => {
        if (error) {
          reject(new Error(`Mute/unmute failed: ${error}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Change settings
   */
  async changeSettings(
    zoneIdOrName: string | undefined,
    settings: { shuffle?: boolean; loop?: LoopMode; autoRadio?: boolean }
  ): Promise<void> {
    const zone = this.resolveZone(zoneIdOrName);
    if (!zone) {
      throw new Error("Zone not found or not connected");
    }

    const roonSettings: any = {};
    if (settings.shuffle !== undefined) {
      roonSettings.shuffle = settings.shuffle;
    }
    if (settings.loop !== undefined) {
      roonSettings.loop = settings.loop;
    }
    if (settings.autoRadio !== undefined) {
      roonSettings.auto_radio = settings.autoRadio;
    }

    return new Promise((resolve, reject) => {
      this.transport.change_settings(zone.zoneId, roonSettings, (error: any) => {
        if (error) {
          reject(new Error(`Settings change failed: ${error}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Browse the Roon library
   */
  async browseBrowse(params: {
    hierarchy?: string;
    itemKey?: string;
    input?: string;
    zoneIdOrName?: string;
    popAll?: boolean;
    popLevels?: number;
    refresh?: boolean;
    offset?: number;
    count?: number;
  }): Promise<BrowseResult> {
    if (!this.state.isReady()) {
      throw new Error("Not connected to Roon Core");
    }

    // Resolve zone
    let zoneOrOutputId: string | undefined;
    if (params.zoneIdOrName) {
      const zone = this.state.getZone(params.zoneIdOrName);
      if (zone) {
        zoneOrOutputId = zone.zoneId;
      }
    } else {
      const zone = this.state.getFirstZone();
      if (zone) {
        zoneOrOutputId = zone.zoneId;
      }
    }

    return new Promise((resolve, reject) => {
      const opts: any = {
        hierarchy: params.hierarchy || "browse",
        zone_or_output_id: zoneOrOutputId,
      };

      if (params.itemKey) opts.item_key = params.itemKey;
      if (params.input) opts.input = params.input;
      if (params.popAll) opts.pop_all = true;
      if (params.popLevels) opts.pop_levels = params.popLevels;
      if (params.refresh) opts.refresh_list = true;

      this.browse.browse(opts, (error: any, result: any) => {
        if (error) {
          reject(new Error(`Browse failed: ${error}`));
          return;
        }

        // Load items if needed
        if (result.action === "list" && result.list) {
          const offset = params.offset || 0;
          const count = params.count || 100;

          this.browse.load({
            hierarchy: opts.hierarchy,  // Use same hierarchy as browse
            offset: offset,
            count: count,
            set_display_offset: offset,
          }, (loadError: any, loadResult: any) => {
            if (loadError) {
              reject(new Error(`Browse load failed: ${loadError}`));
              return;
            }

            resolve(this.parseBrowseResult(result, loadResult));
          });
        } else {
          resolve(this.parseBrowseResult(result, null));
        }
      });
    });
  }

  /**
   * Parse browse result
   */
  private parseBrowseResult(result: any, loadResult: any): BrowseResult {
    const items: BrowseItem[] = [];

    if (loadResult && loadResult.items) {
      for (const item of loadResult.items) {
        items.push({
          itemKey: item.item_key,
          title: item.title,
          subtitle: item.subtitle,
          imageKey: item.image_key,
          hint: item.hint,
        });
      }
    }

    const browseResult: BrowseResult = {
      action: result.action || "none",
      items,
    };

    if (result.list) {
      browseResult.list = {
        title: result.list.title,
        count: result.list.count,
        level: result.list.level,
        subtitle: result.list.subtitle,
        imageKey: result.list.image_key,
        displayOffset: result.list.display_offset,
      };
    }

    if (result.message) {
      browseResult.message = result.message;
    }

    return browseResult;
  }

  /**
   * Get queue items
   */
  async getQueue(zoneIdOrName: string | undefined, offset: number = 0, count: number = 100): Promise<QueueItem[]> {
    const zone = this.resolveZone(zoneIdOrName);
    if (!zone) {
      throw new Error("Zone not found or not connected");
    }

    return new Promise((resolve, reject) => {
      this.browse.browse({
        hierarchy: "queue",
        zone_or_output_id: zone.zoneId,
      }, (error: any, result: any) => {
        if (error) {
          reject(new Error(`Queue browse failed: ${error}`));
          return;
        }

        if (result.action !== "list" || !result.list) {
          resolve([]);
          return;
        }

        this.browse.load({
          hierarchy: "queue",
          offset,
          count,
        }, (loadError: any, loadResult: any) => {
          if (loadError) {
            reject(new Error(`Queue load failed: ${loadError}`));
            return;
          }

          const items: QueueItem[] = [];
          if (loadResult && loadResult.items) {
            for (const item of loadResult.items) {
              items.push({
                queueItemId: item.queue_item_id,
                length: item.length,
                imageKey: item.image_key,
                oneLine: { line1: item.one_line?.line1 || "" },
                twoLine: {
                  line1: item.two_line?.line1 || item.one_line?.line1 || "",
                  line2: item.two_line?.line2 || "",
                },
                threeLine: {
                  line1: item.three_line?.line1 || item.two_line?.line1 || item.one_line?.line1 || "",
                  line2: item.three_line?.line2 || item.two_line?.line2 || "",
                  line3: item.three_line?.line3 || "",
                },
              });
            }
          }

          resolve(items);
        });
      });
    });
  }
}
