// Module augmentation must be in a module file (not ambient script).
// The `export {}` makes this a proper ES module so `declare module` augments
// instead of replacing the real preact types.
export {};

declare module 'preact' {
  namespace JSX {
    interface HTMLAttributes<Target extends EventTarget = EventTarget> {
      suppressHydrationWarning?: boolean;
    }
  }
}
