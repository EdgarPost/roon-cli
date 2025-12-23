import { Command } from "commander";
import { send } from "../client.js";
import { getConfig } from "../config.js";
import { formatQueue } from "../output.js";

export function registerQueue(program: Command): void {
  program
    .command("queue")
    .description("Show current queue")
    .option("-z, --zone <zone>", "Zone name or ID")
    .option("-j, --json", "Output as JSON")
    .action(async (options) => {
      try {
        const config = getConfig();
        const zone = options.zone || config.defaultZone;

        const items = await send("queue", { zone });
        if (options.json) {
          console.log(JSON.stringify(items, null, 2));
        } else {
          console.log(formatQueue(items));
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
