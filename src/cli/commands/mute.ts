import { Command } from "commander";
import { send } from "../client.js";

export function registerMute(program: Command): void {
  program
    .command("mute")
    .description("Mute output")
    .requiredOption("-o, --output <output>", "Output name or ID")
    .action(async (options) => {
      try {
        const output = options.output;
        await send("mute", { output });
        console.log("Output muted");
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });

  program
    .command("unmute")
    .description("Unmute output")
    .requiredOption("-o, --output <output>", "Output name or ID")
    .action(async (options) => {
      try {
        const output = options.output;
        await send("unmute", { output });
        console.log("Output unmuted");
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });
}
