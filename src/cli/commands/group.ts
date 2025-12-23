import { Command } from "commander";
import { send } from "../client.js";

export function registerGroup(program: Command): void {
  program
    .command("group <outputs...>")
    .description("Group multiple outputs together into a single zone")
    .option("-j, --json", "Output as JSON")
    .action(async (outputs: string[], options) => {
      try {
        if (outputs.length < 2) {
          const error = "At least 2 outputs required for grouping";
          if (options.json) {
            console.log(JSON.stringify({ error }));
          } else {
            console.error(`Error: ${error}`);
          }
          process.exit(1);
        }

        await send("group", { outputs });

        if (options.json) {
          console.log(JSON.stringify({ success: true, grouped: outputs }));
        } else {
          console.log(`Grouped: ${outputs.join(", ")}`);
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

export function registerUngroup(program: Command): void {
  program
    .command("ungroup <outputs...>")
    .description("Ungroup outputs from their current zone")
    .option("-j, --json", "Output as JSON")
    .action(async (outputs: string[], options) => {
      try {
        await send("ungroup", { outputs });

        if (options.json) {
          console.log(JSON.stringify({ success: true, ungrouped: outputs }));
        } else {
          console.log(`Ungrouped: ${outputs.join(", ")}`);
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
