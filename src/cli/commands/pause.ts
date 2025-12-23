import { Command } from "commander";
import { send } from "../client.js";
import { getConfig } from "../config.js";

export function registerPause(program: Command): void {
  program
    .command("pause")
    .description("Pause playback")
    .option("-z, --zone <zone>", "Zone name or ID")
    .action(async (options) => {
      try {
        const config = getConfig();
        const zone = options.zone || config.defaultZone;

        await send("pause", { zone });
        console.log("Playback paused");
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });
}
