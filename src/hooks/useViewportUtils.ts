import { useCallback } from 'react';
import { useReactFlow, useStoreApi } from '@xyflow/react';

interface EnsureNodeVisibleOptions {
  centerNode?: boolean; // ノードを中央に配置するか (default: false)
  duration?: number; // アニメーション時間ms (default: 200)
  padding?: number; // 画面端からのパディングpx (default: 50)
}

export function useViewportUtils() {
  const reactFlowInstance = useReactFlow();
  const store = useStoreApi();

  const ensureNodeVisible = useCallback(
    async (
      nodeId: string,
      options?: EnsureNodeVisibleOptions
    ): Promise<boolean> => {
      const { centerNode = false, duration = 200, padding = 50 } = options || {};

      // Get the target node
      const nodes = reactFlowInstance.getNodes();
      const targetNode = nodes.find((n) => n.id === nodeId);
      if (!targetNode) {
        return false;
      }

      // Get node dimensions (measured or default)
      const nodeWidth = targetNode.measured?.width ?? targetNode.width ?? 150;
      const nodeHeight = targetNode.measured?.height ?? targetNode.height ?? 40;

      // Get current viewport
      const viewport = reactFlowInstance.getViewport();
      const { x: vpX, y: vpY, zoom } = viewport;

      // Get the container dimensions from the store
      const { width: containerWidth, height: containerHeight } =
        store.getState();

      // Calculate viewport bounds in flow coordinates
      const viewportLeft = -vpX / zoom;
      const viewportTop = -vpY / zoom;
      const viewportRight = viewportLeft + containerWidth / zoom;
      const viewportBottom = viewportTop + containerHeight / zoom;

      // Node bounds in flow coordinates
      const nodeLeft = targetNode.position.x;
      const nodeTop = targetNode.position.y;
      const nodeRight = nodeLeft + nodeWidth;
      const nodeBottom = nodeTop + nodeHeight;

      // Padding in flow coordinates
      const paddingFlow = padding / zoom;

      // Check if node is already visible (with padding)
      const isVisible =
        nodeLeft >= viewportLeft + paddingFlow &&
        nodeRight <= viewportRight - paddingFlow &&
        nodeTop >= viewportTop + paddingFlow &&
        nodeBottom <= viewportBottom - paddingFlow;

      if (isVisible && !centerNode) {
        // Node is already visible, no need to move
        return false;
      }

      // Calculate new viewport position
      let newVpX = vpX;
      let newVpY = vpY;

      if (centerNode) {
        // Center the node in the viewport
        const nodeCenterX = nodeLeft + nodeWidth / 2;
        const nodeCenterY = nodeTop + nodeHeight / 2;
        newVpX = -(nodeCenterX * zoom - containerWidth / 2);
        newVpY = -(nodeCenterY * zoom - containerHeight / 2);
      } else {
        // Minimum move to bring node into view
        // Check horizontal bounds
        if (nodeLeft < viewportLeft + paddingFlow) {
          // Node is too far left
          newVpX = -(nodeLeft - paddingFlow) * zoom;
        } else if (nodeRight > viewportRight - paddingFlow) {
          // Node is too far right
          newVpX = -(nodeRight + paddingFlow - containerWidth / zoom) * zoom;
        }

        // Check vertical bounds
        if (nodeTop < viewportTop + paddingFlow) {
          // Node is too far up
          newVpY = -(nodeTop - paddingFlow) * zoom;
        } else if (nodeBottom > viewportBottom - paddingFlow) {
          // Node is too far down
          newVpY = -(nodeBottom + paddingFlow - containerHeight / zoom) * zoom;
        }
      }

      // Only move if position changed
      if (newVpX !== vpX || newVpY !== vpY) {
        await reactFlowInstance.setViewport(
          { x: newVpX, y: newVpY, zoom },
          { duration }
        );
        return true;
      }

      return false;
    },
    [reactFlowInstance, store]
  );

  return { ensureNodeVisible };
}
