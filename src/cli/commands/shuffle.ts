import { Command } from "commander";
import { send } from "../client.js";
import { getConfig } from "../config.js";

export function registerShuffle(program: Command): void {
  program
    .command("shuffle [on|off]")
    .description("Toggle or set shuffle mode")
    .option("-z, --zone <zone>", "Zone name or ID")
    .option("-j, --json", "Output as JSON")
    .action(async (mode: string | undefined, options) => {
      try {
        const config = getConfig();
        const zone = options.zone || config.defaultZone;

        let enabled: boolean | undefined;
        if (mode) {
          if (mode === "on" || mode === "true") {
            enabled = true;
          } else if (mode === "off" || mode === "false") {
            enabled = false;
          } else {
            const error = "Mode must be 'on' or 'off'";
            if (options.json) {
              console.log(JSON.stringify({ error }));
            } else {
              console.error(`Error: ${error}`);
            }
            process.exit(1);
          }
        }

        const result = await send("shuffle", { zone, enabled });
        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`Shuffle ${result.enabled ? "enabled" : "disabled"}`);
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
