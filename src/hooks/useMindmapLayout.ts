import { useCallback } from 'react';
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

  const autoLayout = useCallback(() => {
    setNodes((currentNodes) => {
      const layoutedNodes = calculateMindmapLayout(currentNodes, edges, rootNodeId);
      return layoutedNodes;
    });
  }, [edges, setNodes, rootNodeId]);

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
