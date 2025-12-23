import { Command } from "commander";
import { send } from "../client.js";
import { formatOutputs } from "../output.js";

export function registerOutputs(program: Command): void {
  program
    .command("outputs")
    .description("List all outputs")
    .option("-j, --json", "Output as JSON")
    .action(async (options) => {
      try {
        const outputs = await send("outputs");
        if (options.json) {
          console.log(JSON.stringify(outputs, null, 2));
        } else {
          console.log(formatOutputs(outputs));
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
