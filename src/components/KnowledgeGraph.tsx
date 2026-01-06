import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { KnowledgeGraph as KnowledgeGraphType, Concept, ConceptRelationship } from '../services/brain';

interface KnowledgeGraphProps {
  graph: KnowledgeGraphType;
  onConceptClick?: (concept: Concept) => void;
  onNoteClick?: (noteId: string) => void;
  selectedConceptId?: string;
}

interface Node {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  concept: Concept;
}

interface Edge {
  source: string;
  target: string;
  relationship: ConceptRelationship;
}

const TYPE_COLORS: Record<string, string> = {
  person: '#3B82F6',      // blue
  organization: '#8B5CF6', // purple
  project: '#10B981',      // green
  topic: '#F59E0B',        // amber
  location: '#EF4444',     // red
  event: '#EC4899',        // pink
  idea: '#6366F1',         // indigo
  task: '#14B8A6',         // teal
  date: '#F97316',         // orange
  other: '#6B7280',        // gray
};

export function KnowledgeGraph({
  graph,
  onConceptClick,
  onNoteClick,
  selectedConceptId,
}: KnowledgeGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [draggingNode, setDraggingNode] = useState<Node | null>(null);
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const animationRef = useRef<number>();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Initialize nodes and edges
  const initializeGraph = useCallback(() => {
    const width = dimensions.width;
    const height = dimensions.height;

    // Create nodes with random initial positions
    nodesRef.current = graph.concepts.map((concept, i) => {
      const angle = (i / graph.concepts.length) * 2 * Math.PI;
      const radius = Math.min(width, height) * 0.3;
      return {
        id: concept.id,
        x: width / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 50,
        y: height / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 50,
        vx: 0,
        vy: 0,
        concept,
      };
    });

    // Create edges
    edgesRef.current = graph.relationships.map(rel => ({
      source: rel.sourceId,
      target: rel.targetId,
      relationship: rel,
    }));
  }, [graph, dimensions]);

  // Force-directed simulation
  const simulate = useCallback(() => {
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const width = dimensions.width;
    const height = dimensions.height;

    // Parameters
    const repulsion = 2000;
    const attraction = 0.05;
    const damping = 0.9;
    const centerForce = 0.01;

    // Apply forces
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node === draggingNode) continue;

      // Center force
      node.vx += (width / 2 - node.x) * centerForce;
      node.vy += (height / 2 - node.y) * centerForce;

      // Repulsion from other nodes
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const other = nodes[j];
        const dx = node.x - other.x;
        const dy = node.y - other.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = repulsion / (dist * dist);
        node.vx += (dx / dist) * force;
        node.vy += (dy / dist) * force;
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const source = nodes.find(n => n.id === edge.source);
      const target = nodes.find(n => n.id === edge.target);
      if (!source || !target) continue;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - 100) * attraction * edge.relationship.strength;

      if (source !== draggingNode) {
        source.vx += (dx / dist) * force;
        source.vy += (dy / dist) * force;
      }
      if (target !== draggingNode) {
        target.vx -= (dx / dist) * force;
        target.vy -= (dy / dist) * force;
      }
    }

    // Update positions
    for (const node of nodes) {
      if (node === draggingNode) continue;

      node.vx *= damping;
      node.vy *= damping;
      node.x += node.vx;
      node.y += node.vy;

      // Keep within bounds
      const margin = 30;
      node.x = Math.max(margin, Math.min(width - margin, node.x));
      node.y = Math.max(margin, Math.min(height - margin, node.y));
    }
  }, [dimensions, draggingNode]);

  // Render the graph
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nodes = nodesRef.current;
    const edges = edgesRef.current;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply zoom and pan
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // Draw edges
    for (const edge of edges) {
      const source = nodes.find(n => n.id === edge.source);
      const target = nodes.find(n => n.id === edge.target);
      if (!source || !target) continue;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.strokeStyle = `rgba(156, 163, 175, ${0.2 + edge.relationship.strength * 0.4})`;
      ctx.lineWidth = 1 + edge.relationship.strength * 2;
      ctx.stroke();
    }

    // Draw nodes
    for (const node of nodes) {
      const isSelected = node.id === selectedConceptId;
      const isHovered = node === hoveredNode;
      const radius = 8 + Math.log(node.concept.mentions.length + 1) * 4;
      const color = TYPE_COLORS[node.concept.type] || TYPE_COLORS.other;

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      if (isSelected || isHovered) {
        ctx.strokeStyle = isSelected ? '#1F2937' : '#6B7280';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Label
      ctx.font = `${isHovered ? 'bold ' : ''}11px system-ui, sans-serif`;
      ctx.fillStyle = '#374151';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(
        node.concept.name.length > 15
          ? node.concept.name.substring(0, 15) + '...'
          : node.concept.name,
        node.x,
        node.y + radius + 4
      );
    }

    ctx.restore();
  }, [hoveredNode, selectedConceptId, zoom, pan]);

  // Animation loop
  useEffect(() => {
    initializeGraph();

    let frameCount = 0;
    const animate = () => {
      simulate();
      render();
      frameCount++;

      // Slow down after initial settling
      if (frameCount < 100 || draggingNode) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Continue with reduced frequency
        setTimeout(() => {
          animationRef.current = requestAnimationFrame(animate);
        }, 100);
      }
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [initializeGraph, simulate, render, draggingNode]);

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Mouse event handlers
  const getMousePos = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - pan.x) / zoom,
      y: (e.clientY - rect.top - pan.y) / zoom,
    };
  }, [zoom, pan]);

  const findNodeAtPosition = useCallback((x: number, y: number): Node | null => {
    const nodes = nodesRef.current;
    for (const node of nodes) {
      const radius = 8 + Math.log(node.concept.mentions.length + 1) * 4;
      const dx = x - node.x;
      const dy = y - node.y;
      if (dx * dx + dy * dy < radius * radius) {
        return node;
      }
    }
    return null;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const pos = getMousePos(e);

    if (draggingNode) {
      draggingNode.x = pos.x;
      draggingNode.y = pos.y;
      draggingNode.vx = 0;
      draggingNode.vy = 0;
    } else {
      setHoveredNode(findNodeAtPosition(pos.x, pos.y));
    }
  }, [getMousePos, draggingNode, findNodeAtPosition]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const pos = getMousePos(e);
    const node = findNodeAtPosition(pos.x, pos.y);
    if (node) {
      setDraggingNode(node);
    }
  }, [getMousePos, findNodeAtPosition]);

  const handleMouseUp = useCallback(() => {
    if (draggingNode && onConceptClick) {
      // If barely moved, treat as click
      onConceptClick(draggingNode.concept);
    }
    setDraggingNode(null);
  }, [draggingNode, onConceptClick]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.5, Math.min(3, z * delta)));
  }, []);

  // Legend component
  const legend = useMemo(() => (
    <div className="absolute bottom-2 left-2 bg-white/90 rounded-lg p-2 text-xs shadow-sm">
      <div className="font-medium text-gray-700 mb-1">Concept Types</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        {Object.entries(TYPE_COLORS).slice(0, 8).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-gray-600 capitalize">{type}</span>
          </div>
        ))}
      </div>
    </div>
  ), []);

  // Hovered node info
  const hoveredInfo = hoveredNode && (
    <div className="absolute top-2 left-2 bg-white/95 rounded-lg p-3 shadow-lg max-w-xs">
      <div className="font-medium text-gray-900">{hoveredNode.concept.name}</div>
      <div className="text-xs text-gray-500 capitalize mt-0.5">{hoveredNode.concept.type}</div>
      <div className="text-xs text-gray-600 mt-2">
        Mentioned in {hoveredNode.concept.mentions.length} note{hoveredNode.concept.mentions.length !== 1 ? 's' : ''}
      </div>
      {hoveredNode.concept.mentions.length > 0 && (
        <div className="mt-2 space-y-1">
          {hoveredNode.concept.mentions.slice(0, 3).map((mention, i) => (
            <button
              key={i}
              onClick={() => onNoteClick?.(mention.noteId)}
              className="block text-xs text-blue-600 hover:underline truncate w-full text-left"
            >
              {mention.noteTitle}
            </button>
          ))}
          {hoveredNode.concept.mentions.length > 3 && (
            <div className="text-xs text-gray-400">
              +{hoveredNode.concept.mentions.length - 3} more
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (graph.concepts.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p className="text-sm">No concepts extracted yet</p>
          <p className="text-xs text-gray-400 mt-1">Add more notes to build your knowledge graph</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full bg-gray-50 rounded-lg overflow-hidden">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className="cursor-grab active:cursor-grabbing"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setHoveredNode(null);
          setDraggingNode(null);
        }}
        onWheel={handleWheel}
      />
      {hoveredInfo}
      {legend}

      {/* Zoom controls */}
      <div className="absolute top-2 right-2 flex flex-col gap-1">
        <button
          onClick={() => setZoom(z => Math.min(3, z * 1.2))}
          className="p-1.5 bg-white rounded shadow hover:bg-gray-50"
          title="Zoom in"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <button
          onClick={() => setZoom(z => Math.max(0.5, z / 1.2))}
          className="p-1.5 bg-white rounded shadow hover:bg-gray-50"
          title="Zoom out"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <button
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
          className="p-1.5 bg-white rounded shadow hover:bg-gray-50"
          title="Reset view"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>

      {/* Stats */}
      <div className="absolute bottom-2 right-2 text-xs text-gray-500 bg-white/80 px-2 py-1 rounded">
        {graph.concepts.length} concepts, {graph.relationships.length} connections
      </div>
    </div>
  );
}
