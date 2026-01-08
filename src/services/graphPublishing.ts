/**
 * Graph Publishing Service
 *
 * Handles publishing knowledge graphs to a hosted endpoint.
 * Uses Supabase for storage and serving published graphs.
 */

import { v4 as uuidv4 } from 'uuid';
import { getSupabase, isSupabaseConfigured } from '../config/supabase';

// Types
export interface PublishedGraph {
  id: string;
  userId: string;
  slug: string;
  title: string;
  description: string;
  htmlContent: string;
  thumbnailDataUrl?: string;
  isPublic: boolean;
  customDomain?: string;
  viewCount: number;
  nodeCount: number;
  edgeCount: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date;
}

export interface PublishGraphOptions {
  title: string;
  description: string;
  htmlContent: string;
  thumbnailDataUrl?: string;
  isPublic?: boolean;
  slug?: string;
  tags?: string[];
  nodeCount: number;
  edgeCount: number;
}

export interface GraphAnalytics {
  graphId: string;
  totalViews: number;
  uniqueVisitors: number;
  viewsByDay: Array<{ date: string; views: number }>;
  topReferrers: Array<{ referrer: string; count: number }>;
  mostClickedNodes: Array<{ nodeId: string; nodeTitle: string; clicks: number }>;
}

// Storage keys for local fallback
const LOCAL_STORAGE_KEY = 'patchpad_published_graphs';
const PUBLISH_LIMIT_PER_DAY = 10;
const STORAGE_LIMIT_BYTES = 10 * 1024 * 1024; // 10MB

// In-memory cache
let graphsCache: PublishedGraph[] | null = null;

/**
 * Generate a URL-friendly slug from title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50)
    .replace(/^-|-$/g, '') || 'untitled';
}

/**
 * Check if user is within publish rate limit
 */
async function checkRateLimit(userId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) {
    // Local fallback - check localStorage
    const graphs = getLocalGraphs();
    const today = new Date().toDateString();
    const publishedToday = graphs.filter(
      (g) => g.userId === userId && new Date(g.publishedAt).toDateString() === today
    );
    return publishedToday.length < PUBLISH_LIMIT_PER_DAY;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('published_graphs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('published_at', today.toISOString());

  if (error) {
    console.error('Rate limit check failed:', error);
    return true; // Allow on error
  }

  return (count || 0) < PUBLISH_LIMIT_PER_DAY;
}

/**
 * Check storage usage for user
 */
async function checkStorageLimit(userId: string, newContentSize: number): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) {
    // Local fallback
    const graphs = getLocalGraphs().filter((g) => g.userId === userId);
    const totalSize = graphs.reduce((sum, g) => sum + g.htmlContent.length, 0);
    return totalSize + newContentSize <= STORAGE_LIMIT_BYTES;
  }

  const { data, error } = await supabase
    .from('published_graphs')
    .select('html_content')
    .eq('user_id', userId);

  if (error) {
    console.error('Storage check failed:', error);
    return true; // Allow on error
  }

  const totalSize = (data || []).reduce((sum, g) => sum + (g.html_content?.length || 0), 0);
  return totalSize + newContentSize <= STORAGE_LIMIT_BYTES;
}

/**
 * Get graphs from localStorage
 */
function getLocalGraphs(): PublishedGraph[] {
  if (graphsCache) return graphsCache;

  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      graphsCache = parsed.map((g: Record<string, unknown>) => ({
        ...g,
        createdAt: new Date(g.createdAt as string),
        updatedAt: new Date(g.updatedAt as string),
        publishedAt: new Date(g.publishedAt as string),
      }));
      return graphsCache!;
    }
  } catch (error) {
    console.error('Failed to load local graphs:', error);
  }

  graphsCache = [];
  return graphsCache;
}

/**
 * Save graphs to localStorage
 */
function saveLocalGraphs(graphs: PublishedGraph[]): void {
  graphsCache = graphs;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(graphs));
  } catch (error) {
    console.error('Failed to save local graphs:', error);
  }
}

/**
 * Publish a knowledge graph
 */
