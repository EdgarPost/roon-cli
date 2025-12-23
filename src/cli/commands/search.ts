import { Command } from "commander";
import { send } from "../client.js";
import { getConfig } from "../config.js";
import { formatBrowse } from "../output.js";

export function registerSearch(program: Command): void {
  program
    .command("search <query>")
    .description("Search library")
    .option("-z, --zone <zone>", "Zone name or ID")
    .option("-j, --json", "Output as JSON")
    .action(async (query: string, options) => {
      try {
        const config = getConfig();
        const zone = options.zone || config.defaultZone;

        const result = await send("search", { query, zone });
        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(formatBrowse(result));
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
