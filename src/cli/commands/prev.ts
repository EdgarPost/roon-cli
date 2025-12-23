import { Command } from "commander";
import { send } from "../client.js";
import { getConfig } from "../config.js";

export function registerPrev(program: Command): void {
  program
    .command("prev")
    .alias("previous")
    .description("Skip to previous track")
    .option("-z, --zone <zone>", "Zone name or ID")
    .action(async (options) => {
      try {
        const config = getConfig();
        const zone = options.zone || config.defaultZone;

        await send("previous", { zone });
        console.log("Skipped to previous track");
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });
}
