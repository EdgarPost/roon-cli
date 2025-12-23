import * as net from "node:net";
import { EventEmitter } from "events";
import { DEFAULT_SOCKET_PATH, generateId } from "../shared/protocol.js";
import type { IPCRequest, IPCResponse, Methods, SubscriptionEventType, IPCEvent, SubscribeParams } from "../shared/protocol.js";

export class IPCClient {
  private socketPath: string;

  constructor(socketPath: string = DEFAULT_SOCKET_PATH) {
    this.socketPath = socketPath;
  }

  async send<K extends keyof Methods>(
    method: K,
    params?: Methods[K]["params"]
  ): Promise<Methods[K]["result"]> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(this.socketPath);
      const request: IPCRequest = {
        id: generateId(),
        method,
        params: params as Record<string, unknown>,
      };

      let responseData = "";

      socket.on("connect", () => {
        socket.write(JSON.stringify(request) + "\n");
      });

      socket.on("data", (data) => {
        responseData += data.toString();

        // Check if we have a complete JSON response (ends with newline)
        if (responseData.includes("\n")) {
          try {
            const response: IPCResponse = JSON.parse(responseData.trim());

            if (response.error) {
              reject(new IPCError(response.error.message, response.error.code));
            } else {
              resolve(response.result as Methods[K]["result"]);
            }
          } catch (err) {
            reject(new Error(`Failed to parse response: ${err}`));
          } finally {
            socket.end();
          }
        }
      });

      socket.on("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "ENOENT" || err.code === "ECONNREFUSED") {
          reject(
            new Error(
              `Cannot connect to roon-daemon. Is it running?\nTry: roon-daemon start`
            )
          );
        } else {
          reject(new Error(`Connection error: ${err.message}`));
        }
      });

      socket.on("timeout", () => {
        socket.destroy();
        reject(new Error("Request timeout"));
      });

      socket.setTimeout(5000);
    });
  }
}

export class IPCError extends Error {
  constructor(
    message: string,
    public code: number
  ) {
    super(message);
    this.name = "IPCError";
  }
}

// Default client instance
const defaultClient = new IPCClient();

export async function send<K extends keyof Methods>(
  method: K,
  params?: Methods[K]["params"]
): Promise<Methods[K]["result"]> {
  return defaultClient.send(method, params);
}

/**
 * SubscriptionClient for real-time event streaming
 */
export class SubscriptionClient extends EventEmitter {
  private socketPath: string;
  private socket: net.Socket | null = null;
  private buffer: string = "";
  private subscribeResolved: boolean = false;

  constructor(socketPath: string = DEFAULT_SOCKET_PATH) {
    super();
    this.socketPath = socketPath;
  }

  /**
   * Connect and subscribe to events
   */
  async subscribe(params: SubscribeParams): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(this.socketPath);
      this.subscribeResolved = false;

      this.socket.on("connect", () => {
        const request: IPCRequest = {
          id: generateId(),
          method: "subscribe",
          params: params as Record<string, unknown>,
        };
        this.socket!.write(JSON.stringify(request) + "\n");
      });

      this.socket.on("data", (data) => {
        this.buffer += data.toString();
        this.processBuffer(resolve, reject);
      });

      this.socket.on("error", (err: NodeJS.ErrnoException) => {
        if (!this.subscribeResolved) {
          if (err.code === "ENOENT" || err.code === "ECONNREFUSED") {
            reject(
              new Error(
                `Cannot connect to roon-daemon. Is it running?\nTry: roon-daemon start`
              )
            );
          } else {
            reject(new Error(`Connection error: ${err.message}`));
          }
        } else {
          this.emit("error", err);
        }
      });

      this.socket.on("close", () => {
        this.emit("close");
      });

      this.socket.on("end", () => {
        this.emit("end");
      });
    });
  }

  private processBuffer(
    resolve?: (value: void) => void,
    reject?: (reason: Error) => void
  ): void {
    let lineEnd: number;
    while ((lineEnd = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.substring(0, lineEnd).trim();
      this.buffer = this.buffer.substring(lineEnd + 1);

      if (!line) continue;

      try {
        const msg = JSON.parse(line);

        // Is it a response or an event?
        if ("id" in msg) {
          // Response to subscribe/unsubscribe request
          if (msg.error) {
            reject?.(new IPCError(msg.error.message, msg.error.code));
          } else {
            if (!this.subscribeResolved) {
              this.subscribeResolved = true;
              resolve?.();
            }
          }
        } else if ("event" in msg) {
          // Push event
          const event = msg as IPCEvent;
          this.emit(event.event, event.data, event.zoneId, event.timestamp);
          this.emit("event", event); // Generic event for logging
        }
      } catch (err) {
        console.error("Failed to parse message:", line, err);
      }
    }
  }

  /**
   * Unsubscribe and close connection
   */
  async unsubscribe(): Promise<void> {
    if (!this.socket || this.socket.destroyed) return;

    return new Promise((resolve) => {
      const request: IPCRequest = {
        id: generateId(),
        method: "unsubscribe",
      };
      this.socket!.write(JSON.stringify(request) + "\n");
      this.socket!.once("data", () => {
        this.socket!.end();
        resolve();
      });
    });
  }

  /**
   * Close connection immediately
   */
  close(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.socket !== null && !this.socket.destroyed;
  }
}
