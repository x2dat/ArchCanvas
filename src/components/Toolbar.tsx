import React, { useState } from 'react';
import { 
  FolderPlus, 
  Maximize2, 
  ZoomIn, 
  ZoomOut, 
  Sparkles,
  Loader,
  Link2,
  Home,
  Layers,
  FileText
} from 'lucide-react';

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
  projectName: string;
  projectDescription: string;
  onImportGitHub: (url: string) => void;
  onImportLocalDirectory: () => void;
  onAutoLayout: () => void;
  onAutoLink: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onExitProject?: () => void;
  scale: number;
  isLoading: boolean;
  isLeftOpen: boolean;
  isRightOpen: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  projectName,
  projectDescription,
  onImportGitHub,
  onImportLocalDirectory,
  onAutoLayout,
  onAutoLink,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onExitProject,
  scale,
  isLoading,
  isLeftOpen,
  isRightOpen,
  onToggleLeft,
  onToggleRight
}) => {
  const [githubUrl, setGithubUrl] = useState('');

  const handleGitHubSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUrl.trim()) return;
    onImportGitHub(githubUrl.trim());
    setGithubUrl('');
  };

  const isLocalPickerSupported = 'showDirectoryPicker' in window;

  return (
    <header className="workspace-header glass-plate">
      {/* Left side: Back + Project Info */}
      <div className="header-left-group">
        {onExitProject && (
          <>
            <button 
              type="button" 
              className="header-back-btn" 
              onClick={onExitProject}
              title="Save and exit to Dashboard"
            >
              <Home size={14} />
              <span>Dashboard</span>
            </button>
            <div className="header-divider"></div>
          </>
        )}
        
        <div className="header-project-meta">
          <h2 className="header-project-name" title={projectName}>
            {projectName}
          </h2>
          <span className="header-project-desc" title={projectDescription || 'No description'}>
            {projectDescription || 'Visual codebase architecture map.'}
          </span>
        </div>
      </div>

      {/* Center side: Import and layout utilities */}
      <div className="header-center-group">
        {/* GitHub Import Form */}
        <form onSubmit={handleGitHubSubmit} className="import-form">
          <div className="input-with-icon">
            <Github size={13} className="input-icon" />
            <input 
              type="text" 
              placeholder="GitHub URL..." 
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <button type="submit" className="import-btn" disabled={isLoading}>
            {isLoading ? <Loader size={11} className="animate-spin" /> : 'Import'}
          </button>
        </form>

        {/* Local Folder Import */}
        <button 
          type="button" 
          className="local-picker-btn" 
          onClick={onImportLocalDirectory}
          disabled={isLoading}
          title={isLocalPickerSupported ? 'Import local project folder' : 'Directory Picker unsupported in this browser'}
        >
          <FolderPlus size={13} />
          <span>Load Folder</span>
        </button>

        <div className="header-divider"></div>

        {/* Canvas Utilities */}
        <button 
          onClick={onAutoLayout} 
          title="Auto-organize files hierarchy"
          className="utility-btn"
          disabled={isLoading}
        >
          <Sparkles size={13} />
          <span>Auto Layout</span>
        </button>
        
        <button 
          onClick={onAutoLink} 
          title="Automatically link file dependencies"
          className="utility-btn"
          disabled={isLoading}
        >
          <Link2 size={13} />
          <span>Auto-Link</span>
        </button>
      </div>

      {/* Right side: Zoom + Sidebars toggles */}
      <div className="header-right-group">
        {/* Zoom Controllers */}
        <div className="zoom-controls">
          <button onClick={onZoomOut} title="Zoom out" className="zoom-btn-circle"><ZoomOut size={12} /></button>
          <span className="scale-readout" onClick={onZoomReset} title="Reset zoom (100%)">
            {Math.round(scale * 100)}%
          </span>
          <button onClick={onZoomIn} title="Zoom in" className="zoom-btn-circle"><ZoomIn size={12} /></button>
          <button onClick={onZoomReset} title="Fit screen" className="zoom-btn-circle"><Maximize2 size={11} /></button>
        </div>

        <div className="header-divider"></div>

        {/* Toggle Panel buttons */}
        <button 
          type="button"
          className={`sidebar-toggle-btn ${isLeftOpen ? 'active' : ''}`}
          onClick={onToggleLeft}
          title="Toggle Left File Explorer"
        >
          <FileText size={14} />
        </button>
        
        <button 
          type="button"
          className={`sidebar-toggle-btn ${isRightOpen ? 'active' : ''}`}
          onClick={onToggleRight}
          title="Toggle Right Project Inspector"
        >
          <Layers size={14} />
        </button>
      </div>
    </header>
  );
};
