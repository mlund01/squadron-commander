import { useState, useRef, useCallback, useEffect } from 'react';

export interface ReactFlowRef {
  fitView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  getViewport: () => { x: number; y: number; zoom: number };
  setViewport: (vp: { x: number; y: number; zoom: number }) => void;
}

interface UseResizablePanelOptions {
  defaultHeight?: number;
  minHeight?: number;
}

export function useResizablePanel(opts?: UseResizablePanelOptions) {
  const defaultHeight = opts?.defaultHeight ?? 300;
  const MIN_PANEL_HEIGHT = opts?.minHeight ?? 120;

  const [panelHeight, setPanelHeight] = useState(defaultHeight);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const collapsedHeightRef = useRef(MIN_PANEL_HEIGHT);
  const prevPanelHeightRef = useRef(panelHeight);
  const reactFlowRef = useRef<ReactFlowRef | null>(null);

  const getMaxHeight = useCallback(() => {
    if (!containerRef.current) return 500;
    return Math.floor(containerRef.current.clientHeight * 0.75);
  }, []);

  const handleDragStart = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, [role="tab"]')) return;
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startHeight: panelHeight };
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
  }, [panelHeight]);

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const delta = dragRef.current.startY - e.clientY;
    const maxH = getMaxHeight();
    const newHeight = Math.min(maxH, Math.max(MIN_PANEL_HEIGHT, dragRef.current.startHeight + delta));
    setPanelHeight(newHeight);
  }, [getMaxHeight, MIN_PANEL_HEIGHT]);

  const handleDragEnd = useCallback(() => {
    dragRef.current = null;
  }, []);

  const togglePanel = useCallback(() => {
    const maxH = getMaxHeight();
    if (panelHeight >= maxH) {
      setPanelHeight(collapsedHeightRef.current);
    } else {
      collapsedHeightRef.current = panelHeight;
      setPanelHeight(maxH);
    }
  }, [panelHeight, getMaxHeight]);

  // Adjust canvas Y to keep visual center stable when panel height changes
  useEffect(() => {
    const rf = reactFlowRef.current;
    if (!rf) return;
    const delta = panelHeight - prevPanelHeightRef.current;
    prevPanelHeightRef.current = panelHeight;
    if (delta === 0) return;
    const vp = rf.getViewport();
    rf.setViewport({ x: vp.x, y: vp.y - delta / 2, zoom: vp.zoom });
  }, [panelHeight]);

  const onInit = useCallback((instance: ReactFlowRef) => {
    reactFlowRef.current = instance;
    setTimeout(() => instance.fitView(), 0);
  }, []);

  return {
    panelHeight,
    containerRef,
    reactFlowRef,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    togglePanel,
    getMaxHeight,
    onInit,
  };
}
