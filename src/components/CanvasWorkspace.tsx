import React, { useRef, useState, useCallback, useEffect } from 'react';
import type { CanvasState, CodeNode, NodeConnection } from '../types';
import { NodeCard } from './NodeCard';

interface CanvasWorkspaceProps {
  nodes: CodeNode[];
  connections: NodeConnection[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onNodeDrag: (id: string, x: number, y: number) => void;
  onNodeDragEnd?: () => void;
  onConnectEnd: (fromId: string, toId: string) => void;
  canvasState: CanvasState;
  setCanvasState: React.Dispatch<React.SetStateAction<CanvasState>>;
}

export const CanvasWorkspace: React.FC<CanvasWorkspaceProps> = ({
  nodes,
  connections,
  selectedNodeId,
  onSelectNode,
  onNodeDrag,
  onNodeDragEnd,
  onConnectEnd,
  canvasState,
  setCanvasState
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const [connectFromId, setConnectFromId] = useState<string | null>(null);
  const [connectTargetId, setConnectTargetId] = useState<string | null>(null);
  const [tempLineEnd, setTempLineEnd] = useState({ x: 0, y: 0 });

  // Keep a stable ref to nodes so event callbacks do not rebuild on every node layout drag
  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const { panX, panY, scale } = canvasState;

  // Node Dimensions matching index.css styles
  const CARD_WIDTH = 220;
  const CARD_HEIGHT = 80;

  // Convert mouse screen coordinates to canvas coordinate space
  const screenToCanvasCoords = (clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - panX) / scale,
      y: (clientY - rect.top - panY) / scale
    };
  };

  // 1. Zoom Wheel Handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const zoomFactor = 1.08;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Center zoom on mouse position
    const canvasMouseX = (mouseX - panX) / scale;
    const canvasMouseY = (mouseY - panY) / scale;

    let newScale = scale;
    if (e.deltaY < 0) {
      newScale = Math.min(scale * zoomFactor, 3.0); // max scale 300%
    } else {
      newScale = Math.max(scale / zoomFactor, 0.15); // min scale 15%
    }

