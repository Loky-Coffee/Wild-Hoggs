declare module 'rangetouch' {
  export default class RangeTouch {
    constructor(element: HTMLElement, options?: {
      addCSS?: boolean;
      thumbWidth?: number;
      watch?: boolean;
    });
    destroy(): void;
  }
}
