import type { Node, Edge } from '@xyflow/react';

/**
 * Get all descendant node IDs recursively
 */
export const getDescendantIds = (nodeId: string, edges: Edge[]): Set<string> => {
  const descendants = new Set<string>();

  const findDescendants = (currentId: string) => {
    edges.forEach(edge => {
      if (edge.source === currentId) {
        descendants.add(edge.target);
        findDescendants(edge.target);
      }
    });
  };

  findDescendants(nodeId);
  return descendants;
};

/**
 * Get sibling information for a node
 */
export const getSiblingInfo = (
  nodeId: string,
  edges: Edge[]
): { parentId: string | null; siblingIds: string[]; siblingEdges: Edge[] } => {
  // Find parent edge
  const parentEdge = edges.find(edge => edge.target === nodeId);
  if (!parentEdge) {
    return { parentId: null, siblingIds: [], siblingEdges: [] };
  }

  const parentId = parentEdge.source;

  // Find all siblings (nodes with same parent)
  const siblingEdges = edges.filter(edge => edge.source === parentId);
  const siblingIds = siblingEdges.map(edge => edge.target);

  return { parentId, siblingIds, siblingEdges };
};

/**
 * Calculate new sibling order based on Y positions
 * Returns the sibling IDs sorted by their Y positions
 */
export const calculateNewSiblingOrder = <T extends Node>(
  _nodeId: string,
  siblingIds: string[],
  nodes: T[]
): string[] => {
  // Create a map of nodeId -> Y position
  const nodePositions = new Map<string, number>();
  nodes.forEach(node => {
    if (siblingIds.includes(node.id)) {
      nodePositions.set(node.id, node.position.y);
    }
  });

  // Sort sibling IDs by Y position
  return [...siblingIds].sort((a, b) => {
    const posA = nodePositions.get(a) ?? 0;
    const posB = nodePositions.get(b) ?? 0;
    return posA - posB;
  });
};

/**
 * Reorder edges based on new sibling order
 * Returns a new edges array with the edges in the correct order
 */
export const reorderEdges = (
  edges: Edge[],
  parentId: string,
  newOrder: string[]
): Edge[] => {
  // Separate sibling edges and other edges
  const siblingEdges: Edge[] = [];
  const otherEdges: Edge[] = [];

  edges.forEach(edge => {
    if (edge.source === parentId && newOrder.includes(edge.target)) {
      siblingEdges.push(edge);
    } else {
      otherEdges.push(edge);
    }
  });

  // Create a map for quick lookup
  const edgeMap = new Map<string, Edge>();
  siblingEdges.forEach(edge => {
    edgeMap.set(edge.target, edge);
  });

  // Reorder sibling edges
  const reorderedSiblingEdges = newOrder
    .map(targetId => edgeMap.get(targetId))
    .filter((edge): edge is Edge => edge !== undefined);

  // Rebuild edges array with reordered siblings in their original position
  const result: Edge[] = [];
  let siblingIndex = 0;

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    if (edge.source === parentId && newOrder.includes(edge.target)) {
      result.push(reorderedSiblingEdges[siblingIndex++]);
    } else {
      result.push(edge);
    }
  }

  return result;
};

/**
 * Check if a node is a direct child of root
 */
export const isDirectChildOfRoot = (
  nodeId: string,
  edges: Edge[],
  rootNodeId: string
): boolean => {
  return edges.some(edge => edge.source === rootNodeId && edge.target === nodeId);
};

/**
 * Get the edge connecting root to a direct child
 */
export const getRootChildEdge = (
  nodeId: string,
  edges: Edge[],
  rootNodeId: string
): Edge | undefined => {
  return edges.find(edge => edge.source === rootNodeId && edge.target === nodeId);
};

/**
 * Update source and target handles for a root child edge (switch branches)
 * - Right branch: root's 'r' handle → child's 'l' handle (left side is target for right-side nodes)
 * - Left branch: root's 'l' handle → child's 'r' handle (right side is target for left-side nodes)
 */
export const updateEdgeBranch = (
  edges: Edge[],
  edgeId: string,
  newBranch: 'l' | 'r'
): Edge[] => {
  return edges.map(edge => {
    if (edge.id === edgeId) {
      return {
        ...edge,
        sourceHandle: newBranch,
        // Target handle is OPPOSITE of source handle
        // Left branch ('l'): connect to child's right handle ('r')
        // Right branch ('r'): connect to child's left handle ('l')
        targetHandle: newBranch === 'l' ? 'r' : 'l'
      };
    }
    return edge;
  });
};

/**
 * Update edge handles for a node and all its descendants
 * When a branch switches sides, all descendant edges must also be updated
 * - Right branch: sourceHandle='r', targetHandle='l'
 * - Left branch: sourceHandle='l', targetHandle='r'
 */
export const updateBranchEdgesRecursive = (
  edges: Edge[],
  nodeId: string,
  newBranch: 'l' | 'r',
  rootNodeId: string
): Edge[] => {
  // Collect all descendant IDs (including the node itself)
  const descendantIds = getDescendantIds(nodeId, edges);
  descendantIds.add(nodeId);

  const newSourceHandle = newBranch;
  const newTargetHandle = newBranch === 'l' ? 'r' : 'l';

  // Use timestamp to force React Flow to recognize edges as new
  const timestamp = Date.now();

  return edges.map(edge => {
    // Update the root->node edge
    if (edge.source === rootNodeId && edge.target === nodeId) {
      return {
        ...edge,
        // Add timestamp to ID to force React Flow re-render
        id: `${edge.source}->${edge.target}-${timestamp}`,
        sourceHandle: newSourceHandle,
        targetHandle: newTargetHandle
      };
    }

    // Update all edges where the source is in the descendant tree
    // (edges from the moved node or any of its descendants)
    if (descendantIds.has(edge.source)) {
      return {
        ...edge,
        // Add timestamp to ID to force React Flow re-render
        id: `${edge.source}->${edge.target}-${timestamp}`,
        sourceHandle: newSourceHandle,
        targetHandle: newTargetHandle
      };
    }

    return edge;
  });
};

/**
 * Calculate sibling order for a node switching to a new branch
 * Returns the insert index and the new sibling order including the moved node
 */
export const calculateSiblingOrderForBranchSwitch = <T extends Node>(
  nodeId: string,
  nodeY: number,
  targetBranch: 'l' | 'r',
  edges: Edge[],
  nodes: T[],
  rootNodeId: string
): { insertIndex: number; newOrder: string[] } => {
  // Find existing siblings in the target branch
  const targetBranchSiblings = edges
    .filter(
      (edge) =>
        edge.source === rootNodeId &&
        edge.target !== nodeId &&
        edge.sourceHandle === targetBranch
    )
    .map((edge) => edge.target);

  // Get Y positions of target branch siblings
  const siblingsWithY = targetBranchSiblings
    .map((siblingId) => {
      const siblingNode = nodes.find((n) => n.id === siblingId);
      return {
        id: siblingId,
        y: siblingNode?.position.y ?? 0
      };
    })
    .sort((a, b) => a.y - b.y);

  // Find insert position based on Y coordinate
  let insertIndex = siblingsWithY.length; // Default: add at end
  for (let i = 0; i < siblingsWithY.length; i++) {
    if (nodeY < siblingsWithY[i].y) {
      insertIndex = i;
      break;
    }
  }

  // Build new order array
  const newOrder = siblingsWithY.map((s) => s.id);
  newOrder.splice(insertIndex, 0, nodeId);

  return { insertIndex, newOrder };
};
