import { Command } from "commander";
import { send } from "../client.js";
import { formatZones } from "../output.js";

export function registerZones(program: Command): void {
  program
    .command("zones")
    .description("List all zones")
    .option("-j, --json", "Output as JSON")
    .action(async (options) => {
      try {
        const zones = await send("zones");
        if (options.json) {
          console.log(JSON.stringify(zones, null, 2));
        } else {
          console.log(formatZones(zones));
        }
      } catch (err) {
        if (options.json) {
          console.log(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        } else {
          console.error(`Error: ${err instanceof Error ? err.message : err}`);
        }
        process.exit(1);
      }
    });
}
