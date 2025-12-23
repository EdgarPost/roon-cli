import { EventEmitter } from "events";
import type {
  Zone,
  Output,
  DaemonState,
  NowPlaying,
  PlayState,
  LoopMode,
  PositionEventData,
  StateEventData,
  TrackEventData,
  VolumeEventData,
  SettingsEventData,
  ZonesEventData,
  ConnectionEventData,
} from "../shared/types.js";

// Event types for TypeScript
export interface StateManagerEvents {
  position: (zoneId: string, data: PositionEventData) => void;
  state: (zoneId: string, data: StateEventData) => void;
  track: (zoneId: string, data: TrackEventData) => void;
  volume: (outputId: string, data: VolumeEventData) => void;
  settings: (zoneId: string, data: SettingsEventData) => void;
  zones: (data: ZonesEventData) => void;
  connection: (data: ConnectionEventData) => void;
}

/**
 * StateManager caches zone and output information from Roon subscriptions
 * and provides methods to query the current state.
 * Extends EventEmitter to emit granular events for subscriptions.
 */
export class StateManager extends EventEmitter {
  private zones: Map<string, Zone> = new Map();
  private outputs: Map<string, Output> = new Map();
  private connected: boolean = false;
  private paired: boolean = false;
  private coreName?: string;
  private coreId?: string;
  private changeListeners: Array<() => void> = [];

  /**
   * Update connection status
   */
  setConnectionStatus(connected: boolean, paired: boolean, coreName?: string, coreId?: string): void {
    const changed =
      this.connected !== connected ||
      this.paired !== paired ||
      this.coreName !== coreName ||
      this.coreId !== coreId;

    this.connected = connected;
    this.paired = paired;
    this.coreName = coreName;
    this.coreId = coreId;

    if (changed) {
      this.emit("connection", {
        connected,
        paired,
        coreName,
        coreId,
      } as ConnectionEventData);
    }

    this.notifyChange();
  }

  /**
   * Update zones from Roon transport subscription (initial load)
   */
  updateZones(data: any): void {
    if (!data) {
      return;
    }

    // Handle initial subscription with full zone list
    if (data.zones) {
      this.zones.clear();
      this.outputs.clear();
      for (const roonZone of data.zones) {
        this.addOrUpdateZone(roonZone);
      }
      // Emit zones event for initial load
      this.emit("zones", {
        type: "added",
        zones: this.getZones(),
      } as ZonesEventData);
    }

    // Handle zones_added
    if (data.zones_added) {
      const addedZones: Zone[] = [];
      for (const roonZone of data.zones_added) {
        const zone = this.parseZone(roonZone);
        this.zones.set(zone.zoneId, zone);
        for (const output of zone.outputs) {
          this.outputs.set(output.outputId, output);
        }
        addedZones.push(zone);
      }
      if (addedZones.length > 0) {
        this.emit("zones", {
          type: "added",
          zones: addedZones,
        } as ZonesEventData);
      }
    }

    // Handle zones_changed - detect specific changes
    if (data.zones_changed) {
      for (const roonZone of data.zones_changed) {
        const zoneId = roonZone.zone_id;
        const prevZone = this.zones.get(zoneId);
        const newZone = this.parseZone(roonZone);

        // Detect state change
        if (prevZone?.state !== newZone.state) {
          this.emit("state", zoneId, {
            state: newZone.state,
            isPlayAllowed: newZone.isPlayAllowed,
            isPauseAllowed: newZone.isPauseAllowed,
            isSeekAllowed: newZone.isSeekAllowed,
            isNextAllowed: newZone.isNextAllowed,
            isPreviousAllowed: newZone.isPreviousAllowed,
          } as StateEventData);
        }

        // Detect track change
        if (this.trackChanged(prevZone?.nowPlaying, newZone.nowPlaying)) {
          this.emit("track", zoneId, {
            artist: newZone.nowPlaying?.artist || "",
            track: newZone.nowPlaying?.track || "",
            album: newZone.nowPlaying?.album || "",
            imageKey: newZone.nowPlaying?.imageKey,
            length: newZone.nowPlaying?.length,
          } as TrackEventData);
        }

        // Detect settings change
        if (this.settingsChanged(prevZone?.settings, newZone.settings)) {
          this.emit("settings", zoneId, newZone.settings as SettingsEventData);
        }

        // Detect volume/mute changes for each output
        for (const output of newZone.outputs) {
          const prevOutput = prevZone?.outputs.find(
            (o) => o.outputId === output.outputId
          );
          if (this.volumeChanged(prevOutput?.volume, output.volume)) {
            this.emit("volume", output.outputId, {
              outputId: output.outputId,
              outputName: output.displayName,
              value: output.volume?.value,
              isMuted: output.volume?.isMuted || false,
              min: output.volume?.min,
              max: output.volume?.max,
            } as VolumeEventData);
          }
        }

        // Update stored zone
        this.zones.set(zoneId, newZone);
        for (const output of newZone.outputs) {
          this.outputs.set(output.outputId, output);
        }
      }
    }

    // Handle zones_removed
    if (data.zones_removed) {
      const removedIds: string[] = [];
      for (const zoneId of data.zones_removed) {
        const zone = this.zones.get(zoneId);
        if (zone) {
          for (const output of zone.outputs) {
            this.outputs.delete(output.outputId);
          }
        }
        this.zones.delete(zoneId);
        removedIds.push(zoneId);
      }
      if (removedIds.length > 0) {
        this.emit("zones", {
          type: "removed",
          zones: [],
          removedZoneIds: removedIds,
        } as ZonesEventData);
      }
    }

    // Handle zones_seek_changed (high frequency position updates)
    if (data.zones_seek_changed) {
      for (const seekData of data.zones_seek_changed) {
        const zone = this.zones.get(seekData.zone_id);
        if (zone) {
          // Update stored position
          if (zone.nowPlaying) {
            zone.nowPlaying.seekPosition = seekData.seek_position;
          }
          if (seekData.queue_time_remaining !== undefined) {
            zone.queueTimeRemaining = seekData.queue_time_remaining;
          }

          // Emit position event
          this.emit("position", seekData.zone_id, {
            seekPosition: seekData.seek_position,
            length: zone.nowPlaying?.length,
            queueTimeRemaining: seekData.queue_time_remaining,
          } as PositionEventData);
        }
      }
    }

    this.notifyChange();
  }