    setCanvasState({
      scale: newScale,
      panX: mouseX - canvasMouseX * newScale,
      panY: mouseY - canvasMouseY * newScale
    });
  };

  // 2. Mouse Down Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // If clicking on anchor, do not start pan
    if ((e.target as HTMLElement).classList.contains('card-anchor')) return;
    
    // Clear selection if clicking background
    if ((e.target as HTMLElement).classList.contains('canvas-workspace-inner') || 
        (e.target as HTMLElement).classList.contains('grid-bg-container')) {
      onSelectNode(null);
      setIsPanning(true);
      setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
    }
  };

  const handleNodeClick = useCallback((nodeId: string) => {
    onSelectNode(nodeId);
  }, [onSelectNode]);

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    onSelectNode(nodeId);
    
    if ((e.target as HTMLElement).classList.contains('card-anchor')) return;

    const targetNode = nodesRef.current.find(n => n.id === nodeId);
    if (!targetNode) return;

    setDragNodeId(nodeId);
    // Calculate drag offset in raw canvas space coordinates by dividing screen delta by scale
    setDragStart({
      x: e.clientX / scale - targetNode.x,
      y: e.clientY / scale - targetNode.y
    });
  }, [onSelectNode, scale]);

  const handleConnectStart = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    e.preventDefault();
    setConnectFromId(nodeId);
    
    const sourceNode = nodesRef.current.find(n => n.id === nodeId);
    if (sourceNode) {
      // Anchors are on the right side center of card
      setTempLineEnd({
        x: sourceNode.x + CARD_WIDTH,
        y: sourceNode.y + CARD_HEIGHT / 2
      });
    }
  }, []);

  // 3. Mouse Move Handler
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setCanvasState(prev => ({
        ...prev,
        panX: e.clientX - panStart.x,
        panY: e.clientY - panStart.y
      }));
      return;
    }

    if (dragNodeId) {
      // Process updated translation parameters perfectly matched to cursor speed
      const nodeX = e.clientX / scale - dragStart.x;
      const nodeY = e.clientY / scale - dragStart.y;
      onNodeDrag(dragNodeId, Math.round(nodeX), Math.round(nodeY));
      return;
    }

    if (connectFromId) {
      const canvasCoords = screenToCanvasCoords(e.clientX, e.clientY);
      setTempLineEnd(canvasCoords);
      
      // Bounding-Box Detection Check
      const target = (e.target as HTMLElement).closest('.node-card');
      if (target) {
        // Look for any node where the mouse coordinates fall strictly within its bounding box boundaries
        const hoveredNode = nodes.find(n => 
          canvasCoords.x >= n.x && 
          canvasCoords.x <= n.x + CARD_WIDTH &&
          canvasCoords.y >= n.y && 
          canvasCoords.y <= n.y + CARD_HEIGHT
        );

        if (hoveredNode && hoveredNode.id !== connectFromId) {
          setConnectTargetId(hoveredNode.id);
        }
      } else {
        setConnectTargetId(null);
      }
    }
  };

  // 4. Mouse Up Handler
  const handleMouseUp = () => {
    setIsPanning(false);
    
    if (dragNodeId && onNodeDragEnd) {
      onNodeDragEnd();
    }
    setDragNodeId(null);

    // Create Connection Link
    if (connectFromId && connectTargetId) {
      onConnectEnd(connectFromId, connectTargetId);
    }
    
    setConnectFromId(null);
    setConnectTargetId(null);
  };

  // SVG Paths Drawer Helper
  const drawConnectionPath = (fromNode: CodeNode, toNode: CodeNode) => {
    const startX = fromNode.x + CARD_WIDTH;
    const startY = fromNode.y + CARD_HEIGHT / 2;
    const endX = toNode.x;
    const endY = toNode.y + CARD_HEIGHT / 2;

    // Nice cubic bezier curves mapping
    const controlOffset = Math.max(Math.abs(endX - startX) * 0.4, 40);
    return `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;
  };

  const drawTempConnectionPath = () => {
    if (!connectFromId) return '';
    const source = nodes.find(n => n.id === connectFromId);
    if (!source) return '';
    const startX = source.x + CARD_WIDTH;
    const startY = source.y + CARD_HEIGHT / 2;
    const controlOffset = Math.max(Math.abs(tempLineEnd.x - startX) * 0.4, 40);
    return `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${tempLineEnd.x - controlOffset} ${tempLineEnd.y}, ${tempLineEnd.x} ${tempLineEnd.y}`;
  };

  const canvasStyle = {
    transform: `translate3d(${panX}px, ${panY}px, 0) scale(${scale})`,
    transformOrigin: '0 0'
  };

  return (
    <div 
      className="canvas-viewport" 
      ref={containerRef}
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="canvas-workspace-inner" style={canvasStyle}>
        
        {/* Infinite Grid Dots Pattern */}
        <div className="grid-bg-container"></div>

        {/* Vector Connections SVG Layout */}
        <svg className="connections-svg-layer">
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--accent-purple)" />
            </marker>
          </defs>

          {/* Render permanent links */}
          {connections.map(conn => {
            const fromNode = nodes.find(n => n.id === conn.fromNodeId);
            const toNode = nodes.find(n => n.id === conn.toNodeId);
            if (!fromNode || !toNode) return null;

            return (
              <g key={conn.id}>
                <path
                  d={drawConnectionPath(fromNode, toNode)}
                  className="connection-line"
                  markerEnd="url(#arrow)"
                />
              </g>
            );
          })}

          {/* Render active dragging linking line */}
          {connectFromId && (
            <path
              d={drawTempConnectionPath()}
              className="connection-line temp-line"
              markerEnd="url(#arrow)"
            />
          )}
        </svg>

        {/* Render Card Nodes List */}
        {nodes.map(node => (
          <NodeCard
            key={node.id}
            node={node}
            isSelected={node.id === selectedNodeId}
            onSelect={handleNodeClick}
            onDragStart={handleNodeMouseDown}
            onConnectStart={handleConnectStart}
          />
        ))}

      </div>
    </div>
  );
};
