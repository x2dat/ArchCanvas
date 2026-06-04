import React, { useState } from 'react';
import { 
  FolderPlus, 
  Trash2, 
  Maximize2, 
  ZoomIn, 
  ZoomOut, 
  Sparkles,
  Loader,
  Link2,
  Home
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
  onImportGitHub: (url: string) => void;
  onImportLocalDirectory: () => void;
  onAutoLayout: () => void;
  onAutoLink: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  scale: number;
  isLoading: boolean;
  onExitProject?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onImportGitHub,
  onImportLocalDirectory,
  onAutoLayout,
  onAutoLink,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  scale,
  isLoading,
  onExitProject
}) => {
  const [githubUrl, setGithubUrl] = useState('');

  const handleClearClick = () => {
    alert("To delete connections, clear layers, or manage your workspace map, please open the 'Project Overview' panel (bottom-right button) and use the 'Developer Toolkit' menu.");
  };

  const handleGitHubSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUrl.trim()) return;
    onImportGitHub(githubUrl.trim());
    setGithubUrl('');
  };

  const isLocalPickerSupported = 'showDirectoryPicker' in window;

  return (
    <div className="toolbar-panel glass-plate">
      {onExitProject && (
        <>
          <button 
            type="button"
            className="exit-project-btn" 
            onClick={onExitProject}
            title="Return to Projects Dashboard"
          >
            <Home size={14} />
            <span>Dashboard</span>
          </button>
          <div className="toolbar-divider"></div>
        </>
      )}

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

      {/* Local Folder Import */}
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

        <button 
          onClick={handleClearClick} 
          title="Wipe canvas clean"
          className="utility-btn danger"
          disabled={isLoading}
        >
          <Trash2 size={14} />
          <span>Clear Map</span>
        </button>
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
