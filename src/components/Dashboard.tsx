import React, { useState, useEffect } from 'react';
import { 
  FolderPlus, 
  Search, 
  Clock, 
  Layers, 
  Trash2, 
  Edit2, 
  ArrowRight, 
  LogOut, 
  User as UserIcon, 
  Code,
  Sparkles,
  FileText,
  X
} from 'lucide-react';
import { storageService } from '../services/storage';
import type { Project, User } from '../services/storage';

interface DashboardProps {
  currentUser: User;
  onSelectProject: (projectId: string) => void;
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ currentUser, onSelectProject, onLogout }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');

  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const loadProjects = async () => {
    const list = await storageService.getProjects(currentUser.id);
    setProjects(list);
  };

  useEffect(() => {
    loadProjects();
  }, [currentUser]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    const proj = await storageService.createProject(
      currentUser.id,
      newProjectName,
      newProjectDesc
    );

    setNewProjectName('');
    setNewProjectDesc('');
    setIsCreateModalOpen(false);
    
    // Automatically open the newly created project workspace
    onSelectProject(proj.id);
  };

  const handleRenameProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject || !editName.trim()) return;

    await storageService.renameProject(editingProject.id, editName, editDesc);
    setEditingProject(null);
    loadProjects();
  };

  const handleDeleteProject = async (projectId: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid opening the project workspace card
    if (window.confirm(`Are you sure you want to delete "${name}"? This will permanently wipe all mapping layout and custom annotations.`)) {
      await storageService.deleteProject(projectId);
      loadProjects();
    }
  };

  const startEditProject = (proj: Project, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid opening the project card
    setEditingProject(proj);
    setEditName(proj.name);
    setEditDesc(proj.description);
  };

  // Search filter
  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Time formatter
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="dashboard-viewport">
      {/* Navbar header */}
      <header className="dashboard-navbar glass-plate">
        <div className="nav-brand">
          <div className="brand-logo">
            <Sparkles size={18} className="logo-icon" />
          </div>
          <h2>ArchCanvas</h2>
          <span className="badge">WORKSPACE</span>
        </div>

        <div className="nav-profile">
          <div className="user-info">
            <UserIcon size={14} className="user-icon" />
            <span>{currentUser.name}</span>
          </div>
          <button 
            type="button" 
            className="logout-btn secondary-btn"
            onClick={onLogout}
            title="Log Out Profile"
          >
            <LogOut size={13} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Panel Content */}
      <main className="dashboard-content">
        <section className="welcome-banner">
          <h1>Welcome, {currentUser.name}!</h1>
          <p>Select an existing map workspace or initialize a new codebase parser map below.</p>
        </section>

        {/* Dashboard Actions Row */}
        <div className="dashboard-actions-bar">
          <div className="search-wrapper glass-plate">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder="Search workspaces by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="clear-search" onClick={() => setSearchQuery('')}>
                <X size={14} />
              </button>
            )}
          </div>

          <button 
            type="button" 
            className="create-project-btn"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <FolderPlus size={16} />
            <span>Create New Project</span>
          </button>
        </div>

        {/* Grid List Projects */}
        {filteredProjects.length === 0 ? (
          <div className="empty-dashboard-state glass-plate">
            <Code size={40} className="empty-icon" />
            <h3>No Workspaces Found</h3>
            <p>
              {searchQuery 
                ? "No matching projects found for your search term."
                : "Initialize your first project mapping canvas to start documenting your code bases."}
            </p>
            {!searchQuery && (
              <button 
                type="button" 
                className="create-project-btn"
                onClick={() => setIsCreateModalOpen(true)}
              >
                <FolderPlus size={15} />
                <span>Initialize First Project</span>
              </button>
            )}
          </div>
        ) : (
          <div className="projects-grid-list">
            {filteredProjects.map(proj => {
              // Calculate layer colors percentages for the indicator bar
              const totalNodes = proj.nodeCount || 0;
              const stats = proj.layerStats || { ui: 0, logic: 0, api: 0, db: 0, config: 0, none: 0 };
              
              const uiPercent = totalNodes > 0 ? (stats.ui / totalNodes) * 100 : 0;
              const logicPercent = totalNodes > 0 ? (stats.logic / totalNodes) * 100 : 0;
              const apiPercent = totalNodes > 0 ? (stats.api / totalNodes) * 100 : 0;
              const dbPercent = totalNodes > 0 ? (stats.db / totalNodes) * 100 : 0;
              const configPercent = totalNodes > 0 ? ((stats.config || 0) / totalNodes) * 100 : 0;
              const nonePercent = totalNodes > 0 ? ((stats.none || 0) / totalNodes) * 100 : 0;

              return (
                <div 
                  key={proj.id} 
                  className="project-summary-card glass-plate"
                  onClick={() => onSelectProject(proj.id)}
                >
                  <div className="card-header-row">
                    <h3 className="project-title truncate-text" title={proj.name}>
                      {proj.name}
                    </h3>
                    <div className="card-actions-wrapper">
                      <button 
                        type="button"
                        className="card-action-icon-btn" 
                        onClick={(e) => startEditProject(proj, e)}
                        title="Edit Project Details"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button 
                        type="button"
                        className="card-action-icon-btn delete-btn" 
                        onClick={(e) => handleDeleteProject(proj.id, proj.name, e)}
                        title="Delete Project Workspace"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <p className="project-desc-text line-clamp-2">
                    {proj.description || 'No project description added yet.'}
                  </p>

                  {/* Project Metrics Summary */}
                  <div className="project-card-metrics">
                    <div className="metric-tag">
                      <FileText size={12} />
                      <span>{proj.nodeCount} Components</span>
                    </div>
                    <div className="metric-tag">
                      <Layers size={12} />
                      <span>{proj.connCount} Dependency Links</span>
                    </div>
                  </div>

                  {/* Layer Distribution Bar chart */}
                  {totalNodes > 0 && (
                    <div className="project-layer-bar-container">
                      <span className="layer-bar-label">Architecture Layer Balance:</span>
                      <div className="layer-distribution-bar">
                        {uiPercent > 0 && <div className="bar-segment ui-segment" style={{ width: `${uiPercent}%` }} title={`UI Components: ${stats.ui} (${Math.round(uiPercent)}%)`}></div>}
                        {logicPercent > 0 && <div className="bar-segment logic-segment" style={{ width: `${logicPercent}%` }} title={`Business Logic: ${stats.logic} (${Math.round(logicPercent)}%)`}></div>}
                        {apiPercent > 0 && <div className="bar-segment api-segment" style={{ width: `${apiPercent}%` }} title={`API / Routes: ${stats.api} (${Math.round(apiPercent)}%)`}></div>}
                        {dbPercent > 0 && <div className="bar-segment db-segment" style={{ width: `${dbPercent}%` }} title={`Database: ${stats.db} (${Math.round(dbPercent)}%)`}></div>}
                        {configPercent > 0 && <div className="bar-segment config-segment" style={{ width: `${configPercent}%` }} title={`Config / Helpers: ${stats.config} (${Math.round(configPercent)}%)`}></div>}
                        {nonePercent > 0 && <div className="bar-segment none-segment" style={{ width: `${nonePercent}%` }} title={`Unassigned Nodes: ${stats.none} (${Math.round(nonePercent)}%)`}></div>}
                      </div>
                    </div>
                  )}

                  <div className="card-footer-row">
                    <div className="last-saved-time">
                      <Clock size={11} />
                      <span>Updated {formatTime(proj.updatedAt)}</span>
                    </div>
                    <div className="open-canvas-indicator">
                      <span>Open Map</span>
                      <ArrowRight size={13} className="slide-arrow" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* CREATE PROJECT DIALOG MODAL */}
      {isCreateModalOpen && (
        <div className="modal-overlay-backdrop">
          <div className="modal-content-panel glass-plate animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Project Workspace</h3>
              <button 
                type="button" 
                className="close-modal-btn" 
                onClick={() => setIsCreateModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleCreateProject} className="modal-form">
              <div className="form-group-field">
                <label htmlFor="new-proj-name">Project / Directory Name</label>
                <input 
                  id="new-proj-name"
                  type="text" 
                  placeholder="e.g. My Awesome WebApp"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  maxLength={50}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group-field">
                <label htmlFor="new-proj-desc">Short Description</label>
                <textarea 
                  id="new-proj-desc"
                  placeholder="Explain this project's scope, dependencies, or modules..."
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  maxLength={200}
                  rows={3}
                />
              </div>

              <div className="modal-actions-footer">
                <button 
                  type="button" 
                  className="secondary-btn" 
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="confirm-btn"
                  disabled={!newProjectName.trim()}
                >
                  Initialize Map
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PROJECT DIALOG MODAL */}
      {editingProject && (
        <div className="modal-overlay-backdrop">
          <div className="modal-content-panel glass-plate animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Project Details</h3>
              <button 
                type="button" 
                className="close-modal-btn" 
                onClick={() => setEditingProject(null)}
              >
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleRenameProject} className="modal-form">
              <div className="form-group-field">
                <label htmlFor="edit-proj-name">Project Name</label>
                <input 
                  id="edit-proj-name"
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={50}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group-field">
                <label htmlFor="edit-proj-desc">Project Description</label>
                <textarea 
                  id="edit-proj-desc"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  maxLength={200}
                  rows={3}
                />
              </div>

              <div className="modal-actions-footer">
                <button 
                  type="button" 
                  className="secondary-btn" 
                  onClick={() => setEditingProject(null)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="confirm-btn"
                  disabled={!editName.trim()}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
