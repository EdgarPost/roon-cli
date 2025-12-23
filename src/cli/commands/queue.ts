import { Command } from "commander";
import { send } from "../client.js";
import { getConfig } from "../config.js";
import { formatQueue } from "../output.js";

export function registerQueue(program: Command): void {
  program
    .command("queue")
    .description("Show current queue")
    .option("-z, --zone <zone>", "Zone name or ID")
    .action(async (options) => {
      try {
        const config = getConfig();
        const zone = options.zone || config.defaultZone;

        const items = await send("queue", { zone });
        console.log(formatQueue(items));
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });
}
