import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock uuid - use counter for predictable IDs
let uuidCounter = 0;
vi.mock('uuid', () => ({
  v4: () => `test-uuid-${++uuidCounter}`,
}));

// Mock supabase
vi.mock('../config/supabase', () => ({
  getSupabase: () => null, // Use local fallback for tests
  isSupabaseConfigured: () => false,
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock window.location
const mockOrigin = 'http://localhost:3000';
Object.defineProperty(window, 'location', {
  value: {
    origin: mockOrigin,
  },
  writable: true,
});

// Reset state between tests
beforeEach(async () => {
  localStorageMock.clear();
  uuidCounter = 0;
  vi.resetModules();
});

// Helper to dynamically import module with fresh state
async function getModule() {
  return await import('./graphPublishing');
}

// Helper to create unique user ID
let userIdCounter = 0;
function createUserId() {
  return `user-${++userIdCounter}`;
}

// Helper to create test graph options
function createGraphOptions(overrides: Partial<import('./graphPublishing').PublishGraphOptions> = {}) {
  return {
    title: 'Test Graph',
    description: 'A test knowledge graph',
    htmlContent: '<html><body>Graph content</body></html>',
    nodeCount: 5,
    edgeCount: 4,
    ...overrides,
  };
}

describe('graphPublishing service', () => {
  describe('publishGraph', () => {
    it('publishes a graph with valid options', async () => {
      const { publishGraph } = await getModule();
      const userId = createUserId();
      const options = createGraphOptions();

      const result = await publishGraph(userId, options);

      expect(result.success).toBe(true);
      expect(result.graph).toBeDefined();
      expect(result.graph?.title).toBe('Test Graph');
      expect(result.graph?.userId).toBe(userId);
      expect(result.url).toContain('/graphs/local/test-graph');
    });

    it('generates slug from title', async () => {
      const { publishGraph } = await getModule();
      const userId = createUserId();
      const options = createGraphOptions({
        title: 'My Awesome Knowledge Graph!',
      });

      const result = await publishGraph(userId, options);

      expect(result.success).toBe(true);
      expect(result.graph?.slug).toBe('my-awesome-knowledge-graph');
    });

    it('uses custom slug if provided', async () => {
      const { publishGraph } = await getModule();
      const userId = createUserId();
      const options = createGraphOptions({
        slug: 'custom-slug',
      });

      const result = await publishGraph(userId, options);

      expect(result.success).toBe(true);
      expect(result.graph?.slug).toBe('custom-slug');
    });

    it('rejects empty title', async () => {
      const { publishGraph } = await getModule();
      const userId = createUserId();
      const options = createGraphOptions({
        title: '',
      });

      const result = await publishGraph(userId, options);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Title is required');
    });

    it('rejects missing htmlContent', async () => {
      const { publishGraph } = await getModule();
      const userId = createUserId();
      const options = createGraphOptions({
        htmlContent: '',
      });

      const result = await publishGraph(userId, options);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Graph content is required');
    });

    it('sets default values correctly', async () => {
      const { publishGraph } = await getModule();
      const userId = createUserId();
      const options = createGraphOptions({
        description: undefined,
        isPublic: undefined,
        tags: undefined,
      });

      const result = await publishGraph(userId, options);

      expect(result.success).toBe(true);
      expect(result.graph?.description).toBe('');
      expect(result.graph?.isPublic).toBe(true);
      expect(result.graph?.tags).toEqual([]);
      expect(result.graph?.viewCount).toBe(0);
    });

    it('stores tags when provided', async () => {
      const { publishGraph } = await getModule();
      const userId = createUserId();
      const options = createGraphOptions({
        tags: ['knowledge', 'visualization'],
      });

      const result = await publishGraph(userId, options);

      expect(result.success).toBe(true);
      expect(result.graph?.tags).toEqual(['knowledge', 'visualization']);
    });
  });

  describe('rate limiting', () => {
    it('enforces rate limit of 10 publishes per day', async () => {
      const { publishGraph } = await getModule();
      const userId = createUserId();

      // Publish 10 graphs successfully
      for (let i = 0; i < 10; i++) {
        const options = createGraphOptions({ title: `Graph ${i}` });
        const result = await publishGraph(userId, options);
        expect(result.success).toBe(true);
      }

      // 11th should fail
      const options = createGraphOptions({ title: 'Graph 11' });
      const result = await publishGraph(userId, options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
      expect(result.error).toContain('10');
    });
  });

  describe('storage limits', () => {
    it('enforces storage limit of 10MB', async () => {
      const { publishGraph } = await getModule();
      const userId = createUserId();
      // Create content that's about 6MB
      const largeContent = 'x'.repeat(6 * 1024 * 1024);

      // First publish should succeed
      const options1 = createGraphOptions({
        title: 'First Large Graph',
        htmlContent: largeContent,
      });
      const result1 = await publishGraph(userId, options1);
      expect(result1.success).toBe(true);

      // Second publish should fail (would exceed 10MB)
      const options2 = createGraphOptions({
        title: 'Second Large Graph',
        htmlContent: largeContent,
      });
      const result2 = await publishGraph(userId, options2);

      expect(result2.success).toBe(false);
      expect(result2.error).toContain('Storage limit exceeded');
      expect(result2.error).toContain('10MB');
    });
  });

  describe('getUserGraphs', () => {
    it('returns empty array when no graphs published', async () => {
      const { getUserGraphs } = await getModule();
      const graphs = await getUserGraphs(createUserId());
      expect(graphs).toEqual([]);
    });

    it('returns only graphs for specified user', async () => {
      const { publishGraph, getUserGraphs } = await getModule();
      const user1 = createUserId();
      const user2 = createUserId();

      await publishGraph(user1, createGraphOptions({ title: 'User 1 Graph' }));
      await publishGraph(user2, createGraphOptions({ title: 'User 2 Graph' }));

      const user1Graphs = await getUserGraphs(user1);
      const user2Graphs = await getUserGraphs(user2);

      expect(user1Graphs).toHaveLength(1);
      expect(user1Graphs[0].title).toBe('User 1 Graph');

      expect(user2Graphs).toHaveLength(1);
      expect(user2Graphs[0].title).toBe('User 2 Graph');
    });

    it('returns graphs in reverse chronological order', async () => {
      const { publishGraph, getUserGraphs } = await getModule();
      const userId = createUserId();

      await publishGraph(userId, createGraphOptions({ title: 'First' }));
      await new Promise((resolve) => setTimeout(resolve, 10));
      await publishGraph(userId, createGraphOptions({ title: 'Second' }));
      await new Promise((resolve) => setTimeout(resolve, 10));
      await publishGraph(userId, createGraphOptions({ title: 'Third' }));

      const graphs = await getUserGraphs(userId);

      expect(graphs).toHaveLength(3);
      expect(graphs[0].title).toBe('Third');
      expect(graphs[1].title).toBe('Second');
      expect(graphs[2].title).toBe('First');
    });
  });

  describe('getGraphBySlug', () => {
    it('returns null when graph not found', async () => {
      const { getGraphBySlug } = await getModule();
      const graph = await getGraphBySlug('user-123', 'nonexistent');
      expect(graph).toBeNull();
    });

    it('retrieves graph by slug', async () => {
      const { publishGraph, getGraphBySlug } = await getModule();
      const userId = createUserId();
      const options = createGraphOptions({
        title: 'My Graph',
        slug: 'my-graph',
      });

      await publishGraph(userId, options);

      const graph = await getGraphBySlug('user', 'my-graph');

      expect(graph).toBeDefined();
      expect(graph?.title).toBe('My Graph');
      expect(graph?.slug).toBe('my-graph');
    });

    it('only returns public graphs', async () => {
      const { publishGraph, getGraphBySlug } = await getModule();
      const userId = createUserId();
      const options = createGraphOptions({
        slug: 'private-graph',
        isPublic: false,
      });

      await publishGraph(userId, options);

      const graph = await getGraphBySlug('user', 'private-graph');

      expect(graph).toBeNull();
    });

    it('increments view count when retrieved', async () => {
      const { publishGraph, getGraphBySlug } = await getModule();
      const userId = createUserId();
      const options = createGraphOptions({ slug: 'viewed-graph' });

      await publishGraph(userId, options);

      const graph1 = await getGraphBySlug('user', 'viewed-graph');
      expect(graph1?.viewCount).toBe(1);

      const graph2 = await getGraphBySlug('user', 'viewed-graph');
      expect(graph2?.viewCount).toBe(2);

      const graph3 = await getGraphBySlug('user', 'viewed-graph');
      expect(graph3?.viewCount).toBe(3);
    });
  });

  describe('getGraphById', () => {
    it('returns null when graph not found', async () => {
      const { getGraphById } = await getModule();
      const graph = await getGraphById('nonexistent-id');
      expect(graph).toBeNull();
    });

    it('retrieves graph by id', async () => {
      const { publishGraph, getGraphById } = await getModule();
      const userId = createUserId();
      const options = createGraphOptions({ title: 'Find By ID' });

      const publishResult = await publishGraph(userId, options);
      const graphId = publishResult.graph!.id;

      const graph = await getGraphById(graphId);

      expect(graph).toBeDefined();
      expect(graph?.id).toBe(graphId);
      expect(graph?.title).toBe('Find By ID');
    });

    it('returns private graphs by id', async () => {
      const { publishGraph, getGraphById } = await getModule();
      const userId = createUserId();
      const options = createGraphOptions({
        title: 'Private Graph',
        isPublic: false,
      });

      const publishResult = await publishGraph(userId, options);
      const graphId = publishResult.graph!.id;

      const graph = await getGraphById(graphId);

      expect(graph).toBeDefined();
      expect(graph?.isPublic).toBe(false);
    });
  });

  describe('updateGraph', () => {
    it('updates graph title and description', async () => {
      const { publishGraph, updateGraph, getGraphById } = await getModule();
      const userId = createUserId();
      const options = createGraphOptions({
        title: 'Original Title',
        description: 'Original description',
      });

      const publishResult = await publishGraph(userId, options);
      const graphId = publishResult.graph!.id;

      const updateResult = await updateGraph(graphId, userId, {
        title: 'Updated Title',
        description: 'Updated description',
      });

      expect(updateResult.success).toBe(true);

      const graph = await getGraphById(graphId);
      expect(graph?.title).toBe('Updated Title');
      expect(graph?.description).toBe('Updated description');
    });

    it('fails when graph not found', async () => {
      const { updateGraph } = await getModule();
      const result = await updateGraph('nonexistent-id', createUserId(), {
        title: 'New Title',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Graph not found');
    });

    it('fails when userId does not match', async () => {
      const { publishGraph, updateGraph } = await getModule();
      const userId = createUserId();
      const options = createGraphOptions();

      const publishResult = await publishGraph(userId, options);
      const graphId = publishResult.graph!.id;

      const updateResult = await updateGraph(graphId, createUserId(), {
        title: 'Hacked Title',
      });

      expect(updateResult.success).toBe(false);
      expect(updateResult.error).toBe('Graph not found');
    });
  });

  describe('unpublishGraph', () => {
    it('deletes a graph', async () => {
      const { publishGraph, unpublishGraph, getGraphById } = await getModule();
      const userId = createUserId();
      const options = createGraphOptions();

      const publishResult = await publishGraph(userId, options);
      const graphId = publishResult.graph!.id;

      const unpublishResult = await unpublishGraph(graphId, userId);

      expect(unpublishResult.success).toBe(true);

      const graph = await getGraphById(graphId);
      expect(graph).toBeNull();
    });

    it('fails when graph not found', async () => {
      const { unpublishGraph } = await getModule();
      const result = await unpublishGraph('nonexistent-id', createUserId());

      expect(result.success).toBe(false);
      expect(result.error).toBe('Graph not found');
    });

    it('fails when userId does not match', async () => {
      const { publishGraph, unpublishGraph, getGraphById } = await getModule();
      const userId = createUserId();
      const options = createGraphOptions();

      const publishResult = await publishGraph(userId, options);
      const graphId = publishResult.graph!.id;

      const unpublishResult = await unpublishGraph(graphId, createUserId());

      expect(unpublishResult.success).toBe(false);

      // Graph should still exist
      const graph = await getGraphById(graphId);
      expect(graph).toBeDefined();
    });
  });

  describe('getGraphAnalytics', () => {
    it('returns null when graph not found', async () => {
      const { getGraphAnalytics } = await getModule();
      const analytics = await getGraphAnalytics('nonexistent-id');
      expect(analytics).toBeNull();
    });

    it('returns basic analytics for local graph', async () => {
      const { publishGraph, getGraphBySlug, getGraphAnalytics } = await getModule();
      const userId = createUserId();
      const options = createGraphOptions();

      const publishResult = await publishGraph(userId, options);
      const graphId = publishResult.graph!.id;

      // Increment view count
      await getGraphBySlug('user', publishResult.graph!.slug);
      await getGraphBySlug('user', publishResult.graph!.slug);
      await getGraphBySlug('user', publishResult.graph!.slug);

      const analytics = await getGraphAnalytics(graphId);

      expect(analytics).toBeDefined();
      expect(analytics?.graphId).toBe(graphId);
      expect(analytics?.totalViews).toBe(3);
      expect(analytics?.uniqueVisitors).toBeGreaterThan(0);
    });
  });

  describe('utility functions', () => {
    it('isGraphPublishingAvailable returns true', async () => {
      const { isGraphPublishingAvailable } = await getModule();
      expect(isGraphPublishingAvailable()).toBe(true);
    });

    it('getGraphUrl generates correct URL', async () => {
      const { publishGraph, getGraphUrl } = await getModule();
      const userId = createUserId();
      const options = createGraphOptions({ slug: 'my-graph' });

      const publishResult = await publishGraph(userId, options);
      const graph = publishResult.graph!;

      const url = getGraphUrl(graph);

      expect(url).toContain('/graphs/');
      expect(url).toContain('/my-graph');
    });
  });

  describe('slug generation', () => {
    it('converts title to lowercase', async () => {
      const { publishGraph } = await getModule();
      const userId = createUserId();
      const options = createGraphOptions({ title: 'UPPERCASE TITLE' });

      const result = await publishGraph(userId, options);

      expect(result.graph?.slug).toBe('uppercase-title');
    });

    it('replaces spaces with hyphens', async () => {
      const { publishGraph } = await getModule();
      const userId = createUserId();
      const options = createGraphOptions({ title: 'Multiple Word Title' });

      const result = await publishGraph(userId, options);

      expect(result.graph?.slug).toBe('multiple-word-title');
    });

    it('removes special characters', async () => {
      const { publishGraph } = await getModule();
      const userId = createUserId();
      const options = createGraphOptions({ title: 'Title with !@#$% special chars' });

      const result = await publishGraph(userId, options);

      expect(result.graph?.slug).toBe('title-with-special-chars');
    });

    it('limits slug to 50 characters', async () => {
      const { publishGraph } = await getModule();
      const userId = createUserId();
      const longTitle = 'A'.repeat(100);
      const options = createGraphOptions({ title: longTitle });

      const result = await publishGraph(userId, options);

      expect(result.graph?.slug.length).toBeLessThanOrEqual(50);
    });

    it('returns "untitled" for empty title after cleanup', async () => {
      const { publishGraph } = await getModule();
      const userId = createUserId();
      const options = createGraphOptions({ title: '!@#$%^&*()' });

      const result = await publishGraph(userId, options);

      expect(result.graph?.slug).toBe('untitled');
    });
  });
});
