import { Command } from "commander";
import { send } from "../client.js";
import { getConfig } from "../config.js";

export function registerSeek(program: Command): void {
  program
    .command("seek <seconds>")
    .description("Seek to position (supports +/- for relative seek)")
    .option("-z, --zone <zone>", "Zone name or ID")
    .action(async (secondsStr: string, options) => {
      try {
        const config = getConfig();
        const zone = options.zone || config.defaultZone;

        // Parse seconds with support for relative (+/-) prefix
        let seconds: number;
        let relative = false;

        if (secondsStr.startsWith("+") || secondsStr.startsWith("-")) {
          relative = true;
          seconds = parseFloat(secondsStr);
        } else {
          seconds = parseFloat(secondsStr);
        }

        if (isNaN(seconds)) {
          console.error("Error: Invalid seconds value");
          process.exit(1);
        }

        await send("seek", { zone, seconds, relative });

        if (relative) {
          console.log(`Seeked ${seconds > 0 ? "forward" : "backward"} ${Math.abs(seconds)} seconds`);
        } else {
          console.log(`Seeked to ${seconds} seconds`);
        }
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });
}
