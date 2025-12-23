import { Command } from "commander";
import { send } from "../client.js";
import { getConfig } from "../config.js";
import { formatStatus } from "../output.js";

export function registerStatus(program: Command): void {
  program
    .command("status")
    .description("Show current playback status")
    .option("-z, --zone <zone>", "Zone name or ID")
    .option("-j, --json", "Output as JSON (for Waybar)")
    .action(async (options) => {
      try {
        const config = getConfig();
        const zone = options.zone || config.defaultZone;

        const result = await send("zone", { zone });
        console.log(formatStatus(result, options.json));
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });
}
