import { memo } from 'preact/compat';
import { TREE_ZOOM_DEFAULTS } from '../../hooks/useTreeZoom';

interface TreeControlsProps {
  readonly zoomLevel: number;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly onResetView: () => void;
  readonly onScrollUp: () => void;
  readonly onScrollDown: () => void;
  readonly onScrollLeft: () => void;
  readonly onScrollRight: () => void;
}

const buttonBase = {
  background: 'rgba(0, 0, 0, 0.8)',
  border: '1px solid rgba(255, 165, 0, 0.6)',
  borderRadius: '4px',
  padding: '0.25rem',
  cursor: 'pointer',
  color: '#ffa500',
  fontWeight: 'bold',
  transition: 'all 0.2s',
  width: '32px',
  height: '32px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
} as const;

function TreeControls({
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onResetView,
  onScrollUp,
  onScrollDown,
  onScrollLeft,
  onScrollRight
}: TreeControlsProps) {
  return (
    <>
      <div
        className="zoom-controls"
        style={{
          position: 'absolute',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          zIndex: 1000
        }}
      >
        <style>{`
          .zoom-controls {
            bottom: 1.75rem;
            right: 1.75rem;
          }
          @media (min-width: 769px) {
            .zoom-controls {
              bottom: 3rem;
              right: 3rem;
            }
          }
        `}</style>
        <button
          onClick={onZoomIn}
          disabled={zoomLevel >= TREE_ZOOM_DEFAULTS.MAX_ZOOM}
          style={{
            ...buttonBase,
            fontSize: '1.2rem',
            cursor: zoomLevel >= TREE_ZOOM_DEFAULTS.MAX_ZOOM ? 'not-allowed' : 'pointer',
            opacity: zoomLevel >= TREE_ZOOM_DEFAULTS.MAX_ZOOM ? 0.4 : 1
          }}
          aria-label="Zoom in"
        >
          +
        </button>

        <button
          onClick={onResetView}
          style={{
            ...buttonBase,
            fontSize: '1rem'
          }}
          aria-label="Reset view"
          title="Reset view"
        >
          ⊙
        </button>

        <button
          onClick={onZoomOut}
          disabled={zoomLevel <= TREE_ZOOM_DEFAULTS.MIN_ZOOM}
          style={{
            ...buttonBase,
            fontSize: '1.2rem',
            cursor: zoomLevel <= TREE_ZOOM_DEFAULTS.MIN_ZOOM ? 'not-allowed' : 'pointer',
            opacity: zoomLevel <= TREE_ZOOM_DEFAULTS.MIN_ZOOM ? 0.4 : 1
          }}
          aria-label="Zoom out"
        >
          −
        </button>
      </div>

      {/* Navigation Controls */}
      <div
        className="navigation-controls"
        style={{
          position: 'absolute',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 32px)',
          gridTemplateRows: 'repeat(3, 32px)',
          gap: '0.25rem',
          zIndex: 1000
        }}
      >
        <style>{`
          .navigation-controls {
            bottom: 1.75rem;
            left: 1.75rem;
          }
          @media (min-width: 769px) {
            .navigation-controls {
              bottom: 3rem;
              left: 3rem;
            }
          }
        `}</style>

        {/* Up arrow - top center */}
        <button
          onClick={onScrollUp}
          style={{
            ...buttonBase,
            fontSize: '1rem',
            gridColumn: '2',
            gridRow: '1'
          }}
          aria-label="Scroll up"
        >
          ▲
        </button>

        {/* Left arrow - middle left */}
        <button
          onClick={onScrollLeft}
          style={{
            ...buttonBase,
            fontSize: '1rem',
            gridColumn: '1',
            gridRow: '2'
          }}
          aria-label="Scroll left"
        >
          ◄
        </button>

        {/* Right arrow - middle right */}
        <button
          onClick={onScrollRight}
          style={{
            ...buttonBase,
            fontSize: '1rem',
            gridColumn: '3',
            gridRow: '2'
          }}
          aria-label="Scroll right"
        >
          ►
        </button>

        {/* Down arrow - bottom center */}
        <button
          onClick={onScrollDown}
          style={{
            ...buttonBase,
            fontSize: '1rem',
            gridColumn: '2',
            gridRow: '3'
          }}
          aria-label="Scroll down"
        >
          ▼
        </button>
      </div>
    </>
  );
}

export default memo(TreeControls);
