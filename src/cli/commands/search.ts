import { Command } from "commander";
import { send } from "../client.js";
import { getConfig } from "../config.js";
import { formatBrowse } from "../output.js";

export function registerSearch(program: Command): void {
  program
    .command("search <query>")
    .description("Search library")
    .option("-z, --zone <zone>", "Zone name or ID")
    .action(async (query: string, options) => {
      try {
        const config = getConfig();
        const zone = options.zone || config.defaultZone;

        const result = await send("search", { query, zone });
        console.log(formatBrowse(result));
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });
}
