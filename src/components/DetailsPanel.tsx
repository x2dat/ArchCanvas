import React, { useState, useRef } from 'react';
import { 
  Trash2, 
  Check, 
  Copy, 
  Info,
  Layers,
  ArrowRight,
  X,
  Upload,
  Code,
  FileText,
  Image as ImageIcon
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
  isLoading?: boolean;
  onImportJson: (nodes: CodeNode[], connections: NodeConnection[]) => void;
}

export const DetailsPanel: React.FC<DetailsPanelProps> = ({
  selectedNode,
  connections,
  nodes,
  onChangeNode,
  onDeleteConnection,
  onExportMarkdown,
  onClose,
  isLoading = false,
  onImportJson
}) => {
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportJsonClick = () => {
    fileInputRef.current?.click();
  };

  const handleJsonFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (Array.isArray(data.nodes) && Array.isArray(data.connections)) {
          onImportJson(data.nodes, data.connections);
        } else {
          alert('Invalid save file format. Must contain nodes and connections.');
        }
      } catch (err) {
        alert('Failed to parse file. Please verify it is a valid JSON save file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const downloadFile = (content: string, filename: string, contentType: string) => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAsJson = () => {
    const data = JSON.stringify({ nodes, connections }, null, 2);
    downloadFile(data, 'archcanvas-workspace.json', 'application/json');
  };

  const exportAsMarkdown = () => {
    const mdContent = onExportMarkdown();
    downloadFile(mdContent, 'ARCHITECTURE.md', 'text/markdown');
  };

  const exportAsSvg = () => {
    if (nodes.length === 0) return;

    const CARD_WIDTH = 220;
    const CARD_HEIGHT = 80;

    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...nodes.map(n => n.x + CARD_WIDTH));
    const minY = Math.min(...ys);
    const maxY = Math.max(...nodes.map(n => n.y + CARD_HEIGHT));

    const padding = 80;
    const svgWidth = (maxX - minX) + (padding * 2);
    const svgHeight = (maxY - minY) + (padding * 2);
    const viewX = minX - padding;
    const viewY = minY - padding;

    const escape = (str: string) => {
      return (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const formatSize = (bytes: number) => {
      if (!bytes) return '';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    let svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="${viewX} ${viewY} ${svgWidth} ${svgHeight}">\n`;
    
    svgStr += `  <style>\n`;
    svgStr += `    .bg { fill: #07090d; }\n`;
    svgStr += `    .grid { fill: url(#gridPattern); }\n`;
    svgStr += `    .conn { fill: none; stroke: #8b5cf6; stroke-width: 2.5px; }\n`;
    svgStr += `    .card { fill: #121623; stroke: rgba(255,255,255,0.06); stroke-width: 1px; rx: 10px; ry: 10px; }\n`;
    svgStr += `    .node-title { fill: #f3f4f6; font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 600; }\n`;
    svgStr += `    .node-desc { fill: #8c9bb0; font-family: 'Outfit', sans-serif; font-size: 10px; }\n`;
    svgStr += `    .node-size { fill: #3f4e64; font-family: 'Fira Code', monospace; font-size: 9px; }\n`;
    svgStr += `    .badge-bg { rx: 4px; ry: 4px; }\n`;
    svgStr += `    .badge-text { font-family: 'Outfit', sans-serif; font-size: 8px; font-weight: bold; text-anchor: middle; }\n`;
    svgStr += `  </style>\n`;

    svgStr += `  <defs>\n`;
    svgStr += `    <pattern id="gridPattern" width="24" height="24" patternUnits="userSpaceOnUse">\n`;
    svgStr += `      <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.04)" />\n`;
    svgStr += `    </pattern>\n`;
    svgStr += `    <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">\n`;
    svgStr += `      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#8b5cf6" />\n`;
    svgStr += `    </marker>\n`;
    svgStr += `  </defs>\n`;

    svgStr += `  <rect x="${viewX}" y="${viewY}" width="${svgWidth}" height="${svgHeight}" class="bg" />\n`;
    svgStr += `  <rect x="${viewX}" y="${viewY}" width="${svgWidth}" height="${svgHeight}" class="grid" />\n`;

    svgStr += `  <!-- Connection Links -->\n`;
    connections.forEach(conn => {
      const fromNode = nodes.find(n => n.id === conn.fromNodeId);
      const toNode = nodes.find(n => n.id === conn.toNodeId);
      if (!fromNode || !toNode) return;

      const startX = fromNode.x + CARD_WIDTH;
      const startY = fromNode.y + CARD_HEIGHT / 2;
      const endX = toNode.x;
      const endY = toNode.y + CARD_HEIGHT / 2;
      
      const controlOffset = Math.max(Math.abs(endX - startX) * 0.4, 40);
      const pathD = `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;
      svgStr += `  <path d="${pathD}" class="conn" marker-end="url(#arrow)" />\n`;
    });

    svgStr += `  <!-- Component Cards -->\n`;
    nodes.forEach(node => {
      let accentColor = '#8b5cf6';
      let labelText = 'FILE';
      if (node.type === 'directory') {
        accentColor = '#06b6d4';
        labelText = 'FOLDER';
      }
      if (node.layer && node.layer !== 'none') {
        labelText = node.layer.toUpperCase();
        if (node.layer === 'ui') accentColor = '#06b6d4';
        else if (node.layer === 'logic') accentColor = '#8b5cf6';
        else if (node.layer === 'api') accentColor = '#f59e0b';
        else if (node.layer === 'db') accentColor = '#10b981';
      }

      svgStr += `  <g id="${node.id}">\n`;
      svgStr += `    <rect x="${node.x}" y="${node.y}" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" class="card" />\n`;
      svgStr += `    <path d="M ${node.x} ${node.y + 10} A 10 10 0 0 1 ${node.x + 10} ${node.y} L ${node.x + 10} ${node.y + CARD_HEIGHT} L ${node.x} ${node.y + CARD_HEIGHT - 10} Z" fill="${accentColor}" />\n`;
      svgStr += `    <rect x="${node.x}" y="${node.y}" width="4" height="${CARD_HEIGHT}" fill="${accentColor}" />\n`;

      svgStr += `    <text x="${node.x + 18}" y="${node.y + 26}" class="node-title">${escape(node.name)}</text>\n`;
      
      let displayPath = node.path;
      if (displayPath.length > 32) {
        displayPath = '...' + displayPath.substring(displayPath.length - 30);
      }
      svgStr += `    <text x="${node.x + 18}" y="${node.y + 44}" class="node-desc">${escape(displayPath)}</text>\n`;

      const descSnippet = node.description ? node.description : (node.type === 'directory' ? 'Directory Module' : 'Source Code Asset');
      let displayDesc = descSnippet;
      if (displayDesc.length > 34) {
        displayDesc = displayDesc.substring(0, 32) + '...';
      }
      svgStr += `    <text x="${node.x + 18}" y="${node.y + 58}" class="node-desc" fill="rgba(255,255,255,0.4)">${escape(displayDesc)}</text>\n`;

      if (node.type === 'file' && node.size) {
        svgStr += `    <text x="${node.x + 18}" y="${node.y + 71}" class="node-size">${formatSize(node.size)}</text>\n`;
      }

      const badgeText = labelText;
      const textLen = badgeText.length * 5.5 + 10;
      const badgeX = node.x + CARD_WIDTH - textLen - 12;
      const badgeY = node.y + CARD_HEIGHT - 22;
      svgStr += `    <rect x="${badgeX}" y="${badgeY}" width="${textLen}" height="14" fill="${accentColor}1d" stroke="${accentColor}40" stroke-width="1" class="badge-bg" />\n`;
      svgStr += `    <text x="${badgeX + textLen / 2}" y="${badgeY + 10}" fill="${accentColor}" class="badge-text">${badgeText}</text>\n`;

      svgStr += `  </g>\n`;
    });

    svgStr += `</svg>`;
    downloadFile(svgStr, 'architecture-canvas-map.svg', 'image/svg+xml');
  };

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

          <div className="panel-actions-section">
            <h4>Restore Map</h4>
            <button
              type="button"
              className="sidebar-action-btn secondary-btn"
              onClick={handleImportJsonClick}
              disabled={isLoading}
              title="Upload previous JSON map save file"
            >
              <Upload size={13} />
              <span>Import JSON Save</span>
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleJsonFileChange} 
              accept=".json" 
              style={{ display: 'none' }} 
            />
          </div>

          <div className="panel-actions-section">
            <h4>Export Workspace</h4>
            <div className="export-buttons-grid">
              <button 
                type="button" 
                className="sidebar-action-btn"
                onClick={exportAsJson}
                disabled={nodes.length === 0}
                title="Download workspace JSON save file"
              >
                <Code size={13} />
                <span>Save JSON</span>
              </button>
              <button 
                type="button" 
                className="sidebar-action-btn"
                onClick={exportAsSvg}
                disabled={nodes.length === 0}
                title="Download workspace diagram as SVG vector"
              >
                <ImageIcon size={13} />
                <span>Export SVG</span>
              </button>
              <button 
                type="button" 
                className="sidebar-action-btn"
                onClick={exportAsMarkdown}
                disabled={nodes.length === 0}
                title="Download workspace summary as ARCHITECTURE.md"
              >
                <FileText size={13} />
                <span>Export MD</span>
              </button>
            </div>
            
            <button 
              type="button" 
              className="copy-clipboard-btn"
              onClick={handleCopyMarkdown}
              disabled={nodes.length === 0}
              title="Copy Markdown code to clipboard"
            >
              {copied ? (
                <>
                  <Check size={12} style={{ color: 'var(--accent-green)' }} />
                  <span>Copied ARCHITECTURE.md!</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Copy Markdown to Clipboard</span>
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
