import { Command } from "commander";
import { send } from "../client.js";
import { getConfig } from "../config.js";

export function registerPlay(program: Command): void {
  program
    .command("play")
    .description("Start playback")
    .option("-z, --zone <zone>", "Zone name or ID")
    .action(async (options) => {
      try {
        const config = getConfig();
        const zone = options.zone || config.defaultZone;

        await send("play", { zone });
        console.log("Playback started");
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });
}
