import { supabase } from './supabase';
import type { CodeNode, NodeConnection, CanvasState } from '../types';

export interface User {
  id: string;
  email: string;
  passwordHash?: string; // Only used in local fallback mock storage
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
const getLocalStorageItem = <T>(key: string, fallback: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    console.error(`Failed to read local key: ${key}`, e);
    return fallback;
  }
};

// Helper: Set data to LocalStorage
const setLocalStorageItem = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to write local key: ${key}`, e);
  }
};

export const storageService = {
  // --- USER AUTHENTICATION ACTIONS ---
  
  registerUser: async (email: string, password: string, name: string): Promise<User> => {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Supabase Mode
    if (supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: { name: name.trim() }
        }
      });

      if (error) throw new Error(error.message);
      if (!data.user) throw new Error('Failed to register user.');

      // Insert record into the public profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: data.user.id,
          email: normalizedEmail,
          name: name.trim() || 'Developer',
          updated_at: new Date().toISOString()
        });

      if (profileError) {
        console.error('Failed to create user profile in public table', profileError);
      }

      return {
        id: data.user.id,
        email: normalizedEmail,
        name: name.trim() || 'Developer'
      };
    }

    // 2. Local Fallback Mode
    const users = getLocalStorageItem<User[]>(STORAGE_KEYS.USERS, []);
    if (users.some(u => u.email === normalizedEmail)) {
      throw new Error('An account with this email already exists.');
    }

    const newUser: User = {
      id: Math.random().toString(36).substring(2, 9),
      email: normalizedEmail,
      passwordHash: password,
      name: name.trim() || 'Developer'
    };

    users.push(newUser);
    setLocalStorageItem(STORAGE_KEYS.USERS, users);
    setLocalStorageItem(STORAGE_KEYS.CURRENT_SESSION, newUser);
    return newUser;
  },

  loginUser: async (email: string, password: string): Promise<User> => {
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Supabase Mode
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password
      });

      if (error) throw new Error(error.message);
      if (!data.user) throw new Error('Authentication failed.');

      // Fetch user profile from public table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', data.user.id)
        .single();

      return {
        id: data.user.id,
        email: normalizedEmail,
        name: (!profileError && profile?.name) ? profile.name : 'Developer'
      };
    }

    // 2. Local Fallback Mode
    const users = getLocalStorageItem<User[]>(STORAGE_KEYS.USERS, []);
    const user = users.find(u => u.email === normalizedEmail && u.passwordHash === password);
    if (!user) {
      throw new Error('Invalid email or password.');
    }

    setLocalStorageItem(STORAGE_KEYS.CURRENT_SESSION, user);
    return user;
  },

  logoutUser: async (): Promise<void> => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem(STORAGE_KEYS.CURRENT_SESSION);
  },

  getCurrentUser: async (): Promise<User | null> => {
    // 1. Supabase Mode
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Fetch name from profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', session.user.id)
          .single();

        return {
          id: session.user.id,
          email: session.user.email || '',
          name: profile?.name || 'Developer'
        };
      }
      return null;
    }

    // 2. Local Fallback Mode
    return getLocalStorageItem<User | null>(STORAGE_KEYS.CURRENT_SESSION, null);
  },

  // --- PROJECTS DATABASE ACTIONS ---

  getProjects: async (userId: string): Promise<Project[]> => {
    // 1. Supabase Mode
    if (supabase) {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Supabase query failed, falling back to local list', error);
      } else if (data) {
        return data.map(p => ({
          id: p.id,
          userId: p.user_id,
          name: p.name,
          description: p.description,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
          nodeCount: p.node_count,
          connCount: p.conn_count,
          layerStats: p.layer_stats
        }));
      }
    }

    // 2. Local Fallback Mode
    const projects = getLocalStorageItem<Project[]>(STORAGE_KEYS.PROJECTS, []);
    return projects
      .filter(p => p.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  createProject: async (userId: string, name: string, description: string): Promise<Project> => {
    const projectId = Math.random().toString(36).substring(2, 9);
    const newProject: Project = {
      id: projectId,
      userId,
      name: name.trim() || 'Untitled Codebase',
      description: description.trim() || 'Visual codebase architecture map.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodeCount: 0,
      connCount: 0,
      layerStats: { ui: 0, logic: 0, api: 0, db: 0, config: 0, none: 0 }
    };

    const emptyData: ProjectMapData = {
      nodes: [],
      connections: [],
      canvasState: { panX: 50, panY: 80, scale: 0.85 }
    };

    // 1. Supabase Mode
    if (supabase) {
      const { error: projError } = await supabase
        .from('projects')
        .insert({
          id: newProject.id,
          user_id: userId,
          name: newProject.name,
          description: newProject.description,
          created_at: newProject.createdAt,
          updated_at: newProject.updatedAt,
          node_count: newProject.nodeCount,
          conn_count: newProject.connCount,
          layer_stats: newProject.layerStats
        });

      if (!projError) {
        const { error: dataError } = await supabase
          .from('project_data')
          .insert({
            project_id: newProject.id,
            nodes: emptyData.nodes,
            connections: emptyData.connections,
            canvas_state: emptyData.canvasState,
            updated_at: new Date().toISOString()
          });

        if (!dataError) return newProject;
        console.error('Failed to initialize Supabase project data', dataError);
      } else {
        console.error('Failed to create Supabase project record', projError);
      }
    }

    // 2. Local Fallback Mode
    const projects = getLocalStorageItem<Project[]>(STORAGE_KEYS.PROJECTS, []);
    projects.push(newProject);
    setLocalStorageItem(STORAGE_KEYS.PROJECTS, projects);
    setLocalStorageItem(`${STORAGE_KEYS.PROJECT_DATA_PREFIX}${newProject.id}`, emptyData);

    return newProject;
  },

  getProjectData: async (projectId: string): Promise<ProjectMapData | null> => {
    // 1. Supabase Mode
    if (supabase) {
      const { data, error } = await supabase
        .from('project_data')
        .select('nodes, connections, canvas_state')
        .eq('project_id', projectId)
        .single();

      if (!error && data) {
        return {
          nodes: data.nodes as CodeNode[],
          connections: data.connections as NodeConnection[],
          canvasState: data.canvas_state as CanvasState
        };
      }
      console.error('Supabase project fetch failed, checking local', error);
    }

    // 2. Local Fallback Mode
    return getLocalStorageItem<ProjectMapData | null>(`${STORAGE_KEYS.PROJECT_DATA_PREFIX}${projectId}`, null);
  },

  saveProjectData: async (projectId: string, nodes: CodeNode[], connections: NodeConnection[], canvasState: CanvasState): Promise<void> => {
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

    const updatedAtStr = new Date().toISOString();

    // 1. Supabase Mode
    if (supabase) {
      const { error: projError } = await supabase
        .from('projects')
        .update({
          updated_at: updatedAtStr,
          node_count: nodes.length,
          conn_count: cleanConns.length,
          layer_stats: layerStats
        })
        .eq('id', projectId);

      if (!projError) {
        const { error: dataError } = await supabase
          .from('project_data')
          .upsert({
            project_id: projectId,
            nodes,
            connections: cleanConns,
            canvas_state: canvasState,
            updated_at: updatedAtStr
          });

        if (!dataError) return;
        console.error('Failed to sync project data in Supabase', dataError);
      } else {
        console.error('Failed to update project metadata in Supabase', projError);
      }
    }

    // 2. Local Fallback Mode
    const projects = getLocalStorageItem<Project[]>(STORAGE_KEYS.PROJECTS, []);
    const projectIndex = projects.findIndex(p => p.id === projectId);
    
    if (projectIndex !== -1) {
      projects[projectIndex] = {
        ...projects[projectIndex],
        updatedAt: updatedAtStr,
        nodeCount: nodes.length,
        connCount: cleanConns.length,
        layerStats
      };
      setLocalStorageItem(STORAGE_KEYS.PROJECTS, projects);
    }

    const mapData: ProjectMapData = {
      nodes,
      connections: cleanConns,
      canvasState
    };
    setLocalStorageItem(`${STORAGE_KEYS.PROJECT_DATA_PREFIX}${projectId}`, mapData);
  },

  deleteProject: async (projectId: string): Promise<void> => {
    // 1. Supabase Mode
    if (supabase) {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (!error) return;
      console.error('Failed to delete project in Supabase', error);
    }

    // 2. Local Fallback Mode
    const projects = getLocalStorageItem<Project[]>(STORAGE_KEYS.PROJECTS, []);
    const filtered = projects.filter(p => p.id !== projectId);
    setLocalStorageItem(STORAGE_KEYS.PROJECTS, filtered);
    localStorage.removeItem(`${STORAGE_KEYS.PROJECT_DATA_PREFIX}${projectId}`);
  },

  renameProject: async (projectId: string, name: string, description: string): Promise<Project | null> => {
    const updatedAtStr = new Date().toISOString();

    // 1. Supabase Mode
    if (supabase) {
      const { data, error } = await supabase
        .from('projects')
        .update({
          name: name.trim(),
          description: description.trim(),
          updated_at: updatedAtStr
        })
        .eq('id', projectId)
        .select()
        .single();

      if (!error && data) {
        return {
          id: data.id,
          userId: data.user_id,
          name: data.name,
          description: data.description,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          nodeCount: data.node_count,
          connCount: data.conn_count,
          layerStats: data.layer_stats
        };
      }
      console.error('Failed to rename project in Supabase', error);
    }

    // 2. Local Fallback Mode
    const projects = getLocalStorageItem<Project[]>(STORAGE_KEYS.PROJECTS, []);
    const projectIndex = projects.findIndex(p => p.id === projectId);
    
    if (projectIndex === -1) return null;

    projects[projectIndex] = {
      ...projects[projectIndex],
      name: name.trim() || 'Untitled Codebase',
      description: description.trim() || projects[projectIndex].description,
      updatedAt: updatedAtStr
    };

    setLocalStorageItem(STORAGE_KEYS.PROJECTS, projects);
    return projects[projectIndex];
  },

  updateProfile: async (userId: string, updates: { name: string }): Promise<User> => {
    const newName = updates.name.trim() || 'Developer';

    // 1. Supabase Mode
    if (supabase) {
      const { data: authUser, error: authError } = await supabase.auth.updateUser({
        data: { name: newName }
      });

      if (authError) throw new Error(authError.message);
      if (!authUser.user) throw new Error('User not authenticated.');

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: newName,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (profileError) throw new Error(profileError.message);

      return {
        id: userId,
        email: authUser.user.email || '',
        name: newName
      };
    }

    // 2. Local Fallback Mode
    const users = getLocalStorageItem<User[]>(STORAGE_KEYS.USERS, []);
    const userIndex = users.findIndex(u => u.id === userId);
    
    if (userIndex !== -1) {
      users[userIndex].name = newName;
      setLocalStorageItem(STORAGE_KEYS.USERS, users);
    }

    const sessionUser = getLocalStorageItem<User | null>(STORAGE_KEYS.CURRENT_SESSION, null);
    if (sessionUser && sessionUser.id === userId) {
      sessionUser.name = newName;
      setLocalStorageItem(STORAGE_KEYS.CURRENT_SESSION, sessionUser);
    }

    return {
      id: userId,
      email: sessionUser?.email || '',
      name: newName
    };
  }
};
