import { useEffect, useRef } from 'preact/hooks';
import type { RefObject } from 'preact';

/**
 * Bottom-Sheet: am Griff (Handle) nach unten ziehen zum Schließen.
 * Griff bekommt einen nativen, non-passiven touchmove-Listener (damit preventDefault
 * greift und NICHT der Inhalt gescrollt wird). Zieht man weit genug (>90px) -> onClose.
 */
export function useSheetDrag(onClose: () => void): {
  handleRef: RefObject<HTMLDivElement>;
  sheetRef: RefObject<HTMLDivElement>;
} {
  const handleRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = handleRef.current;
    const sheet = sheetRef.current;
    if (!handle || !sheet) return;

    let start: number | null = null;
    let dy = 0;

    const ts = (e: TouchEvent) => {
      start = e.touches[0].clientY;
      dy = 0;
      sheet.style.transition = 'none';
    };
    const tm = (e: TouchEvent) => {
      if (start == null) return;
      dy = e.touches[0].clientY - start;
      if (dy > 0) {
        sheet.style.transform = `translateY(${dy}px)`;
        e.preventDefault(); // Scroll des Inhalts verhindern
      }
    };
    const te = () => {
      sheet.style.transition = '';
      if (dy > 90) {
        onClose();
      } else {
        sheet.style.transform = '';
      }
      start = null;
      dy = 0;
    };

    handle.addEventListener('touchstart', ts, { passive: true });
    handle.addEventListener('touchmove', tm, { passive: false });
    handle.addEventListener('touchend', te);
    handle.addEventListener('touchcancel', te);
    return () => {
      handle.removeEventListener('touchstart', ts);
      handle.removeEventListener('touchmove', tm);
      handle.removeEventListener('touchend', te);
      handle.removeEventListener('touchcancel', te);
    };
  }, [onClose]);

  return { handleRef, sheetRef };
}
