import { useCallback, useRef } from 'react';
import type { Node, Edge, OnNodeDrag } from '@xyflow/react';
import {
  getDescendantIds,
  getSiblingInfo,
  calculateNewSiblingOrder,
  reorderEdges,
  isDirectChildOfRoot,
  updateBranchEdgesRecursive,
  calculateSiblingOrderForBranchSwitch
} from '../lib/tree-utils';

interface UseMindmapDragOptions {
  rootNodeId?: string;
}

interface UseMindmapDragReturn<T extends Node> {
  onNodeDragStart: OnNodeDrag<T>;
  onNodeDrag: OnNodeDrag<T>;
  onNodeDragStop: OnNodeDrag<T>;
  getNodeDraggable: (nodeId: string) => boolean;
}

interface DragState {
  draggedNodeId: string | null;
  descendantOffsets: Map<string, { dx: number; dy: number }>;
  originalBranch: 'l' | 'r' | null;
  isDraggingRootChild: boolean;
}

/**
 * Hook for managing mindmap node drag and drop
 *
 * @param nodes - Current nodes array
 * @param edges - Current edges array
 * @param setNodes - Function to update nodes
 * @param setEdges - Function to update edges
 * @param autoLayout - Function to trigger auto-layout
 * @param options - Drag options
 */
export function useMindmapDrag<T extends Node>(
  nodes: T[],
  edges: Edge[],
  setNodes: React.Dispatch<React.SetStateAction<T[]>>,
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>,
  autoLayout: () => void,
  options: UseMindmapDragOptions = {}
): UseMindmapDragReturn<T> {
  const { rootNodeId = 'root' } = options;

  // Keep refs to always access the latest state
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  // Drag state
  const dragStateRef = useRef<DragState>({
    draggedNodeId: null,
    descendantOffsets: new Map(),
    originalBranch: null,
    isDraggingRootChild: false
  });

  /**
   * Check if a node is draggable (root node is not draggable)
   */
  const getNodeDraggable = useCallback(
    (nodeId: string): boolean => {
      return nodeId !== rootNodeId;
    },
    [rootNodeId]
  );

  /**
   * Handle drag start - calculate descendant offsets and save branch info
   */
  const onNodeDragStart: OnNodeDrag<T> = useCallback(
    (_event, node, _nodes) => {
      // Don't allow dragging root node
      if (node.id === rootNodeId) return;

      const currentEdges = edgesRef.current;
      const currentNodes = nodesRef.current;

      // Save dragged node ID
      dragStateRef.current.draggedNodeId = node.id;

      // Check if dragging a root child
      const isDraggingRootChild = isDirectChildOfRoot(node.id, currentEdges, rootNodeId);
      dragStateRef.current.isDraggingRootChild = isDraggingRootChild;

      // Save original branch for root children
      if (isDraggingRootChild) {
        const parentEdge = currentEdges.find(
          (e) => e.source === rootNodeId && e.target === node.id
        );
        dragStateRef.current.originalBranch = (parentEdge?.sourceHandle as 'l' | 'r') || 'r';
      } else {
        // For non-root children, determine branch from ancestor
        const parentEdge = currentEdges.find((e) => e.target === node.id);
        if (parentEdge) {
          dragStateRef.current.originalBranch = (parentEdge.sourceHandle as 'l' | 'r') || 'r';
        }
      }

      // Calculate descendant offsets
      const descendantIds = getDescendantIds(node.id, currentEdges);
      const offsets = new Map<string, { dx: number; dy: number }>();

      descendantIds.forEach((id) => {
        const descendant = currentNodes.find((n) => n.id === id);
        if (descendant) {
          offsets.set(id, {
            dx: descendant.position.x - node.position.x,
            dy: descendant.position.y - node.position.y
          });
        }
      });

      dragStateRef.current.descendantOffsets = offsets;
    },
    [rootNodeId]
  );

  /**
   * Handle drag - move descendants with the dragged node
   */
  const onNodeDrag: OnNodeDrag<T> = useCallback(
    (_event, node, _nodes) => {
      // Don't allow dragging root node
      if (node.id === rootNodeId) return;

      const offsets = dragStateRef.current.descendantOffsets;

      // Move descendants with the dragged node
      if (offsets.size > 0) {
        setNodes((nds) =>
          nds.map((n) => {
            const offset = offsets.get(n.id);
            if (offset) {
              return {
                ...n,
                position: {
                  x: node.position.x + offset.dx,
                  y: node.position.y + offset.dy
                }
              };
            }
            return n;
          })
        );
      }
    },
    [rootNodeId, setNodes]
  );

  /**
   * Handle drag stop - reorder siblings or switch branches
   */
  const onNodeDragStop: OnNodeDrag<T> = useCallback(
    (_event, node, _nodes) => {
      // Don't process for root node
      if (node.id === rootNodeId) return;

      const currentEdges = edgesRef.current;
      const currentNodes = nodesRef.current;
      const { isDraggingRootChild, originalBranch } = dragStateRef.current;

      // Check if we need to switch branches (only for root children)
      if (isDraggingRootChild && originalBranch) {
        // Determine new branch based on X position
        const newBranch: 'l' | 'r' = node.position.x < 0 ? 'l' : 'r';

        if (newBranch !== originalBranch) {
          // Branch switch needed
          const { newOrder } = calculateSiblingOrderForBranchSwitch(
            node.id,
            node.position.y,
            newBranch,
            currentEdges,
            currentNodes,
            rootNodeId
          );

          // Update edges with new branch and order
          let updatedEdges = updateBranchEdgesRecursive(
            currentEdges,
            node.id,
            newBranch,
            rootNodeId
          );
          updatedEdges = reorderEdges(updatedEdges, rootNodeId, newOrder);

          setEdges(updatedEdges);
          setTimeout(autoLayout, 50);

          // Reset drag state
          dragStateRef.current = {
            draggedNodeId: null,
            descendantOffsets: new Map(),
            originalBranch: null,
            isDraggingRootChild: false
          };

          return;
        }
      }

      // Same branch - just reorder siblings based on Y position
      const { parentId, siblingIds } = getSiblingInfo(node.id, currentEdges);

      if (parentId && siblingIds.length > 1) {
        // Calculate new sibling order based on Y positions
        const newOrder = calculateNewSiblingOrder(node.id, siblingIds, currentNodes);

        // Reorder edges
        const updatedEdges = reorderEdges(currentEdges, parentId, newOrder);
        setEdges(updatedEdges);

        // Re-layout after reordering
        setTimeout(autoLayout, 50);
      } else {
        // Single node or no parent - just re-layout
        setTimeout(autoLayout, 50);
      }

      // Reset drag state
      dragStateRef.current = {
        draggedNodeId: null,
        descendantOffsets: new Map(),
        originalBranch: null,
        isDraggingRootChild: false
      };
    },
    [rootNodeId, setEdges, autoLayout]
  );

  return {
    onNodeDragStart,
    onNodeDrag,
    onNodeDragStop,
    getNodeDraggable
  };
}
