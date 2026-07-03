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

/**
 * Fit-to-Width: skaliert den Baum so, dass er die verfügbare BREITE füllt (darf auch
 * vergrößern, bis maxZoom). Höhe bleibt scrollbar. Passt sich so an die Monitorbreite an.
 */
export function calculateFitZoom(
  container: HTMLElement,
  contentWidth: number,
  minZoom: number = TREE_ZOOM_DEFAULTS.MIN_ZOOM,
  maxZoom: number = TREE_ZOOM_DEFAULTS.MAX_ZOOM
): number {
  const cs = window.getComputedStyle(container);
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const availW = container.clientWidth - padX;
  if (availW <= 0 || contentWidth <= 0) return 1;
  return Math.max(Math.min(availW / contentWidth, maxZoom), minZoom);
}

/**
 * Fit-to-Height: skaliert den Baum so, dass er die verfügbare HÖHE füllt (bis maxZoom).
 * Für horizontale Layouts (breit-aber-flach) — Breite bleibt scrollbar.
 */
export function calculateFitHeightZoom(
  container: HTMLElement,
  contentHeight: number,
  minZoom: number = TREE_ZOOM_DEFAULTS.MIN_ZOOM,
  maxZoom: number = TREE_ZOOM_DEFAULTS.MAX_ZOOM
): number {
  const cs = window.getComputedStyle(container);
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  const availH = container.clientHeight - padY;
  if (availH <= 0 || contentHeight <= 0) return 1;
  return Math.max(Math.min(availH / contentHeight, maxZoom), minZoom);
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