export async function publishGraph(
  userId: string,
  options: PublishGraphOptions
): Promise<{ success: boolean; graph?: PublishedGraph; error?: string; url?: string }> {
  // Validate inputs
  if (!options.title.trim()) {
    return { success: false, error: 'Title is required' };
  }

  if (!options.htmlContent) {
    return { success: false, error: 'Graph content is required' };
  }

  // Check rate limit
  const withinLimit = await checkRateLimit(userId);
  if (!withinLimit) {
    return { success: false, error: `Rate limit exceeded. Maximum ${PUBLISH_LIMIT_PER_DAY} publishes per day.` };
  }

  // Check storage limit
  const withinStorage = await checkStorageLimit(userId, options.htmlContent.length);
  if (!withinStorage) {
    return { success: false, error: 'Storage limit exceeded (10MB). Delete some published graphs first.' };
  }

  const now = new Date();
  const graphId = uuidv4();
  const slug = options.slug || generateSlug(options.title);

  const graph: PublishedGraph = {
    id: graphId,
    userId,
    slug,
    title: options.title,
    description: options.description || '',
    htmlContent: options.htmlContent,
    thumbnailDataUrl: options.thumbnailDataUrl,
    isPublic: options.isPublic ?? true,
    viewCount: 0,
    nodeCount: options.nodeCount,
    edgeCount: options.edgeCount,
    tags: options.tags || [],
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
  };

  const supabase = getSupabase();
  if (supabase) {
    // Save to Supabase
    const { error } = await supabase.from('published_graphs').insert({
      id: graphId,
      user_id: userId,
      slug,
      title: options.title,
      description: options.description || '',
      html_content: options.htmlContent,
      thumbnail_data_url: options.thumbnailDataUrl,
      is_public: options.isPublic ?? true,
      view_count: 0,
      node_count: options.nodeCount,
      edge_count: options.edgeCount,
      tags: options.tags || [],
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      published_at: now.toISOString(),
    });

    if (error) {
      console.error('Failed to publish graph:', error);
      return { success: false, error: 'Failed to publish graph. Please try again.' };
    }

    const url = `${window.location.origin}/graphs/${userId.slice(0, 8)}/${slug}`;
    return { success: true, graph, url };
  }

  // Local fallback
  const graphs = getLocalGraphs();
  graphs.unshift(graph);
  saveLocalGraphs(graphs);

  const url = `${window.location.origin}/graphs/local/${slug}`;
  return { success: true, graph, url };
}

/**
 * Get published graphs for a user
 */
export async function getUserGraphs(userId: string): Promise<PublishedGraph[]> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from('published_graphs')
      .select('*')
      .eq('user_id', userId)
      .order('published_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch user graphs:', error);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      userId: row.user_id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      htmlContent: row.html_content,
      thumbnailDataUrl: row.thumbnail_data_url,
      isPublic: row.is_public,
      customDomain: row.custom_domain,
      viewCount: row.view_count,
      nodeCount: row.node_count,
      edgeCount: row.edge_count,
      tags: row.tags,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      publishedAt: new Date(row.published_at),
    }));
  }

  // Local fallback
  return getLocalGraphs().filter((g) => g.userId === userId);
}

/**
 * Get a published graph by slug
 */
export async function getGraphBySlug(
  userIdPrefix: string,
  slug: string
): Promise<PublishedGraph | null> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from('published_graphs')
      .select('*')
      .ilike('user_id', `${userIdPrefix}%`)
      .eq('slug', slug)
      .eq('is_public', true)
      .single();

    if (error || !data) {
      return null;
    }

    // Increment view count
    await supabase
      .from('published_graphs')
      .update({ view_count: data.view_count + 1 })
      .eq('id', data.id);

    return {
      id: data.id,
      userId: data.user_id,
      slug: data.slug,
      title: data.title,
      description: data.description,
      htmlContent: data.html_content,
      thumbnailDataUrl: data.thumbnail_data_url,
      isPublic: data.is_public,
      customDomain: data.custom_domain,
      viewCount: data.view_count + 1,
      nodeCount: data.node_count,
      edgeCount: data.edge_count,
      tags: data.tags,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      publishedAt: new Date(data.published_at),
    };
  }

  // Local fallback
  const graphs = getLocalGraphs();
  const graph = graphs.find((g) => g.slug === slug && g.isPublic);
  if (graph) {
    graph.viewCount++;
    saveLocalGraphs(graphs);
  }
  return graph || null;
}

