import type { Zone, Output, DaemonState, NowPlaying, PlayState, LoopMode } from "../shared/types.js";

/**
 * StateManager caches zone and output information from Roon subscriptions
 * and provides methods to query the current state.
 */
export class StateManager {
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
    this.connected = connected;
    this.paired = paired;
    this.coreName = coreName;
    this.coreId = coreId;
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
    }

    // Handle zones_added
    if (data.zones_added) {
      for (const roonZone of data.zones_added) {
        this.addOrUpdateZone(roonZone);
      }
    }

    // Handle zones_changed
    if (data.zones_changed) {
      for (const roonZone of data.zones_changed) {
        this.addOrUpdateZone(roonZone);
      }
    }

    // Handle zones_removed
    if (data.zones_removed) {
      for (const zoneId of data.zones_removed) {
        const zone = this.zones.get(zoneId);
        if (zone) {
          for (const output of zone.outputs) {
            this.outputs.delete(output.outputId);
          }
        }
        this.zones.delete(zoneId);
      }
    }

    // Handle zones_seek_changed (just update seek position)
    if (data.zones_seek_changed) {
      for (const seekData of data.zones_seek_changed) {
        const zone = this.zones.get(seekData.zone_id);
        if (zone && zone.nowPlaying) {
          zone.nowPlaying.seekPosition = seekData.seek_position;
          if (seekData.queue_time_remaining !== undefined) {
            zone.queueTimeRemaining = seekData.queue_time_remaining;
          }
        }
      }
    }

    this.notifyChange();
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
