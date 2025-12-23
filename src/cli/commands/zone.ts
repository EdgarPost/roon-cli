import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { send } from "../client.js";
import type { Zone } from "../../shared/types.js";

const CONFIG_DIR = path.join(os.homedir(), ".config", "roon-cli");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

function loadConfig(): Record<string, unknown> {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    }
  } catch {
    // Ignore errors
  }
  return {};
}

function saveConfig(config: Record<string, unknown>): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function registerZone(program: Command) {
  const zoneCmd = program
    .command("zone")
    .description("Show or set the default zone");

  // Show current default zone
  zoneCmd
    .option("-j, --json", "Output as JSON")
    .action(async (options) => {
      try {
        const config = loadConfig();
        const zones = await send<Zone[]>("zones", {});

        if (options.json) {
          console.log(JSON.stringify({
            defaultZone: config.defaultZone || null,
            zones: zones.map(z => ({
              name: z.displayName,
              id: z.zoneId,
              state: z.state,
              isDefault: config.defaultZone === z.displayName || config.defaultZone === z.zoneId
            }))
          }, null, 2));
        } else {
          console.log("Available zones:");
          for (const zone of zones) {
            const isDefault = config.defaultZone === zone.displayName || config.defaultZone === zone.zoneId;
            const marker = isDefault ? " (default)" : "";
            const state = zone.state === "playing" ? " ▶" : zone.state === "paused" ? " ⏸" : "";
            console.log(`  ${zone.displayName}${state}${marker}`);
          }

          if (!config.defaultZone) {
            console.log("\nNo default zone set. Use 'roon zone set <name>' to set one.");
          }
        }
      } catch (err) {
        if (options.json) {
          console.log(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        } else {
          console.error("Error:", err instanceof Error ? err.message : err);
        }
        process.exit(1);
      }
    });

  // Set default zone
  zoneCmd
    .command("set <name>")
    .description("Set the default zone")
    .option("-j, --json", "Output as JSON")
    .action(async (name: string, options) => {
      try {
        // Verify the zone exists
        const zones = await send<Zone[]>("zones", {});
        const zone = zones.find(
          (z) => z.displayName.toLowerCase() === name.toLowerCase() || z.zoneId === name
        );

        if (!zone) {
          if (options.json) {
            console.log(JSON.stringify({
              error: `Zone "${name}" not found`,
              availableZones: zones.map(z => z.displayName)
            }));
          } else {
            console.error(`Zone "${name}" not found.`);
            console.log("\nAvailable zones:");
            for (const z of zones) {
              console.log(`  ${z.displayName}`);
            }
          }
          process.exit(1);
        }

        // Save to config
        const config = loadConfig();
        config.defaultZone = zone.displayName;
        saveConfig(config);

        if (options.json) {
          console.log(JSON.stringify({ success: true, defaultZone: zone.displayName }, null, 2));
        } else {
          console.log(`Default zone set to: ${zone.displayName}`);
        }
      } catch (err) {
        if (options.json) {
          console.log(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        } else {
          console.error("Error:", err instanceof Error ? err.message : err);
        }
        process.exit(1);
      }
    });

  // Clear default zone
  zoneCmd
    .command("clear")
    .description("Clear the default zone")
    .option("-j, --json", "Output as JSON")
    .action(async (options) => {
      try {
        const config = loadConfig();
        delete config.defaultZone;
        saveConfig(config);

        if (options.json) {
          console.log(JSON.stringify({ success: true, defaultZone: null }, null, 2));
        } else {
          console.log("Default zone cleared.");
        }
      } catch (err) {
        if (options.json) {
          console.log(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        } else {
          console.error("Error:", err instanceof Error ? err.message : err);
        }
        process.exit(1);
      }
    });
}
