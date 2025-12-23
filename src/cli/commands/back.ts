import { Command } from "commander";
import { send } from "../client.js";
import { getConfig } from "../config.js";
import { formatBrowse } from "../output.js";
import type { BrowseResult } from "../../shared/types.js";

export function registerBack(program: Command): void {
  program
    .command("back [levels]")
    .description("Go back in browse/search results")
    .option("-z, --zone <zone>", "Zone name or ID")
    .option("-j, --json", "Output as JSON")
    .action(async (levelsStr: string | undefined, options) => {
      try {
        const config = getConfig();
        const zone = options.zone || config.defaultZone;
        const levels = levelsStr ? parseInt(levelsStr, 10) : 1;

        const result = await send<BrowseResult>("back", { zone, levels });

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
