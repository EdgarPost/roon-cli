import { Command } from "commander";
import { send } from "../client.js";
import { getConfig } from "../config.js";
import type { LoopMode } from "../../shared/types.js";

export function registerLoop(program: Command): void {
  program
    .command("loop [mode]")
    .description("Toggle or set loop mode (loop, loop_one, disabled)")
    .option("-z, --zone <zone>", "Zone name or ID")
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
            console.error("Error: Mode must be 'loop', 'loop_one', or 'disabled'");
            process.exit(1);
          }
        } else {
          // Toggle through modes
          mode = "next";
        }

        const result = await send("loop", { zone, mode });
        console.log(`Loop mode: ${result.mode}`);
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });
}
