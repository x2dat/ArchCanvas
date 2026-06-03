export type NodeType = 'file' | 'directory';

export type LayerType = 'ui' | 'logic' | 'api' | 'db' | 'config' | 'none';

export interface CodeNode {
  id: string;
  name: string;
  path: string;
  type: NodeType;
  x: number;
  y: number;
  description: string;
  layer: LayerType;
  size: number; // in bytes
}

export interface NodeConnection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label: string;
}

export interface CanvasState {
  panX: number;
  panY: number;
  scale: number;
}

export interface DirectoryItem {
  name: string;
  path: string;
  type: NodeType;
  size: number;
  children?: DirectoryItem[];
}
