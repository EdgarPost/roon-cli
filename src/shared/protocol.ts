import type {
  Zone,
  Output,
  DaemonState,
  BrowseResult,
  QueueItem,
} from "./types.js";

// IPC Request/Response protocol
export interface IPCRequest {
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

export interface IPCResponse {
  id: string;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

// Error codes
export const ErrorCodes = {
  NOT_CONNECTED: 1,
  NOT_PAIRED: 2,
  ZONE_NOT_FOUND: 3,
  OUTPUT_NOT_FOUND: 4,
  INVALID_PARAMS: 5,
  ROON_ERROR: 6,
  BROWSE_ERROR: 7,
  IMAGE_NOT_FOUND: 8,
  UNKNOWN: 99,
} as const;

// Subscription event types
export type SubscriptionEventType =
  | "position"
  | "state"
  | "track"
  | "volume"
  | "settings"
  | "zones"
  | "connection";

// Event message (pushed to subscribers)
export interface IPCEvent {
  event: SubscriptionEventType;
  data: unknown;
  zoneId?: string;
  timestamp: number;
}

// Subscribe request params
export interface SubscribeParams {
  events: SubscriptionEventType[];
  zones?: string[]; // Zone IDs or names to filter (empty = all zones)
}

// Subscribe result
export interface SubscribeResult {
  subscribed: boolean;
  events: SubscriptionEventType[];
  zones: string[]; // Resolved zone IDs
}

// Method definitions
export type Methods = {
  // Connection status
  status: {
    params: undefined;
    result: DaemonState;
  };

  // Transport controls
  play: {
    params: { zone?: string };
    result: { success: boolean };
  };
  pause: {
    params: { zone?: string };
    result: { success: boolean };
  };
  playpause: {
    params: { zone?: string };
    result: { success: boolean };
  };
  stop: {
    params: { zone?: string };
    result: { success: boolean };
  };
  next: {
    params: { zone?: string };
    result: { success: boolean };
  };
  previous: {
    params: { zone?: string };
    result: { success: boolean };
  };
  seek: {
    params: { zone?: string; seconds: number; relative?: boolean };
    result: { success: boolean };
  };

  // Volume
  volume: {
    params: { output: string; value: number; relative?: boolean };
    result: { success: boolean };
  };
  mute: {
    params: { output: string };
    result: { success: boolean };
  };
  unmute: {
    params: { output: string };
    result: { success: boolean };
  };

  // Zones
  zones: {
    params: undefined;
    result: Zone[];
  };
  zone: {
    params: { zone?: string };
    result: Zone | null;
  };
  outputs: {
    params: undefined;
    result: Output[];
  };

  // Settings
  shuffle: {
    params: { zone?: string; enabled?: boolean };
    result: { success: boolean; enabled: boolean };
  };
  loop: {
    params: { zone?: string; mode?: "loop" | "loop_one" | "disabled" | "next" };
    result: { success: boolean; mode: string };
  };
  radio: {
    params: { zone?: string; enabled?: boolean };
    result: { success: boolean; enabled: boolean };
  };

  // Browsing
  browse: {
    params: {
      hierarchy?: string;
      itemKey?: string;
      input?: string;
      zone?: string;
      popAll?: boolean;
      popLevels?: number;
      refresh?: boolean;
      offset?: number;
      count?: number;
    };
    result: BrowseResult;
  };
  search: {
    params: { query: string; zone?: string };
    result: BrowseResult;
  };

  // Queue
  queue: {
    params: { zone?: string };
    result: QueueItem[];
  };

  // Subscriptions
  subscribe: {
    params: SubscribeParams;
    result: SubscribeResult;
  };
  unsubscribe: {
    params: undefined;
    result: { unsubscribed: boolean };
  };

  // Album art
  "album-art": {
    params: {
      imageKey: string;
      scale?: "fit" | "fill" | "stretch";
      width?: number;
      height?: number;
      format?: "image/jpeg" | "image/png";
    };
    result: {
      contentType: string;
      data: string; // base64 encoded
    };
  };
};

// Default socket path
export const DEFAULT_SOCKET_PATH = "/tmp/roon-cli.sock";

// Default HTTP port for album art
export const DEFAULT_HTTP_PORT = 9331;

// Generate unique request ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}
