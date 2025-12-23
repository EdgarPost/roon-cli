import { Command } from "commander";
import { send } from "../client.js";
import { getConfig } from "../config.js";

export function registerStop(program: Command): void {
  program
    .command("stop")
    .description("Stop playback")
    .option("-z, --zone <zone>", "Zone name or ID")
    .action(async (options) => {
      try {
        const config = getConfig();
        const zone = options.zone || config.defaultZone;

        await send("stop", { zone });
        console.log("Playback stopped");
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });
}
