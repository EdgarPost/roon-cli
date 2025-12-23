# roon-cli

A command-line interface for [Roon](https://roonlabs.com/) music player. Control playback, browse your library, and integrate with tools like Waybar.

## Features

- Full playback control (play, pause, stop, next, previous, seek)
- Volume and mute control
- Zone management
- Library browsing and search
- Queue management
- JSON output for scripting and status bars (Waybar, Polybar, etc.)
- Runs as a systemd user service

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   roon (CLI)    │────▶│  roon-daemon    │────▶│   Roon Core     │
│  (commands)     │ IPC │  (service)      │ WS  │   (network)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

**Two-process design:**
- **roon-daemon**: Long-running service that maintains connection to Roon Core
- **roon CLI**: Lightweight client that sends commands via Unix socket

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

### Install globally (optional)

```bash
npm install -g .
```

Or link the binaries:

```bash
ln -s $(pwd)/dist/daemon.cjs ~/.local/bin/roon-daemon
ln -s $(pwd)/dist/cli.cjs ~/.local/bin/roon
```

## Quick Start

1. **Start the daemon:**
   ```bash
   node dist/daemon.cjs
   # Or if installed globally:
   roon-daemon
   ```

2. **Authorize in Roon:**
   - Open Roon → Settings → Extensions
   - Find "Roon CLI" and click "Enable"

3. **Use the CLI:**
   ```bash
   roon zones          # List available zones
   roon zone set "Living Room"  # Set default zone
   roon play           # Start playback
   roon status         # Show what's playing
   ```

## Commands

### Playback Control

```bash
roon play [--zone <zone>]       # Start playback
roon pause [--zone <zone>]      # Pause playback
roon playpause [--zone <zone>]  # Toggle play/pause
roon stop [--zone <zone>]       # Stop playback
roon next [--zone <zone>]       # Next track
roon prev [--zone <zone>]       # Previous track
roon seek <seconds>             # Seek to position (absolute)
roon seek +30                   # Seek forward 30 seconds
roon seek -10                   # Seek backward 10 seconds
```

### Volume Control

```bash
roon volume 50 [--output <output>]   # Set volume to 50
roon volume +5                        # Increase by 5
roon volume -3                        # Decrease by 3
roon mute [--output <output>]        # Mute
roon unmute [--output <output>]      # Unmute
```

### Status & Zones

```bash
roon status [--zone <zone>]     # Show now playing
roon status --json              # JSON output (for Waybar)
roon zones                      # List all zones
roon zone                       # Show zones with default marked
roon zone set <name>            # Set default zone
roon zone clear                 # Clear default zone
roon outputs                    # List all outputs
```

### Playback Settings

```bash
roon shuffle [on|off]           # Toggle or set shuffle
roon loop [loop|loop_one|off]   # Set loop mode
roon radio [on|off]             # Toggle Roon Radio
```

### Library & Search

```bash
roon browse                     # Browse library root
roon browse artists             # Browse artists
roon browse albums              # Browse albums
roon browse playlists           # Browse playlists
roon search "miles davis"       # Search library
roon select 1                   # Select item #1 from results
roon select --key <item_key>    # Select by item key
roon queue                      # Show current queue
```

### Workflow Example

```bash
# Search for an artist
roon search "king gizzard"
#  1. King Gizzard & the Lizard Wizard - 23 Albums →
#  2. Artists - 99 Results →
#  ...

# Select the artist to see their albums
roon select 1
#  1. Nonagon Infinity ▶
#  2. Polygondwanaland ▶
#  ...

# Play an album
roon select 2
```

**Icons:**
- `▶` = Playable (selecting starts playback)
- `→` = List (selecting shows more items)
- `▶…` = Action list (shows options like "Play Now", "Add to Queue")

### JSON Output

All data commands support `--json` / `-j` for scripting:

```bash
roon status --json
roon zones -j
roon search "query" --json
```

## Configuration

Configuration file: `~/.config/roon-cli/config.json`

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
| `coreHost` | Direct connection to Roon Core (skips discovery) |
| `corePort` | Roon Core port (default: 9100) |
| `socketPath` | Unix socket path for IPC |

## Systemd Service

### Install the service

```bash
mkdir -p ~/.config/systemd/user
cp systemd/roon-daemon.service ~/.config/systemd/user/

# Edit the service file to set the correct path:
# ExecStart=/path/to/roon-cli/dist/daemon.cjs

systemctl --user daemon-reload
systemctl --user enable roon-daemon
systemctl --user start roon-daemon
```

### Check status

```bash
systemctl --user status roon-daemon
journalctl --user -u roon-daemon -f
```

## Waybar Integration

Add to your Waybar config:

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

The JSON output includes:
```json
{
  "text": "Artist - Track",
  "tooltip": "Track\nby Artist\nfrom Album\n\nState: playing\nTime: 2:34 / 5:12",
  "class": "playing",
  "percentage": 49,
  "alt": "playing"
}
```

CSS classes: `playing`, `paused`, `stopped`, `loading`

## Development

```bash
# Run daemon in development mode
npm run dev:daemon

# Run CLI commands in development mode
npm run dev:cli -- status
npm run dev:cli -- search "query"

# Build
npm run build
```

## Troubleshooting

### "Not connected to Roon Core"

1. Make sure the daemon is running
2. Check if Roon Core is on the network
3. Authorize the extension in Roon → Settings → Extensions

### "Zone not found"

1. Run `roon zones` to see available zones
2. Set a default zone: `roon zone set "Zone Name"`

### Daemon keeps disconnecting

This is normal during Roon Core restarts or network changes. The daemon will automatically reconnect.

### Check daemon logs

```bash
# If running manually
node dist/daemon.cjs

# If running as service
journalctl --user -u roon-daemon -f
```

## License

MIT
