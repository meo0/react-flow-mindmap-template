import { useCallback, useRef } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { calculateMindmapLayout, getFilteredNodes, getFilteredEdges } from '../lib/layout';

interface UseMindmapLayoutOptions {
  rootNodeId?: string;
}

interface UseMindmapLayoutReturn<T extends Node> {
  /**
   * Trigger auto-layout calculation
   */
  autoLayout: () => void;
  /**
   * Get nodes that should be visible (respects hidChildren flag)
   */
  getVisibleNodes: () => T[];
  /**
   * Get edges that should be visible
   */
  getVisibleEdges: () => Edge[];
}

/**
 * Hook for managing mindmap layout
 *
 * @param nodes - Current nodes array
 * @param edges - Current edges array
 * @param setNodes - Function to update nodes
 * @param options - Layout options
 */
export function useMindmapLayout<T extends Node>(
  nodes: T[],
  edges: Edge[],
  setNodes: React.Dispatch<React.SetStateAction<T[]>>,
  options: UseMindmapLayoutOptions = {}
): UseMindmapLayoutReturn<T> {
  const { rootNodeId = 'root' } = options;

  // Keep a ref to always access the latest edges
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  const autoLayout = useCallback(() => {
    setNodes((currentNodes) => {
      // Get only visible nodes and edges for layout calculation
      const visibleNodes = getFilteredNodes(currentNodes, edgesRef.current);
      const visibleEdges = getFilteredEdges(currentNodes, edgesRef.current);

      // Calculate layout only for visible nodes
      const layoutedVisibleNodes = calculateMindmapLayout(visibleNodes, visibleEdges, rootNodeId);

      // Create a map of layouted positions
      const positionMap = new Map<string, { x: number; y: number }>();
      layoutedVisibleNodes.forEach(node => {
        positionMap.set(node.id, node.position);
      });

      // Apply positions to original nodes (preserving hidden nodes with their original positions)
      return currentNodes.map(node => {
        const newPosition = positionMap.get(node.id);
        if (newPosition) {
          return { ...node, position: newPosition };
        }
        return node;
      });
    });
  }, [setNodes, rootNodeId]);

  const getVisibleNodes = useCallback(() => {
    return getFilteredNodes(nodes, edges);
  }, [nodes, edges]);

  const getVisibleEdges = useCallback(() => {
    return getFilteredEdges(nodes, edges);
  }, [nodes, edges]);

  return {
    autoLayout,
    getVisibleNodes,
    getVisibleEdges
  };
}
