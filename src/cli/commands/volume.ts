import { Command } from "commander";
import { send } from "../client.js";

export function registerVolume(program: Command): void {
  program
    .command("volume <level>")
    .description("Set volume level (supports +/- for relative volume)")
    .option("-o, --output <output>", "Output name or ID")
    .action(async (levelStr: string, options) => {
      try {
        const output = options.output;

        // Parse volume with support for relative (+/-) prefix
        let value: number;
        let relative = false;

        if (levelStr.startsWith("+") || levelStr.startsWith("-")) {
          relative = true;
          value = parseFloat(levelStr);
        } else {
          value = parseFloat(levelStr);
        }

        if (isNaN(value)) {
          console.error("Error: Invalid volume level");
          process.exit(1);
        }

        await send("volume", { output, value, relative });

        if (relative) {
          console.log(`Volume adjusted by ${value > 0 ? "+" : ""}${value}`);
        } else {
          console.log(`Volume set to ${value}`);
        }
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });
}
