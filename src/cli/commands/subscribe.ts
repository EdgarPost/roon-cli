import { Command } from "commander";
import { SubscriptionClient } from "../client.js";
import type { SubscriptionEventType, IPCEvent } from "../../shared/protocol.js";

export function registerSubscribe(program: Command): void {
  program
    .command("subscribe")
    .description("Subscribe to real-time events from the daemon")
    .option(
      "-e, --events <events>",
      "Comma-separated list of event types (position,state,track,volume,settings,zones,connection)",
      "state,track,position"
    )
    .option("-z, --zone <zone>", "Filter to specific zone (name or ID)")
    .option("-j, --json", "Output events as JSON")
    .action(async (options) => {
      const eventList = options.events.split(",").map((e: string) => e.trim()) as SubscriptionEventType[];
      const zones = options.zone ? [options.zone] : undefined;

      const client = new SubscriptionClient();

      console.error(`Subscribing to events: ${eventList.join(", ")}`);
      if (zones) {
        console.error(`Filtering zones: ${zones.join(", ")}`);
      }

      try {
        await client.subscribe({ events: eventList, zones });
        console.error("Subscribed. Press Ctrl+C to stop.\n");

        client.on("event", (event: IPCEvent) => {
          if (options.json) {
            console.log(JSON.stringify(event));
          } else {
            const zoneInfo = event.zoneId ? ` [${event.zoneId}]` : "";
            const timestamp = new Date(event.timestamp).toISOString();
            console.log(`${timestamp} ${event.event}${zoneInfo}: ${JSON.stringify(event.data)}`);
          }
        });

        client.on("error", (err: Error) => {
          console.error("Connection error:", err.message);
          process.exit(1);
        });

        client.on("close", () => {
          console.error("Connection closed");
          process.exit(0);
        });

        // Handle Ctrl+C
        process.on("SIGINT", async () => {
          console.error("\nUnsubscribing...");
          await client.unsubscribe();
          process.exit(0);
        });
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });
}
