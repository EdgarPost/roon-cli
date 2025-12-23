import { Command } from "commander";
import * as fs from "fs";
import { send } from "../client.js";
import { getConfig } from "../config.js";

export function registerAlbumArt(program: Command): void {
  program
    .command("album-art")
    .description("Get album art for the current track or specified image key")
    .option("-z, --zone <zone>", "Zone name or ID")
    .option("-k, --key <imageKey>", "Image key (if not provided, uses current track)")
    .option("-s, --size <pixels>", "Image size (default: 300)", parseInt)
    .option("-f, --format <format>", "Image format: jpeg or png")
    .option("--scale <mode>", "Scale mode: fit, fill, stretch (default: fit)")
    .option("-o, --output <file>", "Save to file instead of stdout")
    .option("-j, --json", "Output as JSON with base64 data")
    .action(async (options) => {
      try {
        const config = getConfig();
        const zone = options.zone || config.defaultZone;

        let imageKey = options.key;

        // If no key provided, get current track's image key
        if (!imageKey) {
          const zoneData = await send("zone", { zone });
          if (!zoneData?.nowPlaying?.imageKey) {
            console.error("No album art available for current track");
            process.exit(1);
          }
          imageKey = zoneData.nowPlaying.imageKey;
        }

        const size = options.size || 300;
        const result = await send("album-art", {
          imageKey,
          scale: options.scale || "fit",
          width: size,
          height: size,
          format: options.format === "png" ? "image/png" : "image/jpeg",
        });

        if (options.json) {
          console.log(
            JSON.stringify(
              {
                contentType: result.contentType,
                data: result.data,
                imageKey,
              },
              null,
              2
            )
          );
        } else if (options.output) {
          const buffer = Buffer.from(result.data, "base64");
          fs.writeFileSync(options.output, buffer);
          console.log(`Saved to ${options.output}`);
        } else {
          // Output raw base64 to stdout (for piping to image viewers)
          process.stdout.write(result.data);
        }
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
        process.exit(1);
      }
    });
}
