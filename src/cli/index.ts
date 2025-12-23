import { Command } from "commander";
import { registerPlay } from "./commands/play.js";
import { registerPause } from "./commands/pause.js";
import { registerStop } from "./commands/stop.js";
import { registerNext } from "./commands/next.js";
import { registerPrev } from "./commands/prev.js";
import { registerPlayPause } from "./commands/playpause.js";
import { registerSeek } from "./commands/seek.js";
import { registerVolume } from "./commands/volume.js";
import { registerMute } from "./commands/mute.js";
import { registerStatus } from "./commands/status.js";
import { registerZones } from "./commands/zones.js";
import { registerZone } from "./commands/zone.js";
import { registerOutputs } from "./commands/outputs.js";
import { registerShuffle } from "./commands/shuffle.js";
import { registerLoop } from "./commands/loop.js";
import { registerRadio } from "./commands/radio.js";
import { registerBrowse } from "./commands/browse.js";
import { registerSearch } from "./commands/search.js";
import { registerSelect } from "./commands/select.js";
import { registerBack } from "./commands/back.js";
import { registerQueue } from "./commands/queue.js";
import { registerGroup, registerUngroup } from "./commands/group.js";
import { registerTransfer } from "./commands/transfer.js";
import { registerStandby } from "./commands/standby.js";
import { registerAlbumArt } from "./commands/album-art.js";
import { registerSubscribe } from "./commands/subscribe.js";

const program = new Command();

program
  .name("roon")
  .description("Command-line interface for Roon music player")
  .version("1.0.0");

// Register all commands
registerPlay(program);
registerPause(program);
registerStop(program);
registerNext(program);
registerPrev(program);
registerPlayPause(program);
registerSeek(program);
registerVolume(program);
registerMute(program);
registerStatus(program);
registerZones(program);
registerZone(program);
registerOutputs(program);
registerShuffle(program);
registerLoop(program);
registerRadio(program);
registerBrowse(program);
registerSearch(program);
registerSelect(program);
registerBack(program);
registerQueue(program);
registerGroup(program);
registerUngroup(program);
registerTransfer(program);
registerStandby(program);
registerAlbumArt(program);
registerSubscribe(program);

// Parse arguments
program.parse();
