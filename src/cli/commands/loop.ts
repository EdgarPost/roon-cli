import { Command } from "commander";
import { send } from "../client.js";
import { getConfig } from "../config.js";

export function registerLoop(program: Command): void {
  program
    .command("loop [mode]")
    .description("Toggle or set loop mode (loop, loop_one, disabled)")
    .option("-z, --zone <zone>", "Zone name or ID")
    .option("-j, --json", "Output as JSON")
    .action(async (modeStr: string | undefined, options) => {
      try {
        const config = getConfig();
        const zone = options.zone || config.defaultZone;

        let mode: "loop" | "loop_one" | "disabled" | "next" | undefined;

        if (modeStr) {
          if (modeStr === "loop" || modeStr === "loop_one" || modeStr === "disabled") {
            mode = modeStr;
          } else if (modeStr === "off") {
            mode = "disabled";
          } else if (modeStr === "one") {
            mode = "loop_one";
          } else {
            const error = "Mode must be 'loop', 'loop_one', or 'disabled'";
            if (options.json) {
              console.log(JSON.stringify({ error }));
            } else {
              console.error(`Error: ${error}`);
            }
            process.exit(1);
          }
        } else {
          // Toggle through modes
          mode = "next";
        }

        const result = await send("loop", { zone, mode });
        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`Loop mode: ${result.mode}`);
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