/**
 * Get a published graph by ID
 */
export async function getGraphById(graphId: string): Promise<PublishedGraph | null> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from('published_graphs')
      .select('*')
      .eq('id', graphId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      slug: data.slug,
      title: data.title,
      description: data.description,
      htmlContent: data.html_content,
      thumbnailDataUrl: data.thumbnail_data_url,
      isPublic: data.is_public,
      customDomain: data.custom_domain,
      viewCount: data.view_count,
      nodeCount: data.node_count,
      edgeCount: data.edge_count,
      tags: data.tags,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      publishedAt: new Date(data.published_at),
    };
  }

  // Local fallback
  return getLocalGraphs().find((g) => g.id === graphId) || null;
}

/**
 * Update a published graph
 */
export async function updateGraph(
  graphId: string,
  userId: string,
  updates: Partial<Pick<PublishedGraph, 'title' | 'description' | 'htmlContent' | 'isPublic' | 'tags'>>
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();
  const now = new Date();

  if (supabase) {
    const { error } = await supabase
      .from('published_graphs')
      .update({
        title: updates.title,
        description: updates.description,
        html_content: updates.htmlContent,
        is_public: updates.isPublic,
        tags: updates.tags,
        updated_at: now.toISOString(),
      })
      .eq('id', graphId)
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to update graph:', error);
      return { success: false, error: 'Failed to update graph' };
    }

    return { success: true };
  }

  // Local fallback
  const graphs = getLocalGraphs();
  const index = graphs.findIndex((g) => g.id === graphId && g.userId === userId);
  if (index === -1) {
    return { success: false, error: 'Graph not found' };
  }

  graphs[index] = {
    ...graphs[index],
    ...updates,
    updatedAt: now,
  };
  saveLocalGraphs(graphs);
  return { success: true };
}

/**
 * Unpublish (delete) a graph
 */
export async function unpublishGraph(
  graphId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabase();

  if (supabase) {
    const { error } = await supabase
      .from('published_graphs')
      .delete()
      .eq('id', graphId)
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to unpublish graph:', error);
      return { success: false, error: 'Failed to unpublish graph' };
    }

    return { success: true };
  }

  // Local fallback
  const graphs = getLocalGraphs();
  const index = graphs.findIndex((g) => g.id === graphId && g.userId === userId);
  if (index === -1) {
    return { success: false, error: 'Graph not found' };
  }

  graphs.splice(index, 1);
  saveLocalGraphs(graphs);
  return { success: true };
}

/**
 * Get analytics for a published graph
 */
