import * as net from "node:net";
import { DEFAULT_SOCKET_PATH, generateId } from "../shared/protocol.js";
import type { IPCRequest, IPCResponse, Methods } from "../shared/protocol.js";

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