  /**
   * Check if track changed
   */
  private trackChanged(prev?: NowPlaying, next?: NowPlaying): boolean {
    if (!prev && !next) return false;
    if (!prev || !next) return true;
    return (
      prev.track !== next.track ||
      prev.artist !== next.artist ||
      prev.album !== next.album
    );
  }

  /**
   * Check if settings changed
   */
  private settingsChanged(
    prev?: Zone["settings"],
    next?: Zone["settings"]
  ): boolean {
    if (!prev && !next) return false;
    if (!prev || !next) return true;
    return (
      prev.loop !== next.loop ||
      prev.shuffle !== next.shuffle ||
      prev.autoRadio !== next.autoRadio
    );
  }

  /**
   * Check if volume changed
   */
  private volumeChanged(
    prev?: Output["volume"],
    next?: Output["volume"]
  ): boolean {
    if (!prev && !next) return false;
    if (!prev || !next) return true;
    return prev.value !== next.value || prev.isMuted !== next.isMuted;
  }

  /**
   * Add or update a zone
   */
  private addOrUpdateZone(roonZone: any): void {
    const zone = this.parseZone(roonZone);
    this.zones.set(zone.zoneId, zone);

    // Also add outputs to the outputs map
    for (const output of zone.outputs) {
      this.outputs.set(output.outputId, output);
    }
  }

  /**
   * Parse a Roon zone object into our Zone type
   */
  private parseZone(roonZone: any): Zone {
    const outputs: Output[] = (roonZone.outputs || []).map((roonOutput: any) =>
      this.parseOutput(roonOutput, roonZone.zone_id)
    );

    const nowPlaying = roonZone.now_playing ? this.parseNowPlaying(roonZone.now_playing) : undefined;
    const state = this.parsePlayState(roonZone.state);
    const settings = {
      loop: this.parseLoopMode(roonZone.settings?.loop),
      shuffle: roonZone.settings?.shuffle === true,
      autoRadio: roonZone.settings?.auto_radio === true,
    };

    return {
      zoneId: roonZone.zone_id,
      displayName: roonZone.display_name,
      state,
      outputs,
      nowPlaying,
      queueItemsRemaining: roonZone.queue_items_remaining,
      queueTimeRemaining: roonZone.queue_time_remaining,
      settings,
      isPlayAllowed: roonZone.is_play_allowed === true,
      isPauseAllowed: roonZone.is_pause_allowed === true,
      isSeekAllowed: roonZone.is_seek_allowed === true,
      isNextAllowed: roonZone.is_next_allowed === true,
      isPreviousAllowed: roonZone.is_previous_allowed === true,
    };
  }

