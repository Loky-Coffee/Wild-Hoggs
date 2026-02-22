import { useState } from 'preact/hooks';
import type { RefObject } from 'preact';

export const TREE_ZOOM_DEFAULTS = {
  MIN_ZOOM: 0.3,
  MAX_ZOOM: 2.0,
  ZOOM_STEP: 0.2,
  SVG_PADDING: 5,
  CONTAINER_PADDING_MOBILE: 0.5,
  CONTAINER_PADDING_DESKTOP: 1
} as const;

export function calculateMobileZoom(
  container: HTMLElement,
  targetContentWidth: number,
  minZoom: number = TREE_ZOOM_DEFAULTS.MIN_ZOOM
): number {
  const computedStyle = window.getComputedStyle(container);
  const paddingLeft = parseFloat(computedStyle.paddingLeft);
  const paddingRight = parseFloat(computedStyle.paddingRight);
  const containerPadding = paddingLeft + paddingRight;
  const availableWidth = container.clientWidth - containerPadding;
  const result = availableWidth / targetContentWidth;
  return Math.max(Math.min(result, 1), minZoom);
}

export function useTreeZoom(scrollContainerRef: RefObject<HTMLElement>) {
  const [zoomLevel, setZoomLevel] = useState(1);

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + TREE_ZOOM_DEFAULTS.ZOOM_STEP, TREE_ZOOM_DEFAULTS.MAX_ZOOM));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - TREE_ZOOM_DEFAULTS.ZOOM_STEP, TREE_ZOOM_DEFAULTS.MIN_ZOOM));
  };

  const handleScrollLeft = () => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    container.scrollBy({ left: -(container.clientWidth * 0.8), behavior: 'smooth' });
  };

  const handleScrollRight = () => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    container.scrollBy({ left: container.clientWidth * 0.8, behavior: 'smooth' });
  };

  const handleScrollUp = () => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    container.scrollBy({ top: -(container.clientHeight * 0.8), behavior: 'smooth' });
  };

  const handleScrollDown = () => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    container.scrollBy({ top: container.clientHeight * 0.8, behavior: 'smooth' });
  };

  const scrollToCenter = () => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    container.scrollTo({
      left: (container.scrollWidth - container.clientWidth) / 2,
      top: (container.scrollHeight - container.clientHeight) / 2,
      behavior: 'smooth'
    });
  };

  const resetView = (getMobileTargetWidth?: () => number | null) => {
    if (getMobileTargetWidth) {
      const targetWidth = getMobileTargetWidth();
      if (targetWidth != null && scrollContainerRef.current) {
        setZoomLevel(calculateMobileZoom(scrollContainerRef.current, targetWidth));
      } else {
        setZoomLevel(1);
      }
    } else {
      setZoomLevel(1);
    }
    scrollToCenter();
  };

  return {
    zoomLevel,
    setZoomLevel,
    handleZoomIn,
    handleZoomOut,
    handleScrollLeft,
    handleScrollRight,
    handleScrollUp,
    handleScrollDown,
    scrollToCenter,
    resetView
  };
}
