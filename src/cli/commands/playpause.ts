import { Command } from "commander";
import { send } from "../client.js";
import { getConfig } from "../config.js";

export function registerPlayPause(program: Command): void {
  program
    .command("playpause")
    .description("Toggle play/pause")
    .option("-z, --zone <zone>", "Zone name or ID")
    .action(async (options) => {
      try {
        const config = getConfig();
        const zone = options.zone || config.defaultZone;

        await send("playpause", { zone });
        console.log("Toggled play/pause");
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });
}
