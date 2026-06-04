import React, { useState, useMemo } from 'react';
import { 
  Folder, 
  File, 
  ChevronDown, 
  ChevronRight, 
  Search, 
  Maximize2, 
  X,
  FileCode
} from 'lucide-react';
import type { CodeNode } from '../types';

interface FileExplorerProps {
  nodes: CodeNode[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onCenterOnNode: (id: string) => void;
  onClose: () => void;
}

interface TreeItem {
  id?: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  node?: CodeNode;
  children: Record<string, TreeItem>;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  nodes,
  selectedNodeId,
  onSelectNode,
  onCenterOnNode,
  onClose
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  // 1. Build directory tree hierarchy from flat nodes list
  const treeData = useMemo(() => {
    const root: TreeItem = { name: 'root', path: '', type: 'directory', children: {} };

    nodes.forEach(node => {
      const parts = node.path.split('/');
      let current = root;

      parts.forEach((part, index) => {
        const isLast = index === parts.length - 1;
        const currentPath = parts.slice(0, index + 1).join('/');

        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            path: currentPath,
            type: isLast ? node.type : 'directory',
            children: {}
          };
        }

        if (isLast) {
          current.children[part].id = node.id;
          current.children[part].node = node;
        }

        current = current.children[part];
      });
    });

    return root;
  }, [nodes]);

  // Toggle folder expansion
  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  // Helper to determine if a node matches search or has children that match
  const matchesSearch = (item: TreeItem, query: string): boolean => {
    if (!query) return true;
    const lowerQuery = query.toLowerCase();
    
    // Check if current matches
    if (item.name.toLowerCase().includes(lowerQuery) || item.path.toLowerCase().includes(lowerQuery)) {
      return true;
    }
    
    // Check if children match
    return Object.values(item.children).some(child => matchesSearch(child, query));
  };

  // Render tree node recursively
  const renderTreeNode = (item: TreeItem, depth = 0) => {
    const childList = Object.values(item.children).sort((a, b) => {
      // Sort directories first, then files
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    const isFolder = item.type === 'directory';
    const isExpanded = expandedFolders[item.path] !== false; // expanded by default
    const isSelected = item.id && item.id === selectedNodeId;

    if (item.path && !matchesSearch(item, searchQuery)) {
      return null;
    }

    const layerClass = item.node?.layer && item.node.layer !== 'none' 
      ? `explorer-badge-${item.node.layer}` 
      : '';

    return (
      <div key={item.path || 'root-node'} className="tree-node-group">
        {item.path && (
          <div 
            className={`tree-node-row ${isSelected ? 'selected' : ''}`}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={() => item.id && onSelectNode(item.id)}
          >
            <div className="node-info-left">
              {isFolder ? (
                <button 
                  type="button" 
                  className="folder-toggle-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFolder(item.path);
                  }}
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              ) : (
                <span className="indent-shim"></span>
              )}

              {isFolder ? (
                <Folder size={14} className="folder-icon" />
              ) : (
                <File size={14} className="file-icon" />
              )}
              
              <span className="node-name truncate-text" title={item.name}>
                {item.name}
              </span>

              {item.node?.layer && item.node.layer !== 'none' && (
                <span className={`explorer-layer-badge ${layerClass}`}>
                  {item.node.layer.toUpperCase()}
                </span>
              )}
            </div>

            {item.id && (
              <button 
                type="button" 
                className="locate-card-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onCenterOnNode(item.id!);
                }}
                title="Center camera on component card"
              >
                <Maximize2 size={11} />
              </button>
            )}
          </div>
        )}

        {isFolder && isExpanded && (
          <div className="tree-node-children">
            {childList.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="file-explorer-sidebar">
      <div className="sidebar-header-row">
        <div className="header-left">
          <FileCode size={15} />
          <h3>File Explorer</h3>
        </div>
        <button 
          type="button" 
          className="close-panel-btn" 
          onClick={onClose} 
          title="Collapse Explorer"
        >
          <X size={15} />
        </button>
      </div>

      <div className="explorer-search-wrapper">
        <Search size={14} className="search-icon" />
        <input 
          type="text" 
          placeholder="Filter workspace files..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button className="clear-search-btn" onClick={() => setSearchQuery('')}>
            <X size={12} />
          </button>
        )}
      </div>

      <div className="explorer-tree-view">
        {nodes.length === 0 ? (
          <div className="empty-tree-state">
            <span>No files mapped yet.</span>
            <span>Import a directory tree or load local folders.</span>
          </div>
        ) : (
          Object.values(treeData.children).map(child => renderTreeNode(child, 0))
        )}
      </div>
    </aside>
  );
};
