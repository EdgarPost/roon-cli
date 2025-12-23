import { Command } from "commander";
import { send } from "../client.js";
import { getConfig } from "../config.js";
import { formatBrowse } from "../output.js";
import type { BrowseResult } from "../../shared/types.js";

export function registerSelect(program: Command): void {
  program
    .command("select [index]")
    .description("Select an item from last browse/search results")
    .option("-z, --zone <zone>", "Zone name or ID")
    .option("-k, --key <itemKey>", "Item key to select directly")
    .option("-j, --json", "Output as JSON")
    .action(async (indexStr: string | undefined, options) => {
      try {
        const config = getConfig();
        const zone = options.zone || config.defaultZone;

        const params: Record<string, unknown> = { zone };

        if (options.key) {
          params.itemKey = options.key;
        } else if (indexStr) {
          const index = parseInt(indexStr, 10);
          if (isNaN(index) || index < 1) {
            const error = "Index must be a positive number";
            if (options.json) {
              console.log(JSON.stringify({ error }));
            } else {
              console.error(`Error: ${error}`);
            }
            process.exit(1);
          }
          params.index = index;
        } else {
          const error = "Please provide an index or --key";
          if (options.json) {
            console.log(JSON.stringify({ error }));
          } else {
            console.error(`Error: ${error}`);
            console.log("Usage: roon select <number>");
            console.log("       roon select --key <item_key>");
          }
          process.exit(1);
        }

        const result = await send<BrowseResult>("select", params);

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          // Check if action was taken
          if (result.action === "message" && result.message) {
            console.log(result.message);
          } else if (result.action === "none") {
            console.log("Action completed (playback may have started)");
          } else {
            console.log(formatBrowse(result));
          }
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
