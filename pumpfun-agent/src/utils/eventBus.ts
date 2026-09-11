import { EventEmitter } from 'events';
import { AgentEventMap } from '../types';
import { logger } from './logger';

export class TypedEventBus {
  private emitter: EventEmitter;
  private listenerCounts: Map<string, number> = new Map();

  constructor() {
    this.emitter = new EventEmitter();
    // Allow up to 50 listeners across all components without warning
    this.emitter.setMaxListeners(50);
  }

  public on<K extends keyof AgentEventMap>(event: K, listener: AgentEventMap[K]): void {
    const safeListener = ((...args: Parameters<AgentEventMap[K]>) => {
      try {
        // @ts-expect-error dynamic listener dispatch
        listener(...args);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.stack || err.message : String(err);
        logger.error(`[EventBus] Unhandled error in listener for event '${String(event)}': ${errorMsg}`);
      }
    }) as unknown as AgentEventMap[K];

    this.emitter.on(event as string, safeListener as unknown as (...args: unknown[]) => void);
    this.listenerCounts.set(event as string, (this.listenerCounts.get(event as string) || 0) + 1);
  }

  public once<K extends keyof AgentEventMap>(event: K, listener: AgentEventMap[K]): void {
    const safeOnceListener = ((...args: Parameters<AgentEventMap[K]>) => {
      try {
        // @ts-expect-error dynamic listener dispatch
        listener(...args);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.stack || err.message : String(err);
        logger.error(`[EventBus] Unhandled error in once-listener for event '${String(event)}': ${errorMsg}`);
      }
    }) as unknown as AgentEventMap[K];

    this.emitter.once(event as string, safeOnceListener as unknown as (...args: unknown[]) => void);
  }

  public emit<K extends keyof AgentEventMap>(event: K, ...args: Parameters<AgentEventMap[K]>): boolean {
    try {
      return this.emitter.emit(event as string, ...args);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.stack || err.message : String(err);
      logger.error(`[EventBus] Fatal error emitting event '${String(event)}': ${errorMsg}`);
      return false;
    }
  }

  public off<K extends keyof AgentEventMap>(event: K, listener: AgentEventMap[K]): void {
    this.emitter.off(event as string, listener as unknown as (...args: unknown[]) => void);
    const count = this.listenerCounts.get(event as string) || 1;
    this.listenerCounts.set(event as string, Math.max(0, count - 1));
  }

  public removeAllListeners(event?: keyof AgentEventMap): void {
    if (event) {
      this.emitter.removeAllListeners(event as string);
      this.listenerCounts.delete(event as string);
    } else {
      this.emitter.removeAllListeners();
      this.listenerCounts.clear();
    }
  }

  public getActiveListenerCount(event: keyof AgentEventMap): number {
    return this.emitter.listenerCount(event as string);
  }
}

export const eventBus = new TypedEventBus();
