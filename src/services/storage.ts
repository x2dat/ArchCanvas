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

    // 🧠 Fix: Use maybeSingle() to handle instant email authentication delays gracefully
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('name')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError) {
      console.warn('Non-fatal profile sync delay:', profileError.message);
    }

    // Dynamic Fallback: If trigger hasn't finished writing the profile row, pull their email prefix
    const fallbackName = data.user.email ? data.user.email.split('@')[0] : 'Developer';

    return {
      id: data.user.id,
      email: normalizedEmail,
      name: (profile && profile.name) ? profile.name : fallbackName
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
      // 🧠 Fix: Swapped out .single() here as well to prevent app locks on persistent session reloads
      const { data: profile, error: profileError } = await client
        .from('profiles')
        .select('name')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profileError) {
        console.warn('Non-fatal session profile fetch warning:', profileError.message);
      }

      const fallbackName = session.user.email ? session.user.email.split('@')[0] : 'Developer';

      return {
        id: session.user.id,
        email: session.user.email || '',
        name: profile?.name || fallbackName
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
  // ... maps fields and immediately inserts into 'projects'

  getProjectData: async (projectId: string): Promise<ProjectMapData | null> => {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('project_data')
      .select('nodes, connections, canvas_state')
      .eq('project_id', projectId)
      .maybeSingle();

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

    // Compile dynamic layer metrics matrices for dashboard previews
    const layerStats = { ui: 0, logic: 0, api: 0, db: 0, config: 0, none: 0 };
    nodes.forEach(n => {
      if (n.layer && n.layer in layerStats) {
        layerStats[n.layer as keyof typeof layerStats]++;
      } else {
        layerStats.none++;
      }
    });

    const updatedAtStr = new Date().toISOString();

    // Fire bulk synchronization queries concurrently across Postgres engines
    const updateMeta = client
      .from('projects')
      .update({
        updated_at: updatedAtStr,
        node_count: nodes.length,
        conn_count: cleanConns.length,
        layer_stats: layerStats
      })
      .eq('id', projectId);

    const updateData = client
      .from('project_data')
      .upsert({
        project_id: projectId,
        nodes,
        connections: cleanConns,
        canvas_state: canvasState,
        updated_at: updatedAtStr
      });

    const [metaRes, dataRes] = await Promise.all([updateMeta, updateData]);

    if (metaRes.error) throw new Error(`Project metadata save failed: ${metaRes.error.message}`);
    if (dataRes.error) throw new Error(`Project coordinate data sync failed: ${dataRes.error.message}`);
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
      .maybeSingle(); // 🧠 Swapped to maybeSingle for consistency and protection against layout shifts

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
