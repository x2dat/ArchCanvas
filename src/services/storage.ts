import { supabase } from './supabase';
import type { CodeNode, NodeConnection, CanvasState } from '../types';

export interface User {
  id: string;
  email: string;
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

const getSupabaseClient = () => {
  if (!supabase) {
    throw new Error('Supabase client is not configured. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your environment variables.');
  }
  return supabase;
};

export const storageService = {
  // --- USER AUTHENTICATION ACTIONS ---
  
  registerUser: async (email: string, password: string, name: string): Promise<User> => {
    const client = getSupabaseClient();
    const normalizedEmail = email.toLowerCase().trim();

    const { data, error } = await client.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { name: name.trim() }
      }
    });

    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Failed to register user.');

    // Insert record into the public profiles table
    const { error: profileError } = await client
      .from('profiles')
      .upsert({
        id: data.user.id,
        email: normalizedEmail,
        name: name.trim() || 'Developer',
        updated_at: new Date().toISOString()
      });

    if (profileError) {
      throw new Error(`Profile creation failed: ${profileError.message}`);
    }

    return {
      id: data.user.id,
      email: normalizedEmail,
      name: name.trim() || 'Developer'
    };
  },

  loginUser: async (email: string, password: string): Promise<User> => {
    const client = getSupabaseClient();
    const normalizedEmail = email.toLowerCase().trim();

    const { data, error } = await client.auth.signInWithPassword({
      email: normalizedEmail,
      password
    });

    if (error) throw new Error(error.message);
    if (!data.user) throw new Error('Authentication failed.');

    // Fetch user profile from public table
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('name')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      console.warn('Failed to fetch profile from database', profileError);
    }

    return {
      id: data.user.id,
      email: normalizedEmail,
      name: (!profileError && profile?.name) ? profile.name : 'Developer'
    };
  },

  logoutUser: async (): Promise<void> => {
    const client = getSupabaseClient();
    const { error } = await client.auth.signOut();
    if (error) throw new Error(error.message);
  },

  getCurrentUser: async (): Promise<User | null> => {
    const client = getSupabaseClient();
    const { data: { session } } = await client.auth.getSession();
    if (session?.user) {
      // Fetch name from profile
      const { data: profile } = await client
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
  },

  // --- PROJECTS DATABASE ACTIONS ---

  getProjects: async (userId: string): Promise<Project[]> => {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw new Error(error.message);

    return (data || []).map(p => ({
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
  },

  createProject: async (userId: string, name: string, description: string): Promise<Project> => {
    const client = getSupabaseClient();
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

    const { error: projError } = await client
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

    if (projError) throw new Error(`Project creation failed: ${projError.message}`);

    const { error: dataError } = await client
      .from('project_data')
      .insert({
        project_id: newProject.id,
        nodes: emptyData.nodes,
        connections: emptyData.connections,
        canvas_state: emptyData.canvasState,
        updated_at: new Date().toISOString()
      });

    if (dataError) throw new Error(`Project layout initialization failed: ${dataError.message}`);

    return newProject;
  },

  getProjectData: async (projectId: string): Promise<ProjectMapData | null> => {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('project_data')
      .select('nodes, connections, canvas_state')
      .eq('project_id', projectId)
      .single();

    if (error) throw new Error(error.message);
    if (!data) return null;

    return {
      nodes: data.nodes as CodeNode[],
      connections: data.connections as NodeConnection[],
      canvasState: data.canvas_state as CanvasState
    };
  },

  saveProjectData: async (projectId: string, nodes: CodeNode[], connections: NodeConnection[], canvasState: CanvasState): Promise<void> => {
    const client = getSupabaseClient();
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

    const { error: projError } = await client
      .from('projects')
      .update({
        updated_at: updatedAtStr,
        node_count: nodes.length,
        conn_count: cleanConns.length,
        layer_stats: layerStats
      })
      .eq('id', projectId);

    if (projError) throw new Error(`Project metadata save failed: ${projError.message}`);

    const { error: dataError } = await client
      .from('project_data')
      .upsert({
        project_id: projectId,
        nodes,
        connections: cleanConns,
        canvas_state: canvasState,
        updated_at: updatedAtStr
      });

    if (dataError) throw new Error(`Project coordinate data sync failed: ${dataError.message}`);
  },

  deleteProject: async (projectId: string): Promise<void> => {
    const client = getSupabaseClient();
    const { error } = await client
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (error) throw new Error(error.message);
  },

  renameProject: async (projectId: string, name: string, description: string): Promise<Project | null> => {
    const client = getSupabaseClient();
    const updatedAtStr = new Date().toISOString();

    const { data, error } = await client
      .from('projects')
      .update({
        name: name.trim(),
        description: description.trim(),
        updated_at: updatedAtStr
      })
      .eq('id', projectId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    if (!data) return null;

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
  },

  updateProfile: async (userId: string, updates: { name: string }): Promise<User> => {
    const client = getSupabaseClient();
    const newName = updates.name.trim() || 'Developer';

    const { data: authUser, error: authError } = await client.auth.updateUser({
      data: { name: newName }
    });

    if (authError) throw new Error(authError.message);
    if (!authUser.user) throw new Error('User not authenticated.');

    const { error: profileError } = await client
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
};
