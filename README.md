# roon-cli

A command-line interface for [Roon](https://roonlabs.com/) music player. Control playback, browse your library, and integrate with tools like Waybar/Hyprland.

## Features

- **Playback control**: play, pause, stop, next, previous, seek
- **Volume control**: absolute/relative volume, mute/unmute
- **Zone management**: list zones, set default, group/ungroup outputs, transfer playback
- **Library browsing**: browse artists, albums, playlists, genres
- **Search**: search library and play results directly
- **Queue**: view and manage playback queue
- **Settings**: shuffle, loop, Roon Radio
- **Album art**: fetch album artwork in various sizes and formats
- **Real-time events**: subscribe to playback state, position, track changes
- **JSON output**: all commands support `--json` for scripting and status bars
- **Systemd service**: runs as a user service for always-on control

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   roon (CLI)    │────▶│  roon-daemon    │────▶│   Roon Core     │
│  (commands)     │ IPC │  (service)      │ WS  │   (network)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

- **roon-daemon**: Long-running service that maintains connection to Roon Core via WebSocket
- **roon CLI**: Lightweight client that sends commands via Unix socket IPC

## Installation

### Prerequisites

- Node.js 18+ (not required for Nix)
- A running Roon Core on your network

### One-liner install (Linux/macOS)

```bash
curl -fsSL https://raw.githubusercontent.com/EdgarPost/roon-cli/main/install.sh | bash
```

This installs to `~/.local/share/roon-cli` and creates symlinks in `~/.local/bin`.

### Nix / NixOS

```bash
# Try it out
nix run github:EdgarPost/roon-cli -- --help

# Install to profile
nix profile install github:EdgarPost/roon-cli

# Or add to flake.nix inputs
{
  inputs.roon-cli.url = "github:EdgarPost/roon-cli";
}
```

**Home-manager module** (optional):

```nix
{
  imports = [ inputs.roon-cli.homeManagerModules.default ];
  services.roon-cli.enable = true;
}
```

### Build from source

```bash
git clone https://github.com/EdgarPost/roon-cli.git
cd roon-cli
npm install
npm run build
```

### Install globally

```bash
# Option 1: npm global install
npm install -g .

# Option 2: symlink to local bin
ln -s $(pwd)/dist/daemon.cjs ~/.local/bin/roon-daemon
ln -s $(pwd)/dist/cli.cjs ~/.local/bin/roon
```

## Quick Start

```bash
# 1. Start the daemon
node dist/daemon.cjs

# 2. Authorize in Roon
#    Open Roon → Settings → Extensions → Enable "Roon CLI"

# 3. Use the CLI
roon zones                      # List available zones
roon zone set "Living Room"     # Set default zone
roon play                       # Start playback
roon status                     # Show what's playing
```

## Command Reference

### Playback

| Command | Description |
|---------|-------------|
| `roon play` | Start playback |
| `roon pause` | Pause playback |
| `roon playpause` | Toggle play/pause |
| `roon stop` | Stop playback |
| `roon next` | Next track |
| `roon prev` | Previous track |
| `roon seek <seconds>` | Seek to absolute position |
| `roon seek +30` | Seek forward 30 seconds |
| `roon seek -10` | Seek backward 10 seconds |

All playback commands accept `--zone <zone>` to target a specific zone.

### Volume

| Command | Description |
|---------|-------------|
| `roon volume -o "Living Room" 50` | Set volume to 50 |
| `roon volume -o "Living Room" +5` | Increase volume by 5 |
| `roon volume -o "Living Room" -3` | Decrease volume by 3 |
| `roon mute -o "Living Room"` | Mute output |
| `roon unmute -o "Living Room"` | Unmute output |

Volume commands require `--output <output>` (`-o`) to specify the target output.

### Status & Information

| Command | Description |
|---------|-------------|
| `roon status` | Show now playing info |
| `roon status --json` | JSON output for Waybar |
| `roon zones` | List all zones |
| `roon zone` | Show zones with default marked |
| `roon zone set <name>` | Set default zone |
| `roon zone clear` | Clear default zone |
| `roon outputs` | List all outputs |
| `roon queue` | Show current queue |

### Zone Management

| Command | Description |
|---------|-------------|
| `roon group <out1> <out2> [...]` | Group outputs into one zone |
| `roon ungroup <output> [...]` | Ungroup outputs |
| `roon transfer <from> <to>` | Move queue to another zone |
| `roon standby <output>` | Put output in standby |

### Playback Settings

| Command | Description |
|---------|-------------|
| `roon shuffle` | Toggle shuffle |
| `roon shuffle on` | Enable shuffle |
| `roon shuffle off` | Disable shuffle |
| `roon loop` | Cycle loop modes |
| `roon loop loop` | Loop queue |
| `roon loop loop_one` | Loop current track |
| `roon loop off` | Disable loop |
| `roon radio on` | Enable Roon Radio |
| `roon radio off` | Disable Roon Radio |

### Library & Search

| Command | Description |
|---------|-------------|
| `roon browse` | Browse library root |
| `roon browse artists` | Browse artists |
| `roon browse albums` | Browse albums |
| `roon browse playlists` | Browse playlists |
| `roon browse genres` | Browse genres |
| `roon search <query>` | Search library |
| `roon select <number>` | Select item from results |
| `roon select --key <key>` | Select by item key |
| `roon back` | Go back one level |
| `roon back <n>` | Go back n levels |

### Search & Play Workflow

```bash
# Search for music
roon search "king gizzard"
#  1. King Gizzard & the Lizard Wizard - 23 Albums →
#  2. Artists - 99 Results →
#  3. Albums - 73 Results →

# Drill into the artist
roon select 1
#  1. Nonagon Infinity ▶
#  2. Polygondwanaland ▶
#  3. Flying Microtonal Banana ▶

# Play an album
roon select 2
# → Playback starts

# Go back to see more albums
roon back
```

**Result icons:**
- `▶` = Playable (selecting starts playback)
- `→` = List (selecting shows more items)
- `▶…` = Action list (shows options like "Play Now", "Add to Queue")

### Album Art

| Command | Description |
|---------|-------------|
| `roon album-art` | Get album art for current track |
| `roon album-art -o cover.jpg` | Save album art to file |
| `roon album-art --json` | Output as JSON with base64 data |
| `roon album-art -s 500` | Specify size (default: 300px) |
| `roon album-art -k <imageKey>` | Get art by specific image key |
| `roon album-art --format png` | Get PNG instead of JPEG |

### Real-time Events

| Command | Description |
|---------|-------------|
| `roon subscribe` | Subscribe to default events (state, track, position) |
| `roon subscribe -e state,track` | Subscribe to specific events |
| `roon subscribe -z "Living Room"` | Filter to specific zone |
| `roon subscribe --json` | Output events as JSON |

Event types: `position`, `state`, `track`, `volume`, `settings`, `zones`, `connection`

### JSON Output

All data-returning commands support `--json` / `-j`:

```bash
roon status --json          # Now playing as JSON
roon zones --json           # Zones list as JSON
roon search "query" --json  # Search results as JSON
roon queue --json           # Queue as JSON
roon album-art --json       # Album art as base64 JSON
```

## Configuration

Config file: `~/.config/roon-cli/config.json`

```json
{
  "defaultZone": "Living Room",
  "coreHost": null,
  "corePort": 9100,
  "socketPath": "/tmp/roon-cli.sock"
}
```

| Option | Description |
|--------|-------------|
| `defaultZone` | Default zone for commands (set via `roon zone set`) |
| `coreHost` | Direct connection IP (skips auto-discovery) |
| `corePort` | Roon Core port (default: 9100) |
| `socketPath` | Unix socket path for daemon IPC |

## Systemd Service

### Install

```bash
mkdir -p ~/.config/systemd/user
cp systemd/roon-daemon.service ~/.config/systemd/user/

# Edit ExecStart path in the service file
nano ~/.config/systemd/user/roon-daemon.service

systemctl --user daemon-reload
systemctl --user enable --now roon-daemon
```

### Manage

```bash
systemctl --user status roon-daemon    # Check status
systemctl --user restart roon-daemon   # Restart
journalctl --user -u roon-daemon -f    # View logs
```

## Waybar Integration

Add to your Waybar config (`~/.config/waybar/config`):

```json
"custom/roon": {
    "exec": "roon status --json",
    "return-type": "json",
    "interval": 5,
    "on-click": "roon playpause",
    "on-click-right": "roon next",
    "on-scroll-up": "roon volume +2",
    "on-scroll-down": "roon volume -2"
}
```

JSON output format:

```json
{
  "text": "Artist - Track",
  "tooltip": "Track\nby Artist\nfrom Album\n\nState: playing\nTime: 2:34 / 5:12",
  "class": "playing",
  "percentage": 49,
  "alt": "playing"
}
```

Style in `~/.config/waybar/style.css`:

```css
#custom-roon {
    padding: 0 10px;
}
#custom-roon.playing {
    color: #a6e3a1;
}
#custom-roon.paused {
    color: #f9e2af;
}
#custom-roon.stopped {
    color: #6c7086;
}
```

## TUI/GUI Integration

The daemon exposes a Unix socket IPC interface that TUIs and GUIs can use directly for real-time updates and control.

### Socket Protocol

The daemon listens on `/tmp/roon-cli.sock` (configurable). Protocol is JSON-RPC style with newline-delimited messages.

**Request format:**
```json
{"id": "unique-id", "method": "play", "params": {"zone": "Living Room"}}
```

**Response format:**
```json
{"id": "unique-id", "result": {"success": true}}
```

**Error format:**
```json
{"id": "unique-id", "error": {"code": 1, "message": "Not connected to Roon Core"}}
```

### Real-time Event Streaming

Subscribe to receive push events without polling:

**Subscribe request:**
```json
{
  "id": "sub-1",
  "method": "subscribe",
  "params": {
    "events": ["position", "state", "track", "volume", "settings"],
    "zones": ["Living Room"]
  }
}
```

**Events pushed to client (no `id` field - distinguishes from responses):**
```json
{"event": "position", "data": {"seekPosition": 45, "length": 180}, "zoneId": "zone-123", "timestamp": 1703356800000}
{"event": "state", "data": {"state": "playing", "isPlayAllowed": false, "isPauseAllowed": true}, "zoneId": "zone-123", "timestamp": 1703356800001}
{"event": "track", "data": {"artist": "King Gizzard", "track": "Robot Stop", "album": "Nonagon Infinity", "imageKey": "abc123", "length": 180}, "zoneId": "zone-123", "timestamp": 1703356800002}
{"event": "volume", "data": {"outputId": "out-1", "outputName": "Living Room", "value": 50, "isMuted": false}, "zoneId": "zone-123", "timestamp": 1703356800003}
{"event": "settings", "data": {"loop": "disabled", "shuffle": false, "autoRadio": true}, "zoneId": "zone-123", "timestamp": 1703356800004}
```

### Event Types

| Event | Frequency | Data |
|-------|-----------|------|
| `position` | ~1/second | `seekPosition`, `length`, `queueTimeRemaining` |
| `state` | On change | `state`, `isPlayAllowed`, `isPauseAllowed`, etc. |
| `track` | On change | `artist`, `track`, `album`, `imageKey`, `length` |
| `volume` | On change | `outputId`, `outputName`, `value`, `isMuted` |
| `settings` | On change | `loop`, `shuffle`, `autoRadio` |
| `zones` | On change | `type` (added/removed), `zones`, `removedZoneIds` |
| `connection` | On change | `connected`, `paired`, `coreName`, `coreId` |

### Album Art Retrieval

```json
{"id": "art-1", "method": "album-art", "params": {"imageKey": "abc123", "scale": "fit", "width": 300, "height": 300, "format": "image/jpeg"}}
```

Response contains base64-encoded image:
```json
{"id": "art-1", "result": {"contentType": "image/jpeg", "data": "/9j/4AAQSkZJRg..."}}
```

### TypeScript/JavaScript Integration

```typescript
import { SubscriptionClient, send } from "roon-cli/client";

// One-off commands
const zones = await send("zones");
const art = await send("album-art", { imageKey: "abc123", width: 200, height: 200 });

// Real-time subscription
const client = new SubscriptionClient();
await client.subscribe({
  events: ["position", "state", "track", "volume", "settings"],
  zones: ["Living Room"]
});

client.on("position", (data, zoneId, timestamp) => {
  updateProgressBar(data.seekPosition, data.length);
});

client.on("track", (data, zoneId, timestamp) => {
  updateNowPlaying(data);
  fetchAlbumArt(data.imageKey);
});

client.on("state", (data, zoneId, timestamp) => {
  updatePlaybackState(data.state);
});

// Clean up
await client.unsubscribe();
```

### Available IPC Methods

| Method | Params | Description |
|--------|--------|-------------|
| `status` | - | Get daemon connection status |
| `zones` | - | List all zones |
| `zone` | `zone?` | Get specific zone state |
| `outputs` | - | List all outputs |
| `play` | `zone?` | Start playback |
| `pause` | `zone?` | Pause playback |
| `playpause` | `zone?` | Toggle play/pause |
| `stop` | `zone?` | Stop playback |
| `next` | `zone?` | Next track |
| `previous` | `zone?` | Previous track |
| `seek` | `zone?`, `seconds`, `relative?` | Seek position |
| `volume` | `output`, `value`, `relative?` | Change volume |
| `mute` | `output` | Mute output |
| `unmute` | `output` | Unmute output |
| `shuffle` | `zone?`, `enabled?` | Toggle/set shuffle |
| `loop` | `zone?`, `mode?` | Cycle/set loop mode |
| `radio` | `zone?`, `enabled?` | Toggle/set Roon Radio |
| `browse` | `hierarchy?`, `itemKey?`, etc. | Browse library |
| `search` | `query`, `zone?` | Search library |
| `select` | `index` or `itemKey`, `zone?` | Select browse item |
| `back` | `levels?`, `zone?` | Go back in browse |
| `queue` | `zone?` | Get queue items |
| `group` | `outputs[]` | Group outputs |
| `ungroup` | `outputs[]` | Ungroup outputs |
| `transfer` | `from`, `to` | Transfer queue |
| `standby` | `output` | Standby output |
| `subscribe` | `events[]`, `zones?[]` | Subscribe to events |
| `unsubscribe` | - | Unsubscribe |
| `album-art` | `imageKey`, `scale?`, `width?`, `height?`, `format?` | Get album art |

### Error Codes

| Code | Name | Description |
|------|------|-------------|
| 1 | `NOT_CONNECTED` | Not connected to Roon Core |
| 2 | `NOT_PAIRED` | Not paired with Roon Core |
| 3 | `ZONE_NOT_FOUND` | Zone not found |
| 4 | `OUTPUT_NOT_FOUND` | Output not found |
| 5 | `INVALID_PARAMS` | Invalid parameters |
| 6 | `ROON_ERROR` | Roon API error |
| 7 | `BROWSE_ERROR` | Browse operation failed |
| 8 | `IMAGE_NOT_FOUND` | Image not found |
| 99 | `UNKNOWN` | Unknown error |

## Development

```bash
# Run daemon in dev mode (auto-reload)
npm run dev:daemon

# Run CLI commands in dev mode
npm run dev:cli -- status
npm run dev:cli -- search "query"
npm run dev:cli -- select 1

# Build for production
npm run build
```

## Troubleshooting

### "Not connected to Roon Core"

1. Ensure daemon is running: `systemctl --user status roon-daemon`
2. Check Roon Core is on the network
3. Enable extension: Roon → Settings → Extensions → "Roon CLI"

### "Zone not found"

```bash
roon zones                    # See available zones
roon zone set "Zone Name"     # Set default
```

### Daemon disconnects frequently

This is normal during Roon Core restarts. The daemon auto-reconnects. Check logs:

```bash
journalctl --user -u roon-daemon -f
```

### Search shows old results

The daemon caches browse state. New searches reset automatically, but you can also:

```bash
roon back 10    # Go back to root
roon search "new query"
```

## License

MIT
