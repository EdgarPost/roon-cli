import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { StateManager } from "./state.js";
import { RoonConnection } from "./roon.js";
import { IPCServer } from "./server.js";
import type { Config } from "../shared/types.js";
import { DEFAULT_SOCKET_PATH } from "../shared/protocol.js";

/**
 * Roon CLI Daemon
 *
 * Maintains a persistent connection to Roon Core and exposes an IPC server
 * over Unix socket for CLI clients to communicate with.
 */

// Default config path
const CONFIG_DIR = path.join(os.homedir(), ".config", "roon-cli");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

/**
 * Load configuration from file
 */
function loadConfig(): Config {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const content = fs.readFileSync(CONFIG_PATH, "utf-8");
      const config = JSON.parse(content);
      console.log(`Loaded configuration from ${CONFIG_PATH}`);
      return config;
    }
  } catch (err) {
    console.error(`Failed to load config from ${CONFIG_PATH}:`, err);
  }

  return {};
}

/**
 * Save configuration to file
 */
function saveConfig(config: Config): void {
  try {
    // Create config directory if it doesn't exist
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    console.log(`Saved configuration to ${CONFIG_PATH}`);
  } catch (err) {
    console.error(`Failed to save config to ${CONFIG_PATH}:`, err);
  }
}

/**
 * Main daemon function
 */
async function main() {
  console.log("Starting Roon CLI Daemon...");

  // Load config
  const config = loadConfig();

  // Determine socket path
  const socketPath = config.socketPath || DEFAULT_SOCKET_PATH;

  // Create state manager
  const state = new StateManager();

  // Create Roon connection
  const roon = new RoonConnection(state, {
    coreHost: config.coreHost,
    corePort: config.corePort,
  });

  // Create IPC server
  const server = new IPCServer(roon, socketPath);

  // Graceful shutdown handler
  let isShuttingDown = false;
  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;

    console.log(`\nReceived ${signal}, shutting down gracefully...`);

    try {
      // Stop IPC server
      await server.stop();
      console.log("IPC server stopped");

      // Note: Roon API doesn't provide a clean shutdown method,
      // but the connection will be closed when the process exits
      console.log("Roon connection will be closed on exit");

      process.exit(0);
    } catch (err) {
      console.error("Error during shutdown:", err);
      process.exit(1);
    }
  };

  // Register shutdown handlers
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Handle uncaught errors
  process.on("uncaughtException", (err) => {
    console.error("Uncaught exception:", err);
    shutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled rejection at:", promise, "reason:", reason);
    shutdown("unhandledRejection");
  });

  try {
    // Start IPC server
    await server.start();
    console.log(`IPC server started on ${socketPath}`);

    // Connect to Roon Core
    roon.connect();
    console.log("Roon connection initiated");

    // Track connection state for logging only on changes
    let lastConnected = false;
    let lastPaired = false;
    let lastZoneCount = 0;

    // Log meaningful state changes only
    state.onChange(() => {
      const daemonState = state.getState();
      const connected = daemonState.connected;
      const paired = daemonState.paired;
      const zoneCount = daemonState.zones.length;

      // Only log when connection state or zone count changes
      if (connected !== lastConnected || paired !== lastPaired || zoneCount !== lastZoneCount) {
        if (connected && paired) {
          console.log(`Connected to ${daemonState.coreName || "Roon Core"} - ${zoneCount} zones available`);
        } else if (connected) {
          console.log("Connected, waiting for pairing approval in Roon...");
        } else if (lastConnected) {
          console.log("Disconnected from Roon Core");
        }

        lastConnected = connected;
        lastPaired = paired;
        lastZoneCount = zoneCount;
      }
    });

    console.log("Daemon is running. Press Ctrl+C to stop.");
  } catch (err) {
    console.error("Failed to start daemon:", err);
    process.exit(1);
  }
}

// Run the daemon
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
