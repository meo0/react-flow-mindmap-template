import type { Node, Edge } from '@xyflow/react';
// @ts-expect-error d3-flextree doesn't have types
import { flextree } from 'd3-flextree';

// Node size defaults
const DEFAULT_NODE_WIDTH = 150;
const DEFAULT_NODE_HEIGHT = 40;
const NODE_SPACING_HORIZONTAL = 100;
const NODE_SPACING_VERTICAL = 8;

// Hierarchy node interface for layout calculation
interface HierarchyNode extends Node {
  children?: HierarchyNode[];
  width?: number;
  height?: number;
  __calculated?: boolean;
}

interface FlextreeNode {
  data: HierarchyNode;
  x: number;
  y: number;
  descendants: () => FlextreeNode[];
}

/**
 * Build hierarchy structure from nodes and edges
 */
export const buildHierarchy = <T extends Node>(
  nodes: T[],
  edges: Edge[],
  rootNodeId: string
): HierarchyNode | null => {
  // Create node map
  const nodeMap = new Map<string, HierarchyNode>();
  nodes.forEach(node => {
    nodeMap.set(node.id, { ...node, children: [] });
  });

  // Return null if root node doesn't exist
  if (!nodeMap.has(rootNodeId)) {
    return null;
  }

  // Build parent-child relationships from edges
  edges.forEach(edge => {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);

    if (source && target && !target.__calculated) {
      if (!source.children) {
        source.children = [];
      }
      source.children.push(target);
      target.__calculated = true;
    }
  });

  return nodeMap.get(rootNodeId) || null;
};

/**
 * Calculate node size including measured dimensions
 */
export const calculateNodeSize = (node: Node): { width: number; height: number } => {
  return {
    width: node.measured?.width ?? DEFAULT_NODE_WIDTH,
    height: node.measured?.height ?? DEFAULT_NODE_HEIGHT
  };
};

/**
 * Calculate layout for a tree structure (single direction)
 */
export const calculateLayout = <T extends Node>(
  nodes: T[],
  edges: Edge[],
  rootNodeId: string
): T[] => {
  const hierarchy = buildHierarchy(nodes, edges, rootNodeId);
  if (!hierarchy) {
    return nodes;
  }

  // Set node dimensions with spacing
  const setNodeDimensions = (node: HierarchyNode) => {
    node.width = (node.measured?.width ?? DEFAULT_NODE_WIDTH) + NODE_SPACING_HORIZONTAL;
    node.height = (node.measured?.height ?? DEFAULT_NODE_HEIGHT) + NODE_SPACING_VERTICAL;

    if (node.children) {
      node.children.forEach(setNodeDimensions);
    }
  };

  setNodeDimensions(hierarchy);

  // Calculate layout using flextree
  const layout = flextree({
    spacing: NODE_SPACING_VERTICAL
  })
    .nodeSize((node: FlextreeNode) => {
      return [
        node.data.height || (DEFAULT_NODE_HEIGHT + NODE_SPACING_VERTICAL),
        node.data.width || (DEFAULT_NODE_WIDTH + NODE_SPACING_HORIZONTAL)
      ];
    });

  const tree = layout.hierarchy(hierarchy);
  layout(tree);

  // Apply calculated positions to nodes
  const updatedNodes = [...nodes];

  tree.descendants().forEach((d: FlextreeNode) => {
    const nodeIndex = updatedNodes.findIndex(n => n.id === d.data.id);
    if (nodeIndex !== -1) {
      // For horizontal tree, swap x and y from flextree
      updatedNodes[nodeIndex] = {
        ...updatedNodes[nodeIndex],
        position: {
          x: d.y,
          y: d.x
        }
      };
    }
  });

  return updatedNodes;
};

/**
 * Determine which side (left/right) each node belongs to based on edge sourceHandle
 */
const determineNodeSides = (
  edges: Edge[],
  rootNodeId: string
): { leftNodeIds: Set<string>; rightNodeIds: Set<string> } => {
  const leftNodeIds = new Set<string>();
  const rightNodeIds = new Set<string>();

  // Build adjacency map: parent -> children
  const childrenMap = new Map<string, string[]>();
  const edgeMap = new Map<string, Edge>();

  edges.forEach(edge => {
    if (!childrenMap.has(edge.source)) {
      childrenMap.set(edge.source, []);
    }
    childrenMap.get(edge.source)!.push(edge.target);
    edgeMap.set(`${edge.source}->${edge.target}`, edge);
  });

  // BFS to determine sides, starting from root's direct children
  const queue: { nodeId: string; side: 'left' | 'right' }[] = [];

  // Initialize with root's direct children based on sourceHandle
  const rootChildren = childrenMap.get(rootNodeId) || [];
  rootChildren.forEach(childId => {
    const edge = edgeMap.get(`${rootNodeId}->${childId}`);
    const side = edge?.sourceHandle === 'l' ? 'left' : 'right';
    queue.push({ nodeId: childId, side });
  });

  // Process queue (BFS)
  while (queue.length > 0) {
    const { nodeId, side } = queue.shift()!;

    // Skip if already processed
    if (leftNodeIds.has(nodeId) || rightNodeIds.has(nodeId)) {
      continue;
    }

    // Assign side
    if (side === 'left') {
      leftNodeIds.add(nodeId);
    } else {
      rightNodeIds.add(nodeId);
    }

    // Add children with inherited side
    const children = childrenMap.get(nodeId) || [];
    children.forEach(childId => {
      queue.push({ nodeId: childId, side });
    });
  }

  return { leftNodeIds, rightNodeIds };
};

