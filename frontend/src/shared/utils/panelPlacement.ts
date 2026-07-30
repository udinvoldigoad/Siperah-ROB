export function panelPlacement(rect: DOMRect): { top?: number; bottom?: number; left: number; maxHeight: number } {
  const GAP = 6;
  const EDGE = 8;
  const MIN_HEIGHT = 160;

  const below = window.innerHeight - rect.bottom - GAP - EDGE;
  const above = rect.top - GAP - EDGE;
  const dropUp = below < MIN_HEIGHT && above > below;

  return {
    ...(dropUp
      ? { bottom: window.innerHeight - rect.top + GAP }
      : { top: rect.bottom + GAP }),
    left: Math.max(EDGE, Math.min(rect.left, window.innerWidth - rect.width - EDGE)),
    maxHeight: Math.max(MIN_HEIGHT, dropUp ? above : below),
  };
}
