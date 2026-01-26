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

  // Get direct children of root node
  const childrenIds: string[] = [];
  edges.forEach(edge => {
    if (edge.source === rootNodeId) {
      childrenIds.push(edge.target);
    }
  });

  // Split children into left and right groups based on x position
  const rightGroupIds: Set<string> = new Set();
  const leftGroupIds: Set<string> = new Set();

  childrenIds.forEach((id, index) => {
    const node = nodes.find(n => n.id === id);
    if (!node || !node.position) {
      // Alternate if position not available
      if (index % 2 === 0) {
        rightGroupIds.add(id);
      } else {
        leftGroupIds.add(id);
      }
      return;
    }

    // Split based on x position
    if (node.position.x >= 0) {
      rightGroupIds.add(id);
    } else {
      leftGroupIds.add(id);
    }
  });

  // Create groups including descendants
  const rightGroupNodes: T[] = [];
  const leftGroupNodes: T[] = [];
  const rightGroupEdges: Edge[] = [];
  const leftGroupEdges: Edge[] = [];

  // Add root node to both groups
  rightGroupNodes.push(centralNode);
  leftGroupNodes.push(centralNode);

  // Add edges from root to direct children
  edges.forEach(edge => {
    if (edge.source === rootNodeId) {
      const targetId = edge.target;
      if (rightGroupIds.has(targetId)) {
        rightGroupEdges.push(edge);
      }
      if (leftGroupIds.has(targetId)) {
        leftGroupEdges.push(edge);
      }
    }
  });

  // Recursively add descendants to groups
  const addNodeAndDescendants = (
    nodeId: string,
    groupNodes: T[],
    groupEdges: Edge[],
    groupIds: Set<string>
  ) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    groupNodes.push(node);
    groupIds.add(nodeId);

    edges.forEach(edge => {
      if (edge.source === nodeId && edge.source !== rootNodeId) {
        groupEdges.push(edge);
        addNodeAndDescendants(edge.target, groupNodes, groupEdges, groupIds);
      }
    });
  };

  rightGroupIds.forEach(id => {
    addNodeAndDescendants(id, rightGroupNodes, rightGroupEdges, rightGroupIds);
  });

  leftGroupIds.forEach(id => {
    addNodeAndDescendants(id, leftGroupNodes, leftGroupEdges, leftGroupIds);
  });

  // Calculate layout for each group
  const rightLayoutNodes = calculateLayout(rightGroupNodes, rightGroupEdges, rootNodeId);
  const leftLayoutNodes = calculateLayout(leftGroupNodes, leftGroupEdges, rootNodeId);

  // Get central node positions after layout
  const centralNodeRight = rightLayoutNodes.find(node => node.id === rootNodeId);
  const centralNodeLeft = leftLayoutNodes.find(node => node.id === rootNodeId);

  if (!centralNodeRight || !centralNodeLeft || !centralNodeRight.position || !centralNodeLeft.position) {
    return nodes;
  }

  // Flip left nodes to the left side of central node
  const flippedLeftNodes = leftLayoutNodes.map(node => {
    if (node.id !== rootNodeId) {
      const relativeX = node.position.x;
      return {
        ...node,
        position: {
          x: -relativeX + (centralNodeLeft.measured?.width || 0) - (node.measured?.width || 0),
          y: node.position.y
        }
      };
    }
    return node;
  });

  // Merge results (exclude duplicate root node from left)
  const resultNodes = [...rightLayoutNodes];

  flippedLeftNodes.forEach(node => {
    if (node.id !== rootNodeId) {
      resultNodes.push(node);
    }
  });

  return resultNodes;
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
