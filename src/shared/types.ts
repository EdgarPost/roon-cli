// Roon zone state
export type PlayState = "playing" | "paused" | "loading" | "stopped";
export type LoopMode = "loop" | "loop_one" | "disabled";

export interface NowPlaying {
  artist: string;
  track: string;
  album: string;
  imageKey?: string;
  seekPosition?: number;
  length?: number;
}

export interface Output {
  outputId: string;
  displayName: string;
  zoneId: string;
  volume?: {
    type: "number" | "db" | "incremental";
    value?: number;
    min?: number;
    max?: number;
    step?: number;
    isMuted: boolean;
  };
  canGroupWithOutputIds?: string[];
  sourceControls?: Array<{
    controlKey: string;
    displayName: string;
    supportsStandby: boolean;
    status: "selected" | "standby" | "deselected" | "indeterminate";
  }>;
}

export interface Zone {
  zoneId: string;
  displayName: string;
  state: PlayState;
  outputs: Output[];
  nowPlaying?: NowPlaying;
  queueItemsRemaining?: number;
  queueTimeRemaining?: number;
  settings: {
    loop: LoopMode;
    shuffle: boolean;
    autoRadio: boolean;
  };
  isPlayAllowed: boolean;
  isPauseAllowed: boolean;
  isSeekAllowed: boolean;
  isNextAllowed: boolean;
  isPreviousAllowed: boolean;
}

// Browse types
export interface BrowseItem {
  itemKey: string;
  title: string;
  subtitle?: string;
  imageKey?: string;
  hint?: "action" | "action_list" | "list" | "header";
}

export interface BrowseList {
  title: string;
  count: number;
  level: number;
  subtitle?: string;
  imageKey?: string;
  displayOffset?: number;
}

export interface BrowseResult {
  action: "list" | "message" | "none";
  list?: BrowseList;
  items: BrowseItem[];
  message?: string;
}

// Queue item
export interface QueueItem {
  queueItemId: number;
  length: number;
  imageKey?: string;
  oneLine: { line1: string };
  twoLine: { line1: string; line2: string };
  threeLine: { line1: string; line2: string; line3: string };
}

// Daemon state
export interface DaemonState {
  connected: boolean;
  paired: boolean;
  coreName?: string;
  coreId?: string;
  zones: Zone[];
  outputs: Output[];
}

// Config
export interface Config {
  defaultZone?: string;
  coreHost?: string;
  corePort?: number;
  socketPath?: string;
}

// Waybar output format
export interface WaybarOutput {
  text: string;
  tooltip: string;
  class: string;
  percentage?: number;
  alt?: string;
}
