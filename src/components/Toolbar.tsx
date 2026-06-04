import React, { useState, useRef, useEffect } from 'react';
import { 
  FolderPlus, 
  Trash2, 
  Maximize2, 
  ZoomIn, 
  ZoomOut, 
  Sparkles,
  Loader,
  Link2,
  RotateCcw,
  Download,
  Upload,
  ChevronDown,
  FileText,
  Code,
  Image as ImageIcon
} from 'lucide-react';
import type { CodeNode, NodeConnection } from '../types';

const Github: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
  <svg 
    viewBox="0 0 24 24" 
    width={size} 
    height={size} 
    stroke="currentColor" 
    strokeWidth="2" 
    fill="none" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  </svg>
);

interface ToolbarProps {
  onImportGitHub: (url: string) => void;
  onImportLocalDirectory: () => void;
  onClearCanvas: () => void;
  onAutoLayout: () => void;
  onAutoLink: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  scale: number;
  isLoading: boolean;
  nodes: CodeNode[];
  connections: NodeConnection[];
  onImportJson: (nodes: CodeNode[], connections: NodeConnection[]) => void;
  onExportMarkdown: () => string;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onImportGitHub,
  onImportLocalDirectory,
  onClearCanvas,
  onAutoLayout,
  onAutoLink,
  onUndo,
  canUndo,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  scale,
  isLoading,
  nodes,
  connections,
  onImportJson,
  onExportMarkdown
}) => {
  const [githubUrl, setGithubUrl] = useState('');
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsExportDropdownOpen(false);
      }
    };
    if (isExportDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isExportDropdownOpen]);

  const handleGitHubSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUrl.trim()) return;
    onImportGitHub(githubUrl.trim());
    setGithubUrl('');
  };

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
    setIsExportDropdownOpen(false);
  };

  const exportAsMarkdown = () => {
    const mdContent = onExportMarkdown();
    downloadFile(mdContent, 'ARCHITECTURE.md', 'text/markdown');
    setIsExportDropdownOpen(false);
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
    setIsExportDropdownOpen(false);
  };

  const isLocalPickerSupported = 'showDirectoryPicker' in window;

  return (
    <div className="toolbar-panel glass-plate">
      <div className="toolbar-logo">
        <div className="logo-glow">C</div>
        <h1>ArchCanvas</h1>
      </div>

      <div className="toolbar-divider"></div>

      {/* GitHub Import Form */}
      <form onSubmit={handleGitHubSubmit} className="import-form">
        <div className="input-with-icon">
          <Github size={14} className="input-icon" />
          <input 
            type="text" 
            placeholder="GitHub Repo URL..." 
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <button type="submit" className="import-btn" disabled={isLoading}>
          {isLoading ? <Loader size={12} className="animate-spin" /> : 'Import'}
        </button>
      </form>

      {/* Local Folder Import & JSON Save Import */}
      <button 
        type="button" 
        className="local-picker-btn" 
        onClick={onImportLocalDirectory}
        disabled={isLoading}
        title={isLocalPickerSupported ? 'Import local project directory' : 'Directory Picker not supported in this browser'}
      >
        <FolderPlus size={14} />
        <span>Load Local Folder</span>
        {!isLocalPickerSupported && <span className="warning-label">Unsupported</span>}
      </button>

      <button
        type="button"
        className="local-picker-btn secondary-picker-btn"
        onClick={handleImportJsonClick}
        disabled={isLoading}
        title="Upload previous JSON map save file"
      >
        <Upload size={14} />
        <span>Import Save</span>
      </button>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleJsonFileChange} 
        accept=".json" 
        style={{ display: 'none' }} 
      />

      <div className="toolbar-divider"></div>

      {/* Canvas Utilities */}
      <div className="canvas-utilities">
        <button 
          onClick={onAutoLayout} 
          title="Auto-organize files hierarchy"
          className="utility-btn"
          disabled={isLoading}
        >
          <Sparkles size={14} />
          <span>Auto Layout</span>
        </button>
        <button 
          onClick={onAutoLink} 
          title="Automatically link file dependencies"
          className="utility-btn"
          disabled={isLoading}
        >
          <Link2 size={14} />
          <span>Auto-Link</span>
        </button>
        {canUndo && (
          <button 
            onClick={onUndo} 
            title="Revert last dependency auto-link"
            className="utility-btn"
            style={{ borderColor: 'rgba(245, 158, 11, 0.4)', color: '#ffd073', background: 'rgba(245, 158, 11, 0.08)' }}
            disabled={isLoading}
          >
            <RotateCcw size={14} />
            <span>Undo Link</span>
          </button>
        )}
        <button 
          onClick={onClearCanvas} 
          title="Wipe canvas clean"
          className="utility-btn danger"
          disabled={isLoading}
        >
          <Trash2 size={14} />
          <span>Clear Map</span>
        </button>

        {/* Export Dropdown Menu */}
        <div className="dropdown-container" ref={dropdownRef}>
          <button 
            type="button"
            onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)} 
            title="Export canvas workspace"
            className={`utility-btn export-trigger-btn ${isExportDropdownOpen ? 'active' : ''}`}
            disabled={isLoading || nodes.length === 0}
          >
            <Download size={14} />
            <span>Export As</span>
            <ChevronDown size={12} className={`arrow-icon ${isExportDropdownOpen ? 'rotated' : ''}`} />
          </button>
          
          {isExportDropdownOpen && (
            <div className="export-dropdown-menu glass-plate">
              <button type="button" onClick={exportAsJson} className="dropdown-item">
                <Code size={14} className="item-icon" />
                <div className="item-text">
                  <span className="item-title">Export JSON Save</span>
                  <span className="item-desc">Save exact workspace layout</span>
                </div>
              </button>
              <button type="button" onClick={exportAsSvg} className="dropdown-item">
                <ImageIcon size={14} className="item-icon" />
                <div className="item-text">
                  <span className="item-title">Export SVG Image</span>
                  <span className="item-desc">Scaleable vector diagram</span>
                </div>
              </button>
              <button type="button" onClick={exportAsMarkdown} className="dropdown-item">
                <FileText size={14} className="item-icon" />
                <div className="item-text">
                  <span className="item-title">Export Markdown File</span>
                  <span className="item-desc">Mermaid graph & overview</span>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="toolbar-divider"></div>

      {/* Zoom Controllers */}
      <div className="zoom-controls">
        <button onClick={onZoomOut} title="Zoom out" className="zoom-btn-circle"><ZoomOut size={13} /></button>
        <span className="scale-readout" onClick={onZoomReset} title="Reset zoom (100%)">
          {Math.round(scale * 100)}%
        </span>
        <button onClick={onZoomIn} title="Zoom in" className="zoom-btn-circle"><ZoomIn size={13} /></button>
        <button onClick={onZoomReset} title="Fit screen" className="zoom-btn-circle"><Maximize2 size={12} /></button>
      </div>
    </div>
  );
};
