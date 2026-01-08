/**
 * Knowledge Graph Export Service
 *
 * Generates self-contained HTML files with interactive D3.js force-directed graphs.
 * The exported HTML works offline without any external dependencies.
 */

import type { Note } from '../types/note';

// Graph data types
export interface GraphNode {
  id: string;
  title: string;
  tags: string[];
  excerpt: string;
  fullContent?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Export options
export interface GraphExportOptions {
  theme: 'light' | 'dark';
  includeContent: 'full' | 'excerpts' | 'titles-only';
  nodeLimit: number;
  selectedTags: string[];
}

// Default options
export const DEFAULT_EXPORT_OPTIONS: GraphExportOptions = {
  theme: 'light',
  includeContent: 'excerpts',
  nodeLimit: 100,
  selectedTags: [],
};

/**
 * Parse wiki links from note content
 */
function parseWikiLinks(content: string): string[] {
  const regex = /\[\[([^\]]+)\]\]/g;
  const links: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    links.push(match[1]);
  }
  return links;
}

/**
 * Generate excerpt from note content
 */
function generateExcerpt(content: string, maxLength: number = 200): string {
  // Remove markdown headers
  let text = content.replace(/^#+\s+/gm, '');
  // Remove wiki links syntax but keep the text
  text = text.replace(/\[\[([^\]]+)\]\]/g, '$1');
  // Remove code blocks
  text = text.replace(/```[\s\S]*?```/g, '');
  // Remove inline code
  text = text.replace(/`[^`]+`/g, '');
  // Remove images
  text = text.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
  // Remove links but keep text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();

  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

/**
 * Generate graph data from notes
 */
export function generateGraphData(notes: Note[], options: GraphExportOptions = DEFAULT_EXPORT_OPTIONS): GraphData {
  // Filter notes by tags if specified
  let filteredNotes = notes;
  if (options.selectedTags.length > 0) {
    filteredNotes = notes.filter(note =>
      note.tags.some(tag => options.selectedTags.includes(tag))
    );
  }

  // Apply node limit
  if (filteredNotes.length > options.nodeLimit) {
    // Sort by updated date and take most recent
    filteredNotes = [...filteredNotes]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, options.nodeLimit);
  }

  // Create title to ID map for link resolution
  const titleToId = new Map<string, string>();
  for (const note of filteredNotes) {
    titleToId.set(note.title.toLowerCase(), note.id);
  }

  // Build nodes
  const nodes: GraphNode[] = filteredNotes.map(note => ({
    id: note.id,
    title: note.title,
    tags: note.tags,
    excerpt: options.includeContent === 'titles-only'
      ? ''
      : generateExcerpt(note.content, options.includeContent === 'full' ? 500 : 200),
    fullContent: options.includeContent === 'full' ? note.content : undefined,
  }));

  // Build edges from wiki links
  const edges: GraphEdge[] = [];
  const edgeSet = new Set<string>(); // To avoid duplicates

  for (const note of filteredNotes) {
    const links = parseWikiLinks(note.content);
    for (const link of links) {
      const targetId = titleToId.get(link.toLowerCase());
      if (targetId && targetId !== note.id) {
        const edgeKey = [note.id, targetId].sort().join('-');
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey);
          edges.push({ source: note.id, target: targetId });
        }
      }
    }
  }

  return { nodes, edges };
}

/**
 * Generate self-contained HTML with D3.js visualization
 */
export function generateGraphHTML(notes: Note[], options: GraphExportOptions = DEFAULT_EXPORT_OPTIONS): string {
  const graphData = generateGraphData(notes, options);
  const isDark = options.theme === 'dark';

  // Color palette for nodes (based on first tag or default)
  const tagColors: Record<string, string> = {
    project: '#10B981',
    meeting: '#3B82F6',
    idea: '#8B5CF6',
    research: '#F59E0B',
    personal: '#EC4899',
    work: '#06B6D4',
    default: '#6B7280',
  };

  // Theme colors
  const bgColor = isDark ? '#1F2937' : '#FFFFFF';
  const textColor = isDark ? '#F9FAFB' : '#111827';
  const subtextColor = isDark ? '#9CA3AF' : '#6B7280';
  const linkColor = isDark ? '#4B5563' : '#D1D5DB';
  const panelBg = isDark ? '#374151' : '#F9FAFB';
  const borderColor = isDark ? '#4B5563' : '#E5E7EB';

  // Escape JSON for embedding
  const graphDataJSON = JSON.stringify(graphData).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  const tagColorsJSON = JSON.stringify(tagColors);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Knowledge Graph - PatchPad</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: ${bgColor};
      color: ${textColor};
      overflow: hidden;
    }
    #graph { width: 100vw; height: 100vh; }
    .node { cursor: pointer; }
    .node circle { transition: r 0.2s ease; }
    .node:hover circle { stroke: ${textColor}; stroke-width: 2px; }
    .node text {
      font-size: 11px;
      fill: ${textColor};
      pointer-events: none;
    }
    .link { stroke: ${linkColor}; stroke-opacity: 0.6; }

    /* Info panel */
    #info-panel {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 320px;
      max-height: calc(100vh - 40px);
      background: ${panelBg};
      border: 1px solid ${borderColor};
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
      display: none;
      overflow: hidden;
    }
    #info-panel.visible { display: block; }
    .panel-header {
      padding: 16px;
      border-bottom: 1px solid ${borderColor};
    }
    .panel-header h2 {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 4px;
    }
    .panel-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 8px;
    }
    .panel-tag {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 12px;
      background: ${isDark ? '#4B5563' : '#E5E7EB'};
      color: ${subtextColor};
    }
    .panel-content {
      padding: 16px;
      max-height: 300px;
      overflow-y: auto;
      font-size: 14px;
      line-height: 1.6;
      color: ${subtextColor};
    }
    .panel-close {
      position: absolute;
      top: 12px;
      right: 12px;
      width: 24px;
      height: 24px;
      border: none;
      background: transparent;
      cursor: pointer;
      color: ${subtextColor};
      font-size: 18px;
    }
    .panel-close:hover { color: ${textColor}; }

    /* Stats */
    #stats {
      position: fixed;
      bottom: 20px;
      left: 20px;
      font-size: 12px;
      color: ${subtextColor};
      background: ${panelBg};
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid ${borderColor};
    }

    /* Controls */
    #controls {
      position: fixed;
      top: 20px;
      left: 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .control-btn {
      width: 36px;
      height: 36px;
      border: 1px solid ${borderColor};
      background: ${panelBg};
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: ${subtextColor};
      font-size: 18px;
    }
    .control-btn:hover { background: ${isDark ? '#4B5563' : '#E5E7EB'}; }

    /* Legend */
    #legend {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: ${panelBg};
      border: 1px solid ${borderColor};
      border-radius: 8px;
      padding: 12px;
      font-size: 11px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .legend-item:last-child { margin-bottom: 0; }
    .legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    /* Attribution */
    #attribution {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 11px;
      color: ${subtextColor};
      opacity: 0.7;
    }
    #attribution a { color: ${subtextColor}; }
  </style>
</head>
<body>
  <svg id="graph"></svg>

  <div id="info-panel">
    <button class="panel-close" onclick="hidePanel()">×</button>
    <div class="panel-header">
      <h2 id="panel-title"></h2>
      <div class="panel-tags" id="panel-tags"></div>
    </div>
    <div class="panel-content" id="panel-content"></div>
  </div>

  <div id="controls">
    <button class="control-btn" onclick="zoomIn()" title="Zoom in">+</button>
    <button class="control-btn" onclick="zoomOut()" title="Zoom out">−</button>
    <button class="control-btn" onclick="resetView()" title="Reset view">⟲</button>
  </div>

  <div id="stats"></div>

  <div id="legend"></div>

  <div id="attribution">
    Generated by <a href="https://github.com/patchpad/patchpad" target="_blank">PatchPad</a>
  </div>

  <script>
    // Graph data
    const data = ${graphDataJSON};
    const tagColors = ${tagColorsJSON};

    // SVG setup
    const svg = document.getElementById('graph');
    const width = window.innerWidth;
    const height = window.innerHeight;
    svg.setAttribute('viewBox', \`0 0 \${width} \${height}\`);

    // Create groups
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.appendChild(g);

    // Zoom state
    let scale = 1;
    let translateX = 0;
    let translateY = 0;

    function updateTransform() {
      g.setAttribute('transform', \`translate(\${translateX},\${translateY}) scale(\${scale})\`);
    }

    function zoomIn() {
      scale = Math.min(4, scale * 1.3);
      updateTransform();
    }

    function zoomOut() {
      scale = Math.max(0.1, scale / 1.3);
      updateTransform();
    }

    function resetView() {
      scale = 1;
      translateX = 0;
      translateY = 0;
      updateTransform();
    }

    // Pan support
    let isPanning = false;
    let startX, startY;

    svg.addEventListener('mousedown', (e) => {
      if (e.target === svg || e.target === g) {
        isPanning = true;
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
      }
    });

    svg.addEventListener('mousemove', (e) => {
      if (isPanning) {
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        updateTransform();
      }
    });

    svg.addEventListener('mouseup', () => { isPanning = false; });
    svg.addEventListener('mouseleave', () => { isPanning = false; });

    // Zoom with wheel
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      scale = Math.max(0.1, Math.min(4, scale * delta));
      updateTransform();
    });

    // Get node color based on first tag
    function getNodeColor(node) {
      if (node.tags && node.tags.length > 0) {
        const tag = node.tags[0].toLowerCase();
        return tagColors[tag] || tagColors.default;
      }
      return tagColors.default;
    }

    // Initialize node positions
    const nodes = data.nodes.map((n, i) => {
      const angle = (i / data.nodes.length) * 2 * Math.PI;
      const radius = Math.min(width, height) * 0.3;
      return {
        ...n,
        x: width / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 100,
        y: height / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 100,
        vx: 0,
        vy: 0
      };
    });

    // Create node map for edge lookup
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Create edges with node references
    const edges = data.edges.map(e => ({
      source: nodeMap.get(e.source),
      target: nodeMap.get(e.target)
    })).filter(e => e.source && e.target);

    // Draw links
    const linkGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.appendChild(linkGroup);

    const links = edges.map(edge => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.classList.add('link');
      line.setAttribute('stroke-width', '1.5');
      linkGroup.appendChild(line);
      return { element: line, edge };
    });

    // Draw nodes
    const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.appendChild(nodeGroup);

    const nodeElements = nodes.map(node => {
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.classList.add('node');

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('r', '8');
      circle.setAttribute('fill', getNodeColor(node));
      group.appendChild(circle);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('dy', '20');
      text.setAttribute('text-anchor', 'middle');
      text.textContent = node.title.length > 20 ? node.title.substring(0, 20) + '...' : node.title;
      group.appendChild(text);

      group.addEventListener('click', () => showPanel(node));

      // Drag support
      let isDragging = false;
      group.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        isDragging = true;
        node.fx = node.x;
        node.fy = node.y;
      });

      document.addEventListener('mousemove', (e) => {
        if (isDragging) {
          const rect = svg.getBoundingClientRect();
          node.x = node.fx = (e.clientX - rect.left - translateX) / scale;
          node.y = node.fy = (e.clientY - rect.top - translateY) / scale;
        }
      });

      document.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          delete node.fx;
          delete node.fy;
        }
      });

      nodeGroup.appendChild(group);
      return { element: group, node };
    });

    // Force simulation
    function simulate() {
      const repulsion = 3000;
      const attraction = 0.03;
      const damping = 0.85;
      const centerForce = 0.005;

      // Apply forces
      for (const node of nodes) {
        if (node.fx !== undefined) continue;

        // Center force
        node.vx += (width / 2 - node.x) * centerForce;
        node.vy += (height / 2 - node.y) * centerForce;

        // Repulsion
        for (const other of nodes) {
          if (node === other) continue;
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = repulsion / (dist * dist);
          node.vx += (dx / dist) * force;
          node.vy += (dy / dist) * force;
        }
      }

      // Edge attraction
      for (const { edge } of links) {
        const dx = edge.target.x - edge.source.x;
        const dy = edge.target.y - edge.source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 150) * attraction;

        if (edge.source.fx === undefined) {
          edge.source.vx += (dx / dist) * force;
          edge.source.vy += (dy / dist) * force;
        }
        if (edge.target.fx === undefined) {
          edge.target.vx -= (dx / dist) * force;
          edge.target.vy -= (dy / dist) * force;
        }
      }

      // Update positions
      for (const node of nodes) {
        if (node.fx !== undefined) continue;

        node.vx *= damping;
        node.vy *= damping;
        node.x += node.vx;
        node.y += node.vy;

        // Bounds
        node.x = Math.max(50, Math.min(width - 50, node.x));
        node.y = Math.max(50, Math.min(height - 50, node.y));
      }

      // Update DOM
      for (const { element, edge } of links) {
        element.setAttribute('x1', edge.source.x);
        element.setAttribute('y1', edge.source.y);
        element.setAttribute('x2', edge.target.x);
        element.setAttribute('y2', edge.target.y);
      }

      for (const { element, node } of nodeElements) {
        element.setAttribute('transform', \`translate(\${node.x},\${node.y})\`);
      }

      requestAnimationFrame(simulate);
    }

    simulate();

    // Panel functions
    function showPanel(node) {
      document.getElementById('panel-title').textContent = node.title;
      document.getElementById('panel-tags').innerHTML = node.tags
        .map(t => \`<span class="panel-tag">\${t}</span>\`)
        .join('');
      document.getElementById('panel-content').textContent = node.excerpt || 'No content available';
      document.getElementById('info-panel').classList.add('visible');
    }

    function hidePanel() {
      document.getElementById('info-panel').classList.remove('visible');
    }

    // Stats
    document.getElementById('stats').textContent = \`\${nodes.length} notes, \${edges.length} connections\`;

    // Legend
    const usedTags = new Set();
    nodes.forEach(n => n.tags.forEach(t => usedTags.add(t.toLowerCase())));
    const legendHtml = [...usedTags].slice(0, 6).map(tag => {
      const color = tagColors[tag] || tagColors.default;
      return \`<div class="legend-item"><div class="legend-dot" style="background:\${color}"></div><span>\${tag}</span></div>\`;
    }).join('');
    document.getElementById('legend').innerHTML = legendHtml || '<div class="legend-item">No tags</div>';
  </script>
</body>
</html>`;
}

/**
 * Download the graph as an HTML file
 */
export function downloadGraphHTML(notes: Note[], options: GraphExportOptions = DEFAULT_EXPORT_OPTIONS): void {
  const html = generateGraphHTML(notes, options);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `patchpad-graph-${new Date().toISOString().split('T')[0]}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate embed code (iframe snippet)
 */
export function generateEmbedCode(width: number = 800, height: number = 600): string {
  return `<iframe
  src="patchpad-graph.html"
  width="${width}"
  height="${height}"
  frameborder="0"
  style="border: 1px solid #E5E7EB; border-radius: 8px;"
></iframe>`;
}