export async function getGraphAnalytics(graphId: string): Promise<GraphAnalytics | null> {
  const supabase = getSupabase();

  if (supabase) {
    // Get graph with view count
    const { data: graph } = await supabase
      .from('published_graphs')
      .select('view_count')
      .eq('id', graphId)
      .single();

    // Get view analytics from analytics table if exists
    const { data: analytics } = await supabase
      .from('graph_analytics')
      .select('*')
      .eq('graph_id', graphId)
      .order('viewed_at', { ascending: false })
      .limit(100);

    // Aggregate analytics
    const viewsByDay: Record<string, number> = {};
    const referrers: Record<string, number> = {};
    const nodeClicks: Record<string, { title: string; count: number }> = {};
    const uniqueVisitors = new Set<string>();

    (analytics || []).forEach((row) => {
      const date = new Date(row.viewed_at).toISOString().split('T')[0];
      viewsByDay[date] = (viewsByDay[date] || 0) + 1;

      if (row.referrer) {
        referrers[row.referrer] = (referrers[row.referrer] || 0) + 1;
      }

      if (row.visitor_id) {
        uniqueVisitors.add(row.visitor_id);
      }

      if (row.clicked_node_id) {
        if (!nodeClicks[row.clicked_node_id]) {
          nodeClicks[row.clicked_node_id] = { title: row.clicked_node_title || '', count: 0 };
        }
        nodeClicks[row.clicked_node_id].count++;
      }
    });

    return {
      graphId,
      totalViews: graph?.view_count || 0,
      uniqueVisitors: uniqueVisitors.size,
      viewsByDay: Object.entries(viewsByDay)
        .map(([date, views]) => ({ date, views }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      topReferrers: Object.entries(referrers)
        .map(([referrer, count]) => ({ referrer, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      mostClickedNodes: Object.entries(nodeClicks)
        .map(([nodeId, { title, count }]) => ({ nodeId, nodeTitle: title, clicks: count }))
        .sort((a, b) => b.clicks - a.clicks)
        .slice(0, 10),
    };
  }

  // Local fallback - limited analytics
  const graph = getLocalGraphs().find((g) => g.id === graphId);
  return graph
    ? {
        graphId,
        totalViews: graph.viewCount,
        uniqueVisitors: Math.ceil(graph.viewCount * 0.7), // Estimate
        viewsByDay: [],
        topReferrers: [],
        mostClickedNodes: [],
      }
    : null;
}

/**
 * Check if graph publishing is available
 */
export function isGraphPublishingAvailable(): boolean {
  return true; // Available with local fallback even without Supabase
}

/**
 * Get the public URL for a graph
 */
export function getGraphUrl(graph: PublishedGraph): string {
  if (graph.customDomain) {
    return `https://${graph.customDomain}`;
  }
  return `${window.location.origin}/graphs/${graph.userId.slice(0, 8)}/${graph.slug}`;
}

/**
 * SQL to create the published_graphs table in Supabase
 */
export const GRAPH_PUBLISHING_SQL = `
-- Published graphs table
CREATE TABLE IF NOT EXISTS published_graphs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  html_content TEXT NOT NULL,
  thumbnail_data_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  custom_domain TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  node_count INTEGER NOT NULL DEFAULT 0,
  edge_count INTEGER NOT NULL DEFAULT 0,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_user_slug UNIQUE (user_id, slug)
);

-- Graph analytics table
CREATE TABLE IF NOT EXISTS graph_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  graph_id UUID REFERENCES published_graphs(id) ON DELETE CASCADE NOT NULL,
  visitor_id TEXT,
  referrer TEXT,
  clicked_node_id TEXT,
  clicked_node_title TEXT,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS published_graphs_user_id_idx ON published_graphs(user_id);
CREATE INDEX IF NOT EXISTS published_graphs_slug_idx ON published_graphs(slug);
CREATE INDEX IF NOT EXISTS published_graphs_is_public_idx ON published_graphs(is_public);
CREATE INDEX IF NOT EXISTS graph_analytics_graph_id_idx ON graph_analytics(graph_id);
CREATE INDEX IF NOT EXISTS graph_analytics_viewed_at_idx ON graph_analytics(viewed_at);

-- Row Level Security
ALTER TABLE published_graphs ENABLE ROW LEVEL SECURITY;
ALTER TABLE graph_analytics ENABLE ROW LEVEL SECURITY;

-- Users can manage their own graphs
CREATE POLICY "Users can view own graphs" ON published_graphs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own graphs" ON published_graphs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own graphs" ON published_graphs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own graphs" ON published_graphs
  FOR DELETE USING (auth.uid() = user_id);

-- Anyone can view public graphs
CREATE POLICY "Anyone can view public graphs" ON published_graphs
  FOR SELECT USING (is_public = true);

-- Analytics can be inserted by anyone (for public graphs)
CREATE POLICY "Anyone can insert analytics" ON graph_analytics
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM published_graphs
      WHERE id = graph_id AND is_public = true
    )
  );

-- Users can view analytics for their own graphs
CREATE POLICY "Users can view own analytics" ON graph_analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM published_graphs
      WHERE id = graph_id AND user_id = auth.uid()
    )
  );
`;
