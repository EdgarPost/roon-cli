import { Command } from "commander";
import { send } from "../client.js";

export function registerStandby(program: Command): void {
  program
    .command("standby <output>")
    .description("Put an output into standby mode")
    .option("-j, --json", "Output as JSON")
    .action(async (output: string, options) => {
      try {
        await send("standby", { output });

        if (options.json) {
          console.log(JSON.stringify({ success: true, output }));
        } else {
          console.log(`"${output}" is now in standby`);
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
