import { Command } from "commander";
import { send } from "../client.js";
import { getConfig } from "../config.js";
import { formatBrowse } from "../output.js";

export function registerBrowse(program: Command): void {
  program
    .command("browse [path]")
    .description("Browse library (artists, albums, genres, playlists, etc.)")
    .option("-z, --zone <zone>", "Zone name or ID")
    .option("-k, --key <itemKey>", "Item key to browse")
    .option("-H, --hierarchy <hierarchy>", "Hierarchy to browse")
    .option("--offset <offset>", "Result offset", "0")
    .option("--count <count>", "Number of results", "50")
    .option("-j, --json", "Output as JSON")
    .action(async (path: string | undefined, options) => {
      try {
        const config = getConfig();
        const zone = options.zone || config.defaultZone;

        // Parse path into hierarchy and itemKey
        let hierarchy = options.hierarchy || path;
        const itemKey = options.key;
        const offset = parseInt(options.offset, 10);
        const count = parseInt(options.count, 10);

        const result = await send("browse", {
          zone,
          hierarchy,
          itemKey,
          offset,
          count,
        });

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
