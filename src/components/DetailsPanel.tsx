import React, { useState } from 'react';
import { 
  Trash2, 
  Check, 
  Copy, 
  Info,
  Layers,
  ArrowRight,
  X
} from 'lucide-react';
import type { CodeNode, NodeConnection, LayerType } from '../types';

interface DetailsPanelProps {
  selectedNode: CodeNode | null;
  connections: NodeConnection[];
  nodes: CodeNode[];
  onChangeNode: (id: string, updatedFields: Partial<CodeNode>) => void;
  onDeleteConnection: (id: string) => void;
  onExportMarkdown: () => string;
  onClose: () => void;
}

export const DetailsPanel: React.FC<DetailsPanelProps> = ({
  selectedNode,
  connections,
  nodes,
  onChangeNode,
  onDeleteConnection,
  onExportMarkdown,
  onClose
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyMarkdown = () => {
    const md = onExportMarkdown();
    navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const getConnectedDetails = () => {
    if (!selectedNode) return [];
    
    // Find all outgoing or incoming connections for this node
    return connections.filter(
      c => c.fromNodeId === selectedNode.id || c.toNodeId === selectedNode.id
    ).map(c => {
      const isOutgoing = c.fromNodeId === selectedNode.id;
      const targetId = isOutgoing ? c.toNodeId : c.fromNodeId;
      const targetNode = nodes.find(n => n.id === targetId);
      
      return {
        id: c.id,
        direction: isOutgoing ? 'outgoing' : 'incoming',
        nodeName: targetNode ? targetNode.name : 'Unknown Node',
        label: c.label
      };
    });
  };

  const nodeStats = () => {
    const totalFiles = nodes.filter(n => n.type === 'file').length;
    const totalFolders = nodes.filter(n => n.type === 'directory').length;
    const totalSize = nodes.reduce((acc, n) => acc + (n.size || 0), 0);
    
    const formatSize = (bytes: number) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return { totalFiles, totalFolders, formattedSize: formatSize(totalSize) };
  };

  const stats = nodeStats();
  const nodeConnections = getConnectedDetails();

  return (
    <aside className="details-panel glass-plate">
      {!selectedNode ? (
        // Global Project Statistics View
        <div className="panel-section global-stats">
          <div className="section-title">
            <div className="title-left">
              <Info size={16} />
              <h3>Project Overview</h3>
            </div>
            <button 
              type="button" 
              className="close-panel-btn" 
              onClick={onClose} 
              title="Close Panel"
            >
              <X size={16} />
            </button>
          </div>

          <div className="stats-box">
            <div className="stat-row">
              <span className="label">Total Directories:</span>
              <span className="value">{stats.totalFolders}</span>
            </div>
            <div className="stat-row">
              <span className="label">Total Files:</span>
              <span className="value">{stats.totalFiles}</span>
            </div>
            <div className="stat-row">
              <span className="label">Total Code Size:</span>
              <span className="value">{stats.formattedSize}</span>
            </div>
            <div className="stat-row">
              <span className="label">Mapped Links:</span>
              <span className="value">{connections.length}</span>
            </div>
          </div>

          <div className="helper-card">
            <h4>💡 How to Map Architecture</h4>
            <p>1. Drag nodes to arrange your codebase structure visually.</p>
            <p>2. Drag the **Right Anchor handle** of a card onto any other card to draw a dependency link.</p>
            <p>3. Select a node to write descriptions and assign architectural layers.</p>
          </div>

          <div className="export-action-section">
            <button 
              type="button" 
              className="export-btn glow-btn"
              onClick={handleCopyMarkdown}
              disabled={nodes.length === 0}
            >
              {copied ? (
                <>
                  <Check size={14} style={{ color: 'var(--accent-green)' }} />
                  <span>Copied ARCHITECTURE.md!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Generate Doc File</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        // Selected Node Details Editor View
        <div className="panel-section node-editor">
          <div className="section-title">
            <div className="title-left">
              <Layers size={16} />
              <h3>Edit Component Node</h3>
            </div>
            <button 
              type="button" 
              className="close-panel-btn" 
              onClick={onClose} 
              title="Close Panel"
            >
              <X size={16} />
            </button>
          </div>

          <div className="node-info-block">
            <div className="info-row">
              <span className="label">Name:</span>
              <span className="value truncate-text" title={selectedNode.name}>{selectedNode.name}</span>
            </div>
            <div className="info-row">
              <span className="label">Type:</span>
              <span className="value uppercase-text">{selectedNode.type}</span>
            </div>
            <div className="info-row">
              <span className="label">Path:</span>
              <span className="value path-text truncate-text" title={selectedNode.path}>{selectedNode.path}</span>
            </div>
          </div>

          <div className="editor-group">
            <label>Architectural Layer</label>
            <select 
              value={selectedNode.layer}
              onChange={(e) => onChangeNode(selectedNode.id, { layer: e.target.value as LayerType })}
            >
              <option value="none">None (General Node)</option>
              <option value="ui">UI Component (View Layer)</option>
              <option value="logic">Business Logic (State / Hooks)</option>
              <option value="api">API Router / Network Client</option>
              <option value="db">Database Model / Cache</option>
              <option value="config">Configuration / Helpers</option>
            </select>
          </div>

          <div className="editor-group">
            <label>Description & Purpose</label>
            <textarea 
              value={selectedNode.description}
              onChange={(e) => onChangeNode(selectedNode.id, { description: e.target.value })}
              placeholder="Explain this module's responsibilities..."
              rows={5}
            />
          </div>

          <div className="dependencies-section">
            <h4>Component Connections ({nodeConnections.length})</h4>
            {nodeConnections.length === 0 ? (
              <div className="empty-sub-state">No connection links to this node</div>
            ) : (
              <div className="links-list">
                {nodeConnections.map(conn => (
                  <div key={conn.id} className="link-item">
                    <div className="link-info-row">
                      <span className={`direction-label ${conn.direction}`}>
                        {conn.direction === 'outgoing' ? 'Import' : 'Used by'}
                      </span>
                      <ArrowRight size={12} className="link-arrow" />
                      <span className="link-target-name">{conn.nodeName}</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => onDeleteConnection(conn.id)}
                      title="Delete connection link"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
