import type { CodeNode, NodeConnection, CanvasState } from '../types';

export interface User {
  id: string;
  email: string;
  passwordHash: string; // Plain password for mock storage, but we'll call it passwordHash
  name: string;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  nodeCount: number;
  connCount: number;
  layerStats?: {
    ui: number;
    logic: number;
    api: number;
    db: number;
    config: number;
    none: number;
  };
}

export interface ProjectMapData {
  nodes: CodeNode[];
  connections: NodeConnection[];
  canvasState: CanvasState;
}

const STORAGE_KEYS = {
  USERS: 'ac_db_users',
  CURRENT_SESSION: 'ac_db_session',
  PROJECTS: 'ac_db_projects',
  PROJECT_DATA_PREFIX: 'ac_db_project_data_'
};

// Helper: Get data from LocalStorage with fallback
const getStorageItem = <T>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    console.error(`Failed to read key: ${key}`, e);
    return fallback;
  }
};

// Helper: Set data to LocalStorage
const setStorageItem = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to write key: ${key}`, e);
  }
};

export const storageService = {
  // --- USER AUTHENTICATION ACTIONS ---
  
  registerUser: (email: string, password: string, name: string): User => {
    const users = getStorageItem<User[]>(STORAGE_KEYS.USERS, []);
    const normalizedEmail = email.toLowerCase().trim();

    if (users.some(u => u.email === normalizedEmail)) {
      throw new Error('An account with this email already exists.');
    }

    const newUser: User = {
      id: Math.random().toString(36).substring(2, 9),
      email: normalizedEmail,
      passwordHash: password, // Mock storage hashes password as plain string
      name: name.trim() || 'Developer'
    };

    users.push(newUser);
    setStorageItem(STORAGE_KEYS.USERS, users);
    
    // Auto-login after registration
    setStorageItem(STORAGE_KEYS.CURRENT_SESSION, newUser);
    return newUser;
  },

  loginUser: (email: string, password: string): User => {
    const users = getStorageItem<User[]>(STORAGE_KEYS.USERS, []);
    const normalizedEmail = email.toLowerCase().trim();

    const user = users.find(u => u.email === normalizedEmail && u.passwordHash === password);
    if (!user) {
      throw new Error('Invalid email or password.');
    }

    setStorageItem(STORAGE_KEYS.CURRENT_SESSION, user);
    return user;
  },

  logoutUser: (): void => {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_SESSION);
  },

  getCurrentUser: (): User | null => {
    return getStorageItem<User | null>(STORAGE_KEYS.CURRENT_SESSION, null);
  },

  // --- PROJECTS DATABASE ACTIONS ---

  getProjects: (userId: string): Project[] => {
    const projects = getStorageItem<Project[]>(STORAGE_KEYS.PROJECTS, []);
    // Return projects owned by this user, ordered by last updated date desc
    return projects
      .filter(p => p.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  createProject: (userId: string, name: string, description: string): Project => {
    const projects = getStorageItem<Project[]>(STORAGE_KEYS.PROJECTS, []);
    
    const newProject: Project = {
      id: Math.random().toString(36).substring(2, 9),
      userId,
      name: name.trim() || 'Untitled Codebase',
      description: description.trim() || 'Visual codebase architecture map.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodeCount: 0,
      connCount: 0,
      layerStats: { ui: 0, logic: 0, api: 0, db: 0, config: 0, none: 0 }
    };

    projects.push(newProject);
    setStorageItem(STORAGE_KEYS.PROJECTS, projects);

    // Initialize empty project map data
    const emptyData: ProjectMapData = {
      nodes: [],
      connections: [],
      canvasState: { panX: 50, panY: 80, scale: 0.85 }
    };
    setStorageItem(`${STORAGE_KEYS.PROJECT_DATA_PREFIX}${newProject.id}`, emptyData);

    return newProject;
  },

  getProjectData: (projectId: string): ProjectMapData | null => {
    return getStorageItem<ProjectMapData | null>(`${STORAGE_KEYS.PROJECT_DATA_PREFIX}${projectId}`, null);
  },

  saveProjectData: (projectId: string, nodes: CodeNode[], connections: NodeConnection[], canvasState: CanvasState): void => {
    const projects = getStorageItem<Project[]>(STORAGE_KEYS.PROJECTS, []);
    const projectIndex = projects.findIndex(p => p.id === projectId);
    
    if (projectIndex === -1) return;

    // Filter connections to ensure no self loops are stored
    const cleanConns = connections.filter(c => c.fromNodeId !== c.toNodeId);

    // Compile layer stats
    const layerStats = { ui: 0, logic: 0, api: 0, db: 0, config: 0, none: 0 };
    nodes.forEach(n => {
      if (n.layer && n.layer in layerStats) {
        layerStats[n.layer as keyof typeof layerStats]++;
      } else {
        layerStats.none++;
      }
    });

    // Update metadata
    projects[projectIndex] = {
      ...projects[projectIndex],
      updatedAt: new Date().toISOString(),
      nodeCount: nodes.length,
      connCount: cleanConns.length,
      layerStats
    };

    setStorageItem(STORAGE_KEYS.PROJECTS, projects);

    // Update canvas map data
    const mapData: ProjectMapData = {
      nodes,
      connections: cleanConns,
      canvasState
    };
    setStorageItem(`${STORAGE_KEYS.PROJECT_DATA_PREFIX}${projectId}`, mapData);
  },

  deleteProject: (projectId: string): void => {
    // Delete project from list
    const projects = getStorageItem<Project[]>(STORAGE_KEYS.PROJECTS, []);
    const filtered = projects.filter(p => p.id !== projectId);
    setStorageItem(STORAGE_KEYS.PROJECTS, filtered);

    // Delete map coordinate data
    localStorage.removeItem(`${STORAGE_KEYS.PROJECT_DATA_PREFIX}${projectId}`);
  },

  renameProject: (projectId: string, name: string, description: string): Project | null => {
    const projects = getStorageItem<Project[]>(STORAGE_KEYS.PROJECTS, []);
    const projectIndex = projects.findIndex(p => p.id === projectId);
    
    if (projectIndex === -1) return null;

    projects[projectIndex] = {
      ...projects[projectIndex],
      name: name.trim() || 'Untitled Codebase',
      description: description.trim() || projects[projectIndex].description,
      updatedAt: new Date().toISOString()
    };

    setStorageItem(STORAGE_KEYS.PROJECTS, projects);
    return projects[projectIndex];
  }
};
