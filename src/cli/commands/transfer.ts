import { Command } from "commander";
import { send } from "../client.js";

export function registerTransfer(program: Command): void {
  program
    .command("transfer <from> <to>")
    .description("Transfer playback queue from one zone to another")
    .option("-j, --json", "Output as JSON")
    .action(async (from: string, to: string, options) => {
      try {
        await send("transfer", { from, to });

        if (options.json) {
          console.log(JSON.stringify({ success: true, from, to }));
        } else {
          console.log(`Transferred queue from "${from}" to "${to}"`);
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
