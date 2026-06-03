import { useState, useEffect } from 'react';
import { Layers } from 'lucide-react';
import { Toolbar } from './components/Toolbar';
import { CanvasWorkspace } from './components/CanvasWorkspace';
import { DetailsPanel } from './components/DetailsPanel';
import type { CodeNode, NodeConnection, CanvasState, LayerType } from './types';
import './App.css';

const DEFAULT_CANVAS_STATE: CanvasState = {
  panX: 50,
  panY: 80,
  scale: 0.85
};

export default function App() {
  const [nodes, setNodes] = useState<CodeNode[]>([]);
  const [connections, setConnections] = useState<NodeConnection[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [canvasState, setCanvasState] = useState<CanvasState>(DEFAULT_CANVAS_STATE);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleSelectNode = (id: string | null) => {
    setSelectedNodeId(id);
    if (id) {
      setIsSidebarOpen(true);
    }
  };

  // Load saved canvas structures on mount
  useEffect(() => {
    try {
      const savedNodes = localStorage.getItem('ac_nodes');
      const savedConns = localStorage.getItem('ac_connections');
      const savedState = localStorage.getItem('ac_state');

      if (savedNodes) setNodes(JSON.parse(savedNodes));
      if (savedConns) setConnections(JSON.parse(savedConns));
      if (savedState) setCanvasState(JSON.parse(savedState));
    } catch (e) {
      console.error('Failed to load canvas state', e);
    }
  }, []);

  const saveState = (newNodes: CodeNode[], newConns: NodeConnection[]) => {
    setNodes(newNodes);
    setConnections(newConns);
    localStorage.setItem('ac_nodes', JSON.stringify(newNodes));
    localStorage.setItem('ac_connections', JSON.stringify(newConns));
  };

  // 1. Classification Helper (predicts architectural layer from path name)
  const classifyLayer = (path: string): LayerType => {
    const lower = path.toLowerCase();
    if (lower.includes('/components/') || lower.includes('/views/') || lower.includes('/styles/') || lower.includes('/css')) {
      return 'ui';
    }
    if (lower.includes('/hooks/') || lower.includes('/store/') || lower.includes('/context/') || lower.includes('/utils/')) {
      return 'logic';
    }
    if (lower.includes('/api/') || lower.includes('/routes/') || lower.includes('/controllers/')) {
      return 'api';
    }
    if (lower.includes('/models/') || lower.includes('/db/') || lower.includes('/schema/')) {
      return 'db';
    }
    if (lower.includes('config.') || lower.includes('.json') || lower.includes('.config.')) {
      return 'config';
    }
    return 'none';
  };

  // 2. Initial Layout Algorithm (places files below directories in a clean grid)
  const computeInitialCoordinates = (flatItems: any[]): CodeNode[] => {
    const spacingX = 260;
    const spacingY = 120;

    // Separate directories and files
    const directories = flatItems.filter(i => i.type === 'directory');
    const files = flatItems.filter(i => i.type === 'file');

    // Layout directories at the top (grouped by directory depth level)
    const dirsByDepth: Record<number, any[]> = {};
    directories.forEach(d => {
      const depth = d.path.split('/').length - 1;
      if (!dirsByDepth[depth]) dirsByDepth[depth] = [];
      dirsByDepth[depth].push(d);
    });

    const positionedNodes: CodeNode[] = [];

    // Position directories in cascading rows
    Object.entries(dirsByDepth).forEach(([depthStr, items]) => {
      const depth = parseInt(depthStr);
      items.forEach((item, index) => {
        positionedNodes.push({
          id: Math.random().toString(36).substring(2, 9),
          name: item.name,
          path: item.path,
          type: 'directory',
          x: index * spacingX + 50,
          y: depth * spacingY + 50,
          description: '',
          layer: 'none',
          size: item.size || 0
        });
      });
    });

    // Position files relative to their parent directories
    files.forEach((file, index) => {
      const pathParts = file.path.split('/');
      const parentPath = pathParts.slice(0, -1).join('/');
      
      // Find parent directory coordinate
      const parentNode = positionedNodes.find(n => n.path === parentPath && n.type === 'directory');
      
      let x = (index % 5) * spacingX + 50;
      let y = 350 + Math.floor(index / 5) * spacingY;

      if (parentNode) {
        // Offset files directly underneath their parent folder card
        x = parentNode.x;
        // Count how many files are already in this folder to stack them vertically
        const siblingFilesCount = positionedNodes.filter(
          n => n.type === 'file' && n.path.substring(0, n.path.lastIndexOf('/')) === parentPath
        ).length;
        y = parentNode.y + spacingY + siblingFilesCount * spacingY;
      }

      positionedNodes.push({
        id: Math.random().toString(36).substring(2, 9),
        name: file.name,
        path: file.path,
        type: 'file',
        x,
        y,
        description: '',
        layer: classifyLayer(file.path),
        size: file.size || 0
      });
    });

    return positionedNodes;
  };

  // 3. GitHub API Parser Engine
  const handleImportGitHub = async (url: string) => {
    setIsLoading(true);
    setSelectedNodeId(null);
    setConnections([]);

    try {
      // Parse owner and repo from URL
      const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) {
        alert('Invalid GitHub repository URL. Must be in the format: https://github.com/owner/repo');
        setIsLoading(false);
        return;
      }

      const owner = match[1];
      const repo = match[2].replace(/\.git$/, '');

      // Attempt to load main branch, fallback to master
      let response = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`);
      if (response.status === 444 || response.status === 404) {
        response = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`);
      }

      if (!response.ok) {
        throw new Error('Failed to load repository files tree from GitHub API.');
      }

      const resData = await response.json();
      if (!resData.tree) {
        throw new Error('No files found in this repository.');
      }

      // Filter out node_modules, .git, and build outputs
      const filteredItems = resData.tree
        .filter((item: any) => 
          !item.path.includes('node_modules/') && 
          !item.path.startsWith('.git/') &&
          !item.path.includes('dist/') &&
          !item.path.startsWith('package-lock.json')
        )
        .map((item: any) => ({
          name: item.path.split('/').pop() || '',
          path: item.path,
          type: item.type === 'tree' ? 'directory' : 'file',
          size: item.size || 0
        }));

      const newNodes = computeInitialCoordinates(filteredItems);
      saveState(newNodes, []);
      setCanvasState(DEFAULT_CANVAS_STATE);

    } catch (e: any) {
      alert(`Import failed: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 4. Local Folder Picker Parser Engine (File System Access API)
  const handleImportLocalDirectory = async () => {
    if (!('showDirectoryPicker' in window)) {
      alert('Local Directory Picker is not supported in this browser. Please use Chrome, Edge, or try the GitHub Import!');
      return;
    }

    setIsLoading(true);
    setSelectedNodeId(null);
    setConnections([]);

    try {
      const dirHandle = await (window as any).showDirectoryPicker();
      const flatItems: any[] = [];

      const readEntry = async (handle: any, parentPath = '') => {
        for await (const entry of handle.values()) {
          const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;
          
          // Filter folders
          if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' || entry.name === 'package-lock.json') {
            continue;
          }

          if (entry.kind === 'file') {
            const file = await entry.getFile();
            flatItems.push({
              name: entry.name,
              path,
              type: 'file',
              size: file.size
            });
          } else if (entry.kind === 'directory') {
            flatItems.push({
              name: entry.name,
              path,
              type: 'directory',
              size: 0
            });
            await readEntry(entry, path);
          }
        }
      };

      await readEntry(dirHandle);
      const newNodes = computeInitialCoordinates(flatItems);
      saveState(newNodes, []);
      setCanvasState(DEFAULT_CANVAS_STATE);

    } catch (e: any) {
      // Aborted prompt or permission error
      console.log('Picker closed', e);
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Card Drag Coordination
  const handleNodeDrag = (id: string, x: number, y: number) => {
    const updated = nodes.map(n => {
      if (n.id === id) {
        return { ...n, x, y };
      }
      return n;
    });
    setNodes(updated);
  };

  // 6. Component Property Editing
  const handleChangeNode = (id: string, updatedFields: Partial<CodeNode>) => {
    const updated = nodes.map(n => {
      if (n.id === id) {
        return { ...n, ...updatedFields };
      }
      return n;
    });
    saveState(updated, connections);
  };

  // 7. Make Vector Connection Link
  const handleConnectEnd = (fromId: string, toId: string) => {
    // Avoid double linking or linking to self
    if (fromId === toId) return;
    if (connections.some(c => c.fromNodeId === fromId && c.toNodeId === toId)) return;

    const newConnection: NodeConnection = {
      id: Math.random().toString(36).substring(2, 9),
      fromNodeId: fromId,
      toNodeId: toId,
      label: ''
    };

    saveState(nodes, [...connections, newConnection]);
  };

  // 8. Delete Connection Link
  const handleDeleteConnection = (connId: string) => {
    const updated = connections.filter(c => c.id !== connId);
    saveState(nodes, updated);
  };

  // 9. Auto Layout Sorting Engine
  const handleAutoLayout = () => {
    if (nodes.length === 0) return;
    const spacingX = 260;
    const spacingY = 120;

    const directories = nodes.filter(n => n.type === 'directory');
    const files = nodes.filter(n => n.type === 'file');

    const dirsByDepth: Record<number, CodeNode[]> = {};
    directories.forEach(d => {
      const depth = d.path.split('/').length - 1;
      if (!dirsByDepth[depth]) dirsByDepth[depth] = [];
      dirsByDepth[depth].push(d);
    });

    const updatedNodes: CodeNode[] = [];

    // Reset folders coordinates
    Object.entries(dirsByDepth).forEach(([depthStr, items]) => {
      const depth = parseInt(depthStr);
      items.forEach((item, index) => {
        updatedNodes.push({
          ...item,
          x: index * spacingX + 50,
          y: depth * spacingY + 50
        });
      });
    });

    // Reset files coordinates below folders
    files.forEach((file, index) => {
      const parentPath = file.path.substring(0, file.path.lastIndexOf('/'));
      const parentNode = updatedNodes.find(n => n.path === parentPath && n.type === 'directory');

      let x = (index % 5) * spacingX + 50;
      let y = 380 + Math.floor(index / 5) * spacingY;

      if (parentNode) {
        x = parentNode.x;
        const siblingFilesCount = updatedNodes.filter(
          n => n.type === 'file' && n.path.substring(0, n.path.lastIndexOf('/')) === parentPath
        ).length;
        y = parentNode.y + spacingY + siblingFilesCount * spacingY;
      }

      updatedNodes.push({
        ...file,
        x,
        y
      });
    });

    saveState(updatedNodes, connections);
    setCanvasState(DEFAULT_CANVAS_STATE);
  };

  // 10. Clear Workspace Canvas
  const handleClearCanvas = () => {
    if (window.confirm('Wipe this codebase mapping clean? All custom annotations and links will be lost.')) {
      saveState([], []);
      setSelectedNodeId(null);
      setCanvasState(DEFAULT_CANVAS_STATE);
    }
  };

  // 11. Markdown GFM + Mermaid Compiler Builder
  const handleExportMarkdown = (): string => {
    const totalFiles = nodes.filter(n => n.type === 'file').length;
    const totalFolders = nodes.filter(n => n.type === 'directory').length;

    let md = `# Codebase Architecture Map 🌐\n\n`;
    md += `This document maps out the file structures and directory dependencies of the project. It provides visual architectural maps of modules, responsibilities, and flows.\n\n`;
    
    // Overview metrics
    md += `### Project Statistics 📊\n\n`;
    md += `| Category | Metric Count |\n`;
    md += `| :--- | :--- |\n`;
    md += `| **Directories Mapped** | ${totalFolders} |\n`;
    md += `| **Source Files Mapped** | ${totalFiles} |\n`;
    md += `| **Dependency Links** | ${connections.length} |\n\n`;

    // Folder modules directory list
    md += `### Module Responsibilities 🗒️\n\n`;
    nodes.forEach(n => {
      if (n.description) {
        const layerBadge = n.layer !== 'none' ? ` \`[Layer: ${n.layer.toUpperCase()}]\` ` : '';
        md += `*   **\`${n.path}\`**${layerBadge}: ${n.description}\n`;
      }
    });
    md += `\n`;

    // Mermaid dependency flow graph (GitHub compatible)
    if (connections.length > 0) {
      md += `### Architectural Dependency Flow Graph 🔀\n\n`;
      md += `\`\`\`mermaid\ngraph TD\n`;
      
      // Clean names (remove file extension, hyphens mapping for Mermaid compliance)
      const sanitizeMermaidId = (nodeId: string) => `node_${nodeId}`;

      // Write nodes definitions
      nodes.forEach(n => {
        const shape = n.type === 'directory' ? `["📁 ${n.name}"]` : `("📄 ${n.name}")`;
        md += `  ${sanitizeMermaidId(n.id)}${shape}\n`;
      });

      md += `\n`;

      // Write relations
      connections.forEach(c => {
        md += `  ${sanitizeMermaidId(c.fromNodeId)} --> ${sanitizeMermaidId(c.toNodeId)}\n`;
      });

      md += `\`\`\`\n`;
    }

    return md;
  };

  return (
    <div className="app-container">
      {/* Floating Toolbar Controls */}
      <Toolbar 
        onImportGitHub={handleImportGitHub}
        onImportLocalDirectory={handleImportLocalDirectory}
        onClearCanvas={handleClearCanvas}
        onAutoLayout={handleAutoLayout}
        onZoomIn={() => setCanvasState(prev => ({ ...prev, scale: Math.min(prev.scale + 0.1, 3.0) }))}
        onZoomOut={() => setCanvasState(prev => ({ ...prev, scale: Math.max(prev.scale - 0.1, 0.15) }))}
        onZoomReset={() => setCanvasState(prev => ({ ...prev, scale: 1.0, panX: 100, panY: 100 }))}
        scale={canvasState.scale}
        isLoading={isLoading}
      />

      {/* Main Drag-Pan Canvas Port */}
      <CanvasWorkspace 
        nodes={nodes}
        connections={connections}
        selectedNodeId={selectedNodeId}
        onSelectNode={handleSelectNode}
        onNodeDrag={handleNodeDrag}
        onConnectEnd={handleConnectEnd}
        canvasState={canvasState}
        setCanvasState={setCanvasState}
      />

      {/* Floating Toggle Button on the side */}
      {!isSidebarOpen && (
        <button 
          className="sidebar-trigger-btn glass-plate" 
          onClick={() => setIsSidebarOpen(true)}
          title="Open Project Overview"
        >
          <Layers size={14} />
          <span>Project Overview</span>
        </button>
      )}

      {/* Side Details Panel */}
      <div className={`details-sidebar-container ${isSidebarOpen ? '' : 'collapsed'}`}>
        <DetailsPanel 
          selectedNode={nodes.find(n => n.id === selectedNodeId) || null}
          connections={connections}
          nodes={nodes}
          onChangeNode={handleChangeNode}
          onDeleteConnection={handleDeleteConnection}
          onExportMarkdown={handleExportMarkdown}
          onClose={() => setIsSidebarOpen(false)}
        />
      </div>
    </div>
  );
}
