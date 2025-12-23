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

- Node.js 18+
- A running Roon Core on your network

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
| `roon volume 50` | Set volume to 50 |
| `roon volume +5` | Increase volume by 5 |
| `roon volume -3` | Decrease volume by 3 |
| `roon mute` | Mute output |
| `roon unmute` | Unmute output |

Volume commands accept `--output <output>` to target a specific output.

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

### JSON Output

All data-returning commands support `--json` / `-j`:

```bash
roon status --json          # Now playing as JSON
roon zones --json           # Zones list as JSON
roon search "query" --json  # Search results as JSON
roon queue --json           # Queue as JSON
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
