import { useState, useEffect } from 'react';
import { Layers, Home } from 'lucide-react';
import { Toolbar } from './components/Toolbar';
import { CanvasWorkspace } from './components/CanvasWorkspace';
import { DetailsPanel } from './components/DetailsPanel';
import { AuthScreen } from './components/AuthScreen';
import { Dashboard } from './components/Dashboard';
import { storageService } from './services/storage';
import type { User } from './services/storage';
import type { CodeNode, NodeConnection, CanvasState, LayerType } from './types';
import './App.css';

const DEFAULT_CANVAS_STATE: CanvasState = {
  panX: 50,
  panY: 80,
  scale: 0.85
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<CodeNode[]>([]);
  const [connections, setConnections] = useState<NodeConnection[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [canvasState, setCanvasState] = useState<CanvasState>(DEFAULT_CANVAS_STATE);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [importWarning, setImportWarning] = useState<string | null>(null);
  const [historyBackup, setHistoryBackup] = useState<{ nodes: CodeNode[], connections: NodeConnection[] } | null>(null);

  const handleSelectNode = (id: string | null) => {
    setSelectedNodeId(id);
    if (id) {
      setIsSidebarOpen(true);
    }
  };

  // Load user session on mount
  useEffect(() => {
    const loadSession = async () => {
      const sessionUser = await storageService.getCurrentUser();
      if (sessionUser) {
        setCurrentUser(sessionUser);
      }
    };
    loadSession();
  }, []);

  // Load project map data whenever activeProjectId changes
  useEffect(() => {
    if (!activeProjectId) {
      setNodes([]);
      setConnections([]);
      setCanvasState(DEFAULT_CANVAS_STATE);
      setSelectedNodeId(null);
      return;
    }
    const loadProject = async () => {
      const data = await storageService.getProjectData(activeProjectId);
      if (data) {
        setNodes(data.nodes);
        setConnections(data.connections);
        setCanvasState(data.canvasState);
      }
    };
    loadProject();
  }, [activeProjectId]);

  const handleUpdateCanvasState = (updater: CanvasState | ((prev: CanvasState) => CanvasState)) => {
    setCanvasState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (activeProjectId) {
        storageService.saveProjectData(activeProjectId, nodes, connections, next);
      }
      return next;
    });
  };

  const saveState = (newNodes: CodeNode[], newConns: NodeConnection[], newCanvasState?: CanvasState) => {
    const cleanConns = newConns.filter(c => c.fromNodeId !== c.toNodeId);
    setNodes(newNodes);
    setConnections(cleanConns);
    if (newCanvasState) {
      setCanvasState(newCanvasState);
    }
    if (activeProjectId) {
      storageService.saveProjectData(activeProjectId, newNodes, cleanConns, newCanvasState || canvasState);
    }
  };

  // Helper to filter out assets, dependencies, and build configurations
  const shouldIncludePath = (path: string, type: 'file' | 'directory'): boolean => {
    const lower = path.toLowerCase();
    const parts = lower.split('/');
    const ignoredDirs = ['node_modules', '.git', 'dist', 'build', 'out', 'target', 'coverage', '.next', '.nuxt', 'vendor', '.cache', 'tmp'];
    
    if (parts.some(part => ignoredDirs.includes(part))) {
      return false;
    }

    const ignoredFiles = [
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      'cargo.lock',
      'composer.lock',
      '.ds_store',
      'thumbs.db'
    ];
    const fileName = path.split('/').pop() || '';
    if (ignoredFiles.includes(fileName.toLowerCase())) {
      return false;
    }

    if (type === 'file') {
      const ignoredExtensions = [
        'png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp',
        'woff', 'woff2', 'ttf', 'eot',
        'mp4', 'webm', 'mov', 'avi', 'mp3', 'wav',
        'pdf', 'zip', 'tar', 'gz', 'rar',
        'map',
        'exe', 'dll', 'so', 'dylib', 'bin'
      ];
      const ext = fileName.split('.').pop() || '';
      if (ignoredExtensions.includes(ext.toLowerCase())) {
        return false;
      }
    }

    return true;
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
    let files = flatItems.filter(i => i.type === 'file');

    // Safeguard: If too many nodes, prune deeply nested files to prevent performance lag
    const maxItems = 180;
    if (directories.length + files.length > maxItems) {
      const total = directories.length + files.length;
      files = files.filter(f => f.path.split('/').length <= 3);
      setImportWarning(
        `This project is very large (${total} items). To keep the canvas fluid and readable, we have mapped all folders but restricted files to the top 2 sub-directory levels.`
      );
    }

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
        size: file.size || 0,
        content: file.content
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

      setImportWarning(null);
      // Filter out node_modules, .git, and build outputs using shouldIncludePath
      const filteredItems = resData.tree
        .filter((item: any) => 
          shouldIncludePath(item.path, item.type === 'tree' ? 'directory' : 'file')
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
      setImportWarning(null);

      const readEntry = async (handle: any, parentPath = '') => {
        for await (const entry of handle.values()) {
          const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;
          
          // Filter files and folders using shouldIncludePath
          if (!shouldIncludePath(path, entry.kind === 'directory' ? 'directory' : 'file')) {
            continue;
          }

          if (entry.kind === 'file') {
            const file = await entry.getFile();
            let fileContent = '';
            
            // Read source text files under 150KB for import scanning
            const ext = entry.name.split('.').pop()?.toLowerCase();
            const textExtensions = ['js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'html', 'json', 'py', 'rs', 'go', 'java', 'cpp', 'h'];
            if (file.size < 150 * 1024 && textExtensions.includes(ext || '')) {
              try {
                fileContent = await file.text();
              } catch (err) {
                console.warn('Failed to read file text', path, err);
              }
            }

            flatItems.push({
              name: entry.name,
              path,
              type: 'file',
              size: file.size,
              content: fileContent
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

  // 10.5 Path Resolver and Dependency Linker Methods
  const resolveRelativePath = (currentPath: string, importPath: string): string => {
    let cleanImport = importPath.replace(/^[@~]\//, '');
    const currentDirParts = currentPath.split('/').slice(0, -1);
    const importParts = cleanImport.split('/');
    
    for (const part of importParts) {
      if (part === '.' || part === '') {
        continue;
      }
      if (part === '..') {
        currentDirParts.pop();
      } else {
        currentDirParts.push(part);
      }
    }
    
    return currentDirParts.join('/');
  };

  const handleAutoLinkDependencies = () => {
    if (nodes.length === 0) return;

    // Backup current state for Undo
    setHistoryBackup({ nodes, connections });

    const newConnections: NodeConnection[] = [];
    const connectionKeys = new Set<string>();

    const addConnection = (fromId: string, toId: string) => {
      const key = `${fromId}->${toId}`;
      if (fromId !== toId && !connectionKeys.has(key)) {
        connectionKeys.add(key);
        newConnections.push({
          id: Math.random().toString(36).substring(2, 9),
          fromNodeId: fromId,
          toNodeId: toId,
          label: ''
        });
      }
    };

    const pathNodeMap: Record<string, CodeNode> = {};
    const baseNodeMap: Record<string, CodeNode> = {};

    nodes.forEach(node => {
      pathNodeMap[node.path.toLowerCase()] = node;
      
      const lastSlash = node.path.lastIndexOf('/');
      const baseName = lastSlash !== -1 ? node.path.substring(lastSlash + 1) : node.path;
      const dotIndex = baseName.lastIndexOf('.');
      const cleanName = dotIndex !== -1 ? baseName.substring(0, dotIndex) : baseName;
      const pathDir = lastSlash !== -1 ? node.path.substring(0, lastSlash) : '';
      const lookupKey = `${pathDir}/${cleanName}`.toLowerCase().replace(/^\//, '');
      baseNodeMap[lookupKey] = node;
    });

    nodes.forEach(node => {
      // 1. Static Content Scanner (Local imports)
      if (node.type === 'file' && node.content) {
        const lines = node.content.split('\n');
        const jsImportRegex = /(?:import|require|from)\s*\(?\s*['"](\.[^'"]+)['"]/g;
        const cssImportRegex = /(?:@import|url)\s*\(?\s*['"](\.[^'"]+)['"]/g;

        const ext = node.name.split('.').pop()?.toLowerCase();

        lines.forEach(line => {
          let matches;
          if (ext === 'js' || ext === 'jsx' || ext === 'ts' || ext === 'tsx') {
            while ((matches = jsImportRegex.exec(line)) !== null) {
              const relPath = matches[1];
              const resolved = resolveRelativePath(node.path, relPath);
              const targetNode = baseNodeMap[resolved.toLowerCase()] || pathNodeMap[resolved.toLowerCase()];
              if (targetNode) {
                addConnection(node.id, targetNode.id);
              }
            }
          } else if (ext === 'css' || ext === 'scss') {
            while ((matches = cssImportRegex.exec(line)) !== null) {
              const relPath = matches[1];
              const resolved = resolveRelativePath(node.path, relPath);
              const targetNode = pathNodeMap[resolved.toLowerCase()] || baseNodeMap[resolved.toLowerCase()];
              if (targetNode) {
                addConnection(node.id, targetNode.id);
              }
            }
          }
        });
      }

      // 2. Sibling Pairing Heuristic (matching files like Button.tsx <-> Button.css)
      if (node.type === 'file') {
        const lastSlash = node.path.lastIndexOf('/');
        const baseName = lastSlash !== -1 ? node.path.substring(lastSlash + 1) : node.path;
        const dotIndex = baseName.lastIndexOf('.');
        const cleanName = dotIndex !== -1 ? baseName.substring(0, dotIndex) : baseName;
        const parentDir = lastSlash !== -1 ? node.path.substring(0, lastSlash) : '';

        nodes.forEach(sibling => {
          if (sibling.id !== node.id && sibling.type === 'file') {
            const sibSlash = sibling.path.lastIndexOf('/');
            const sibParent = sibSlash !== -1 ? sibling.path.substring(0, sibSlash) : '';
            if (sibParent === parentDir) {
              const sibBase = sibSlash !== -1 ? sibling.path.substring(sibSlash + 1) : sibling.path;
              const sibDot = sibBase.lastIndexOf('.');
              const sibCleanName = sibDot !== -1 ? sibBase.substring(0, sibDot) : sibBase;
              if (sibCleanName === cleanName) {
                const ext = baseName.split('.').pop()?.toLowerCase();
                const sibExt = sibBase.split('.').pop()?.toLowerCase();
                if ((ext === 'css' || ext === 'scss') && (sibExt === 'js' || sibExt === 'jsx' || sibExt === 'ts' || sibExt === 'tsx')) {
                  addConnection(sibling.id, node.id);
                }
              }
            }
          }
        });
      }

      // 3. Folder structural links
      if (node.type === 'file') {
        const pathParts = node.path.split('/');
        const parentPath = pathParts.slice(0, -1).join('/');
        const parentNode = nodes.find(n => n.type === 'directory' && n.path === parentPath);
        if (parentNode) {
          addConnection(parentNode.id, node.id);
        }
      } else if (node.type === 'directory') {
        const pathParts = node.path.split('/');
        if (pathParts.length > 1) {
          const parentPath = pathParts.slice(0, -1).join('/');
          const parentNode = nodes.find(n => n.type === 'directory' && n.path === parentPath);
          if (parentNode) {
            addConnection(parentNode.id, node.id);
          }
        }
      }
    });

    if (newConnections.length === 0) {
      alert('Dependency scanner complete! No relative import paths or sibling resources found to auto-link.');
      return;
    }

    const mergedConns = [...connections];
    newConnections.forEach(nc => {
      if (!mergedConns.some(c => c.fromNodeId === nc.fromNodeId && c.toNodeId === nc.toNodeId)) {
        mergedConns.push(nc);
      }
    });

    saveState(nodes, mergedConns);
    setNodes(nodes);
    setConnections(mergedConns);
    setImportWarning(
      `Auto-linked ${newConnections.length} dependencies! You can cancel these changes using the [Undo] button in the toolbar.`
    );
  };

  const handleUndoAutoLink = () => {
    if (historyBackup) {
      saveState(historyBackup.nodes, historyBackup.connections);
      setHistoryBackup(null);
      setImportWarning('Cancelled dependency linking: Restored previous map and connections.');
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

    md += `\n---\n\n<p align="center">\n  <a href="https://github.com/x2dat/ArchCanvas">\n    <img src="https://img.shields.io/badge/Generated_with-ArchCanvas-8b5cf6?style=for-the-badge" alt="Generated with ArchCanvas" />\n  </a>\n</p>\n`;

    return md;
  };

  const handleLogout = () => {
    storageService.logoutUser();
    setCurrentUser(null);
    setActiveProjectId(null);
  };

  const handleUpdateProfile = async (updates: { name: string }) => {
    if (!currentUser) return;
    const updatedUser = await storageService.updateProfile(currentUser.id, updates);
    setCurrentUser(updatedUser);
  };

  const handleExitProject = () => {
    if (activeProjectId) {
      storageService.saveProjectData(activeProjectId, nodes, connections, canvasState);
    }
    setActiveProjectId(null);
  };

  if (!currentUser) {
    return <AuthScreen onAuthSuccess={(user) => setCurrentUser(user)} />;
  }

  if (!activeProjectId) {
    return (
      <Dashboard 
        currentUser={currentUser} 
        onSelectProject={(id) => setActiveProjectId(id)} 
        onLogout={handleLogout}
        onUpdateProfile={handleUpdateProfile}
      />
    );
  }

  return (
    <div className={`app-container ${isSidebarOpen ? 'sidebar-open' : ''}`}>
      {/* Back to Dashboard Floating Button */}
      <button 
        type="button"
        className="back-dashboard-btn glass-plate animate-fade-in" 
        onClick={handleExitProject}
        title="Return to Projects Dashboard"
      >
        <Home size={14} />
        <span>Dashboard</span>
      </button>

      {importWarning && (
        <div className="import-warning-banner glass-plate" style={{
          position: 'absolute',
          top: '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          background: 'rgba(245, 162, 27, 0.15)',
          border: '1px solid rgba(245, 162, 27, 0.4)',
          padding: '12px 20px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          backdropFilter: 'blur(10px)',
          fontSize: '0.82rem',
          color: '#ffd073',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          width: 'max-content',
          maxWidth: '90%',
          justifyContent: 'space-between'
        }}>
          <span>⚠️ {importWarning}</span>
          <button 
            onClick={() => setImportWarning(null)} 
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '1.2rem',
              lineHeight: '1',
              padding: '0 0 0 10px'
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Floating Toolbar Controls */}
      <Toolbar 
        onImportGitHub={handleImportGitHub}
        onImportLocalDirectory={handleImportLocalDirectory}
        onAutoLayout={handleAutoLayout}
        onAutoLink={handleAutoLinkDependencies}
        onZoomIn={() => handleUpdateCanvasState(prev => ({ ...prev, scale: Math.min(prev.scale + 0.1, 3.0) }))}
        onZoomOut={() => handleUpdateCanvasState(prev => ({ ...prev, scale: Math.max(prev.scale - 0.1, 0.15) }))}
        onZoomReset={() => handleUpdateCanvasState(prev => ({ ...prev, scale: 1.0, panX: 100, panY: 100 }))}
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
        setCanvasState={handleUpdateCanvasState}
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
          isLoading={isLoading}
          onImportJson={(newNodes, newConns) => {
            saveState(newNodes, newConns);
            handleUpdateCanvasState(DEFAULT_CANVAS_STATE);
            setSelectedNodeId(null);
            setImportWarning(`Successfully restored workspace canvas with ${newNodes.length} nodes!`);
          }}
          onClearAllConnections={() => {
            if (window.confirm('Delete all connection lines? This cannot be undone.')) {
              saveState(nodes, []);
            }
          }}
          onClearAllLayers={() => {
            if (window.confirm('Reset all nodes to general layer type?')) {
              const updated = nodes.map(n => ({ ...n, layer: 'none' as const }));
              saveState(updated, connections);
            }
          }}
          onAutoClassifyAllLayers={() => {
            if (window.confirm('Scan file paths and re-classify architectural layers? This will override custom layers.')) {
              const updated = nodes.map(n => ({ ...n, layer: classifyLayer(n.path) }));
              saveState(updated, connections);
            }
          }}
          onClearCanvas={handleClearCanvas}
          onUndo={handleUndoAutoLink}
          canUndo={!!historyBackup}
        />
      </div>
    </div>
  );
}