/**
 * Calculate mindmap layout with central node and bidirectional branches
 */
export const calculateMindmapLayout = <T extends Node>(
  nodes: T[],
  edges: Edge[],
  rootNodeId: string
): T[] => {
  const centralNode = nodes.find(node => node.id === rootNodeId);
  if (!centralNode) {
    return nodes;
  }

  // Determine which side each node belongs to
  const { leftNodeIds, rightNodeIds } = determineNodeSides(edges, rootNodeId);

  // Build node and edge groups
  const rightGroupNodes: T[] = [centralNode];
  const leftGroupNodes: T[] = [centralNode];
  const rightGroupEdges: Edge[] = [];
  const leftGroupEdges: Edge[] = [];

  nodes.forEach(node => {
    if (node.id === rootNodeId) return;

    if (rightNodeIds.has(node.id)) {
      rightGroupNodes.push(node);
    } else if (leftNodeIds.has(node.id)) {
      leftGroupNodes.push(node);
    }
  });

  edges.forEach(edge => {
    if (rightNodeIds.has(edge.target)) {
      rightGroupEdges.push(edge);
    } else if (leftNodeIds.has(edge.target)) {
      leftGroupEdges.push(edge);
    }
  });

  // Calculate layout for each group
  const rightLayoutNodes = calculateLayout(rightGroupNodes, rightGroupEdges, rootNodeId);
  const leftLayoutNodes = calculateLayout(leftGroupNodes, leftGroupEdges, rootNodeId);

  // Create result map for easy lookup
  const resultMap = new Map<string, T>();

  // Add right nodes (including root)
  rightLayoutNodes.forEach(node => {
    resultMap.set(node.id, node);
  });

  // Flip and add left nodes (root position comes from right layout)
  leftLayoutNodes.forEach(node => {
    if (node.id !== rootNodeId) {
      // Simple flip: negate x position relative to root
      const flippedNode = {
        ...node,
        position: {
          x: -node.position.x,
          y: node.position.y
        }
      };
      resultMap.set(node.id, flippedNode);
    }
  });

  // Preserve nodes that weren't part of any group (orphans) with original positions
  nodes.forEach(node => {
    if (!resultMap.has(node.id)) {
      resultMap.set(node.id, node);
    }
  });

  return Array.from(resultMap.values());
};

/**
 * Get filtered nodes (hide children when hidChildren is true)
 */
export const getFilteredNodes = <T extends Node>(nodes: T[], edges: Edge[]): T[] => {
  // Find nodes whose parent has hidChildren set to true
  const hiddenNodeIds = new Set<string>();

  const findHiddenDescendants = (nodeId: string) => {
    edges.forEach(edge => {
      if (edge.source === nodeId) {
        hiddenNodeIds.add(edge.target);
        findHiddenDescendants(edge.target);
      }
    });
  };

  // Find all nodes that have hidChildren = true and hide their descendants
  nodes.forEach(node => {
    if ((node.data as { hidChildren?: boolean })?.hidChildren) {
      findHiddenDescendants(node.id);
    }
  });

  return nodes.filter(node => !hiddenNodeIds.has(node.id));
};

/**
 * Get filtered edges (hide edges to hidden nodes)
 */
export const getFilteredEdges = <T extends Node>(nodes: T[], edges: Edge[]): Edge[] => {
  const filteredNodes = getFilteredNodes(nodes, edges);
  const visibleNodeIds = new Set(filteredNodes.map(n => n.id));

  return edges.filter(edge =>
    visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
  );
};

/**
 * Estimate the initial position for a new node
 * This provides an approximate position to avoid flickering when the node is created.
 * The exact position will be determined by autoLayout after rendering.
 */
export const estimateNewNodePosition = (
  nodes: Node[],
  parentId: string,
  isChild: boolean,  // true: child node, false: sibling node
  branch: 'l' | 'r'
): { x: number; y: number } => {
  // Offset constants based on layout settings
  const HORIZONTAL_OFFSET = DEFAULT_NODE_WIDTH + NODE_SPACING_HORIZONTAL; // 250
  const VERTICAL_OFFSET = DEFAULT_NODE_HEIGHT + NODE_SPACING_VERTICAL * 4; // 72

  if (isChild) {
    // Child node: position horizontally from parent
    const parentNode = nodes.find(n => n.id === parentId);
    if (!parentNode) return { x: 0, y: 0 };

    const xOffset = branch === 'l' ? -HORIZONTAL_OFFSET : HORIZONTAL_OFFSET;
    return {
      x: parentNode.position.x + xOffset,
      y: parentNode.position.y
    };
  } else {
    // Sibling node: position vertically from reference node
    const referenceNode = nodes.find(n => n.id === parentId);
    if (!referenceNode) return { x: 0, y: 0 };

    return {
      x: referenceNode.position.x,
      y: referenceNode.position.y + VERTICAL_OFFSET
    };
  }
};