  /**
   * Parse a Roon output object into our Output type
   */
  private parseOutput(roonOutput: any, zoneId: string): Output {
    let volume = undefined;
    if (roonOutput.volume) {
      volume = {
        type: roonOutput.volume.type || "number",
        value: roonOutput.volume.value,
        min: roonOutput.volume.min,
        max: roonOutput.volume.max,
        step: roonOutput.volume.step,
        isMuted: roonOutput.volume.is_muted === true,
      };
    }

    let sourceControls = undefined;
    if (roonOutput.source_controls) {
      sourceControls = roonOutput.source_controls.map((sc: any) => ({
        controlKey: sc.control_key,
        displayName: sc.display_name,
        supportsStandby: sc.supports_standby === true,
        status: sc.status,
      }));
    }

    return {
      outputId: roonOutput.output_id,
      displayName: roonOutput.display_name,
      zoneId,
      volume,
      canGroupWithOutputIds: roonOutput.can_group_with_output_ids,
      sourceControls,
    };
  }

  /**
   * Parse now playing information
   */
  private parseNowPlaying(nowPlaying: any): NowPlaying {
    return {
      artist: nowPlaying.three_line?.line2 || nowPlaying.two_line?.line2 || nowPlaying.one_line?.line1 || "Unknown Artist",
      track: nowPlaying.three_line?.line1 || nowPlaying.two_line?.line1 || nowPlaying.one_line?.line1 || "Unknown Track",
      album: nowPlaying.three_line?.line3 || "Unknown Album",
      imageKey: nowPlaying.image_key,
      seekPosition: nowPlaying.seek_position,
      length: nowPlaying.length,
    };
  }

  /**
   * Parse play state
   */
  private parsePlayState(state: string): PlayState {
    switch (state) {
      case "playing":
        return "playing";
      case "paused":
        return "paused";
      case "loading":
        return "loading";
      case "stopped":
        return "stopped";
      default:
        return "stopped";
    }
  }

  /**
   * Parse loop mode
   */
  private parseLoopMode(loop: string): LoopMode {
    switch (loop) {
      case "loop":
        return "loop";
      case "loop_one":
        return "loop_one";
      case "disabled":
        return "disabled";
      default:
        return "disabled";
    }
  }

  /**
   * Get all zones
   */
  getZones(): Zone[] {
    return Array.from(this.zones.values());
  }

  /**
   * Get a specific zone by ID or display name
   */
  getZone(zoneIdOrName: string): Zone | undefined {
    // Try by ID first
    let zone = this.zones.get(zoneIdOrName);
    if (zone) return zone;

    // Try by display name (case-insensitive)
    const lowerName = zoneIdOrName.toLowerCase();
    for (const z of this.zones.values()) {
      if (z.displayName.toLowerCase() === lowerName) {
        return z;
      }
    }

    return undefined;
  }

  /**
   * Get the first zone (useful for single-zone setups)
   */
  getFirstZone(): Zone | undefined {
    return this.zones.values().next().value;
  }

  /**
   * Get all outputs
   */
  getOutputs(): Output[] {
    return Array.from(this.outputs.values());
  }

  /**
   * Get a specific output by ID or display name
   */
  getOutput(outputIdOrName: string): Output | undefined {
    // Try by ID first
    let output = this.outputs.get(outputIdOrName);
    if (output) return output;

    // Try by display name (case-insensitive)
    const lowerName = outputIdOrName.toLowerCase();
    for (const o of this.outputs.values()) {
      if (o.displayName.toLowerCase() === lowerName) {
        return o;
      }
    }

    return undefined;
  }

  /**
   * Get the first output of a zone
   */
  getFirstOutputOfZone(zoneId: string): Output | undefined {
    const zone = this.zones.get(zoneId);
    return zone?.outputs[0];
  }

  /**
   * Get full daemon state
   */
  getState(): DaemonState {
    return {
      connected: this.connected,
      paired: this.paired,
      coreName: this.coreName,
      coreId: this.coreId,
      zones: this.getZones(),
      outputs: this.getOutputs(),
    };
  }

  /**
   * Check if connected and paired
   */
  isReady(): boolean {
    return this.connected && this.paired;
  }

  /**
   * Add a change listener
   */
  onChange(listener: () => void): void {
    this.changeListeners.push(listener);
  }

  /**
   * Remove a change listener
   */
  removeListener(listener: () => void): void {
    const index = this.changeListeners.indexOf(listener);
    if (index !== -1) {
      this.changeListeners.splice(index, 1);
    }
  }

  /**
   * Notify all listeners of state change
   */
  private notifyChange(): void {
    for (const listener of this.changeListeners) {
      try {
        listener();
      } catch (err) {
        console.error("Error in state change listener:", err);
      }
    }
  }
}
