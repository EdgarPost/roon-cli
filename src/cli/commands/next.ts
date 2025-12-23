import { Command } from "commander";
import { send } from "../client.js";
import { getConfig } from "../config.js";

export function registerNext(program: Command): void {
  program
    .command("next")
    .description("Skip to next track")
    .option("-z, --zone <zone>", "Zone name or ID")
    .action(async (options) => {
      try {
        const config = getConfig();
        const zone = options.zone || config.defaultZone;

        await send("next", { zone });
        console.log("Skipped to next track");
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });
}
