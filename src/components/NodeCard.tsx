import React from 'react';
import { 
  Folder, 
  File, 
  FileCode, 
  Code2, 
  Settings
} from 'lucide-react';
import type { CodeNode, LayerType } from '../types';

interface NodeCardProps {
  node: CodeNode;
  isSelected: boolean;
  onSelect: (nodeId: string) => void;
  onDragStart: (e: React.MouseEvent, nodeId: string) => void;
  onConnectStart: (e: React.MouseEvent, nodeId: string) => void;
}

export const NodeCard: React.FC<NodeCardProps> = React.memo(({
  node,
  isSelected,
  onSelect,
  onDragStart,
  onConnectStart
}) => {
  const getFileIcon = () => {
    if (node.type === 'directory') {
      return <Folder size={16} className="icon-cyan" />;
    }

    const ext = node.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
      case 'js':
      case 'jsx':
        return <Code2 size={16} className="icon-purple" />;
      case 'json':
      case 'yml':
      case 'yaml':
        return <Settings size={16} className="icon-yellow" />;
      case 'css':
      case 'scss':
        return <FileCode size={16} className="icon-green" />;
      default:
        return <File size={16} className="icon-muted" />;
    }
  };

  const getLayerBadge = (layer: LayerType) => {
    switch (layer) {
      case 'ui': return <span className="layer-badge ui-layer">UI Component</span>;
      case 'logic': return <span className="layer-badge logic-layer">Business Logic</span>;
      case 'api': return <span className="layer-badge api-layer">API / Router</span>;
      case 'db': return <span className="layer-badge db-layer">Database</span>;
      case 'config': return <span className="layer-badge config-layer">Config</span>;
      default: return null;
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const isDir = node.type === 'directory';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(node.id);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    onDragStart(e, node.id);
  };

  const handleConnectMouseDown = (e: React.MouseEvent) => {
    onConnectStart(e, node.id);
  };

  return (
    <div 
      className={`node-card glass-plate ${isDir ? 'directory-node' : 'file-node'} ${isSelected ? 'selected-card' : ''}`}
      style={{
        transform: `translate3d(${node.x}px, ${node.y}px, 0)`
      }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
    >
      {/* Input connector anchor socket */}
      <div className="card-anchor anchor-left" title="Input Dependency"></div>

      <div className="card-body-content">
        <div className="card-header-row">
          {getFileIcon()}
          <span className="node-name-label" title={node.name}>{node.name}</span>
        </div>
        
        {node.description && (
          <p className="node-description-snippet">{node.description}</p>
        )}

        <div className="card-footer-row">
          {getLayerBadge(node.layer)}
          {node.size > 0 && <span className="node-size-label">{formatSize(node.size)}</span>}
        </div>
      </div>

      {/* Output connector anchor socket */}
      <div 
        className="card-anchor anchor-right" 
        title="Draw Dependency Link"
        onMouseDown={handleConnectMouseDown}
      >
        <div className="anchor-pulse-dot"></div>
      </div>
    </div>
  );
});
