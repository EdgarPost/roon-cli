import { Command } from "commander";
import { send } from "../client.js";
import { formatZones } from "../output.js";

export function registerZones(program: Command): void {
  program
    .command("zones")
    .description("List all zones")
    .action(async () => {
      try {
        const zones = await send("zones");
        console.log(formatZones(zones));
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });
}
