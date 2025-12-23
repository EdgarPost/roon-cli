import * as net from "net";
import type {
  SubscriptionEventType,
  IPCEvent,
  SubscribeParams,
} from "../shared/protocol.js";

interface Subscription {
  socket: net.Socket;
  events: Set<SubscriptionEventType>;
  zones: Set<string>; // Empty set = all zones
  createdAt: number;
}

export class SubscriptionManager {
  private subscriptions: Map<net.Socket, Subscription> = new Map();

  /**
   * Add a new subscription
   */
  subscribe(
    socket: net.Socket,
    params: SubscribeParams,
    resolvedZoneIds: string[]
  ): void {
    this.subscriptions.set(socket, {
      socket,
      events: new Set(params.events),
      zones: new Set(resolvedZoneIds),
      createdAt: Date.now(),
    });
  }

  /**
   * Remove subscription when client disconnects or unsubscribes
   */
  unsubscribe(socket: net.Socket): void {
    this.subscriptions.delete(socket);
  }

  /**
   * Check if a socket has an active subscription
   */
  hasSubscription(socket: net.Socket): boolean {
    return this.subscriptions.has(socket);
  }

  /**
   * Broadcast event to all interested subscribers
   */
  broadcast(
    eventType: SubscriptionEventType,
    data: unknown,
    zoneId?: string
  ): void {
    if (this.subscriptions.size === 0) {
      return;
    }

    const event: IPCEvent = {
      event: eventType,
      data,
      zoneId,
      timestamp: Date.now(),
    };

    const eventStr = JSON.stringify(event) + "\n";

    for (const [socket, sub] of this.subscriptions) {
      // Check if subscriber wants this event type
      if (!sub.events.has(eventType)) {
        continue;
      }

      // Check zone filter (empty set = all zones)
      if (zoneId && sub.zones.size > 0 && !sub.zones.has(zoneId)) {
        continue;
      }

      // Send event (ignore write errors - socket may be dead)
      try {
        if (!socket.destroyed) {
          socket.write(eventStr);
        }
      } catch (err) {
        // Socket error - will be cleaned up on 'close' event
        console.error("Error sending event:", err);
      }
    }
  }

  /**
   * Get count of active subscribers
   */
  get subscriberCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Clean up dead connections
   */
  cleanup(): void {
    for (const [socket] of this.subscriptions) {
      if (socket.destroyed) {
        this.subscriptions.delete(socket);
      }
    }
  }
}
