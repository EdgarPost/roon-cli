import type {
  Zone,
  Output,
  BrowseResult,
  BrowseItem,
  QueueItem,
  WaybarOutput,
} from "../shared/types.js";

export function formatStatus(zone: Zone | null, json: boolean = false): string {
  if (!zone) {
    return json
      ? JSON.stringify({ text: "", tooltip: "No zone active", class: "stopped" })
      : "No zone found";
  }

  if (json) {
    return formatWaybar(zone);
  }

  const lines: string[] = [];

  // Zone info
  lines.push(`Zone: ${zone.displayName}`);
  lines.push(`State: ${zone.state}`);

  // Now playing
  if (zone.nowPlaying) {
    lines.push("");
    lines.push(`Artist: ${zone.nowPlaying.artist}`);
    lines.push(`Track:  ${zone.nowPlaying.track}`);
    lines.push(`Album:  ${zone.nowPlaying.album}`);

    // Album art URL
    if (zone.nowPlaying.albumArtUrl) {
      lines.push(`Art:    ${zone.nowPlaying.albumArtUrl}`);
    }

    // Progress bar
    if (zone.nowPlaying.seekPosition !== undefined && zone.nowPlaying.length) {
      const progress = formatProgress(
        zone.nowPlaying.seekPosition,
        zone.nowPlaying.length
      );
      lines.push("");
      lines.push(progress);
    }
  }

  // Settings
  lines.push("");
  lines.push(`Shuffle: ${zone.settings.shuffle ? "on" : "off"}`);
  lines.push(`Loop:    ${zone.settings.loop}`);
  lines.push(`Radio:   ${zone.settings.autoRadio ? "on" : "off"}`);

  // Queue info
  if (zone.queueItemsRemaining !== undefined && zone.queueItemsRemaining > 0) {
    lines.push("");
    lines.push(`Queue:   ${zone.queueItemsRemaining} items remaining`);
    if (zone.queueTimeRemaining) {
      lines.push(`         ${formatTime(zone.queueTimeRemaining)} remaining`);
    }
  }

  return lines.join("\n");
}

export function formatWaybar(zone: Zone): string {
  const output: WaybarOutput = {
    text: "",
    tooltip: "",
    class: zone.state,
  };

  if (zone.nowPlaying) {
    const { artist, track, seekPosition, length, albumArtUrl } = zone.nowPlaying;

    // Main text - truncate if needed
    output.text = `${artist} - ${track}`;
    if (output.text.length > 50) {
      output.text = output.text.substring(0, 47) + "...";
    }

    // Tooltip with full info
    const tooltipLines = [
      `${track}`,
      `by ${artist}`,
      zone.nowPlaying.album ? `from ${zone.nowPlaying.album}` : "",
      "",
      `State: ${zone.state}`,
    ];

    if (seekPosition !== undefined && length) {
      tooltipLines.push(
        `Time: ${formatTime(seekPosition)} / ${formatTime(length)}`
      );
      output.percentage = Math.round((seekPosition / length) * 100);
    }

    output.tooltip = tooltipLines.filter(Boolean).join("\n");
    output.alt = zone.state;

    // Include album art URL
    if (albumArtUrl) {
      output.albumArtUrl = albumArtUrl;
    }
  } else {
    output.text = zone.displayName;
    output.tooltip = `Zone: ${zone.displayName}\nState: ${zone.state}`;
  }

  return JSON.stringify(output);
}

export function formatZones(zones: Zone[]): string {
  if (zones.length === 0) {
    return "No zones available";
  }

  const lines: string[] = [];

  for (const zone of zones) {
    lines.push(`\n${zone.displayName} (${zone.state})`);
    lines.push(`  ID: ${zone.zoneId}`);

    if (zone.nowPlaying) {
      lines.push(`  Now playing: ${zone.nowPlaying.artist} - ${zone.nowPlaying.track}`);
    }

    lines.push(`  Outputs: ${zone.outputs.length}`);
    for (const output of zone.outputs) {
      const volumeStr = output.volume
        ? ` - ${output.volume.isMuted ? "muted" : `vol ${output.volume.value}`}`
        : "";
      lines.push(`    - ${output.displayName}${volumeStr}`);
    }
  }

  return lines.join("\n");
}

export function formatOutputs(outputs: Output[]): string {
  if (outputs.length === 0) {
    return "No outputs available";
  }

  const lines: string[] = [];

  for (const output of outputs) {
    lines.push(`\n${output.displayName}`);
    lines.push(`  ID:   ${output.outputId}`);
    lines.push(`  Zone: ${output.zoneId}`);

    if (output.volume) {
      const vol = output.volume;
      const volStr = vol.value !== undefined ? vol.value.toString() : "N/A";
      const muteStr = vol.isMuted ? " (muted)" : "";
      lines.push(`  Volume: ${volStr}${muteStr}`);

      if (vol.min !== undefined && vol.max !== undefined) {
        lines.push(`  Range: ${vol.min} - ${vol.max}`);
      }
    }
  }

  return lines.join("\n");
}

export function formatBrowse(result: BrowseResult, showKeys: boolean = true): string {
  if (result.action === "message" && result.message) {
    return result.message;
  }

  const lines: string[] = [];

  if (result.list) {
    lines.push(`${result.list.title}`);
    if (result.list.subtitle) {
      lines.push(`  ${result.list.subtitle}`);
    }
    lines.push(`  Level ${result.list.level} - ${result.list.count} items`);
    lines.push("");
  }

  if (result.items.length === 0) {
    lines.push("No items found");
  } else {
    for (let i = 0; i < result.items.length; i++) {
      const item = result.items[i];
      lines.push(formatBrowseItem(item, i + 1, showKeys));
    }
  }

  if (showKeys && result.items.length > 0) {
    lines.push("");
    lines.push("Use 'roon select <number>' or 'roon select --key <item_key>' to select an item");
  }

  return lines.join("\n");
}

function formatBrowseItem(item: BrowseItem, index: number, showKey: boolean): string {
  const num = index.toString().padStart(2, " ");
  let str = `${num}. ${item.title}`;

  if (item.subtitle) {
    str += ` - ${item.subtitle}`;
  }

  if (item.hint) {
    const hintIcon = item.hint === "action" ? "▶" :
                     item.hint === "action_list" ? "▶…" :
                     item.hint === "list" ? "→" : "";
    if (hintIcon) {
      str += ` ${hintIcon}`;
    }
  }

  return str;
}

export function formatQueue(items: QueueItem[]): string {
  if (items.length === 0) {
    return "Queue is empty";
  }

  const lines: string[] = [];
  lines.push(`Queue (${items.length} items):\n`);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const num = (i + 1).toString().padStart(3, " ");
    const time = formatTime(item.length);

    lines.push(`${num}. ${item.threeLine.line1}`);
    lines.push(`     ${item.threeLine.line2}`);
    if (item.threeLine.line3) {
      lines.push(`     ${item.threeLine.line3} - ${time}`);
    } else {
      lines.push(`     ${time}`);
    }

    if (i < items.length - 1) {
      lines.push("");
    }
  }

  return lines.join("\n");
}

function formatProgress(position: number, total: number): string {
  const percentage = total > 0 ? position / total : 0;
  const barLength = 40;
  const filled = Math.round(barLength * percentage);
  const empty = barLength - filled;

  const bar = "█".repeat(filled) + "░".repeat(empty);
  const current = formatTime(position);
  const duration = formatTime(total);

  return `${current} ${bar} ${duration}`;
}

export function formatTime(seconds: number): string {
  if (!seconds || seconds < 0) {
    return "0:00";
  }

  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
