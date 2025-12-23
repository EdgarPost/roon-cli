import { Command } from "commander";
import { send } from "../client.js";
import { formatOutputs } from "../output.js";

export function registerOutputs(program: Command): void {
  program
    .command("outputs")
    .description("List all outputs")
    .action(async () => {
      try {
        const outputs = await send("outputs");
        console.log(formatOutputs(outputs));
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });
}
