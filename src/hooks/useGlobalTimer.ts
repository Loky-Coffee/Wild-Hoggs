/**
 * Global Timer Hook
 *
 * Provides a single shared interval for all timer-based components.
 * Eliminates the need for multiple setInterval calls, reducing overhead by ~90%.
 *
 * Benefits:
 * - 10 components with timers → 1 shared interval instead of 10
 * - Less battery drain on mobile devices
 * - Reduced CPU usage
 * - Better performance
 *
 * Usage:
 * ```typescript
 * const [timeLeft, setTimeLeft] = useState('');
 *
 * useGlobalTimer(() => {
 *   setTimeLeft(calculateTimeRemaining());
 * });
 * ```
 */

import { useEffect, useRef } from 'preact/hooks';

type Callback = () => void;
type SubscriptionId = number;

class GlobalTimerManager {
  private subscribers: Map<SubscriptionId, Callback> = new Map();
  private intervalId: number | null = null;
  private nextId: SubscriptionId = 0;

  subscribe(callback: Callback): SubscriptionId {
    const id = this.nextId++;
    this.subscribers.set(id, callback);

    // Start the global interval if this is the first subscriber
    if (this.subscribers.size === 1) {
      this.start();
    }

    return id;
  }

  unsubscribe(id: SubscriptionId): void {
    this.subscribers.delete(id);

    // Stop the global interval if there are no more subscribers
    if (this.subscribers.size === 0) {
      this.stop();
    }
  }

  private start(): void {
    if (this.intervalId !== null) return;

    // Single interval that notifies all subscribers
    this.intervalId = window.setInterval(() => {
      this.subscribers.forEach((callback) => {
        try {
          callback();
        } catch (error) {
          console.error('[GlobalTimer] Callback error:', error);
        }
      });
    }, 1000);
  }

  private stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

// Singleton instance
const globalTimerManager = new GlobalTimerManager();

/**
 * Hook to subscribe to the global timer
 *
 * @param callback - Function to call every second
 *
 * @example
 * ```typescript
 * useGlobalTimer(() => {
 *   console.log('Called every second');
 * });
 * ```
 */
export function useGlobalTimer(callback: Callback): void {
  const callbackRef = useRef(callback);

  // Update ref when callback changes (avoid re-subscription)
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    // Subscribe to global timer
    const id = globalTimerManager.subscribe(() => {
      callbackRef.current();
    });

    // Call immediately on mount
    callbackRef.current();

    // Unsubscribe on unmount
    return () => {
      globalTimerManager.unsubscribe(id);
    };
  }, []);
}
