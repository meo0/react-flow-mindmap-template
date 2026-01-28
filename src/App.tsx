import { useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  BackgroundVariant,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type OnConnect,
  type OnConnectEnd,
  type Edge
} from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';

import '@xyflow/react/dist/style.css';

import { initialNodes, nodeTypes } from './nodes';
import { initialEdges, edgeTypes } from './edges';
import { useMindmapLayout } from './hooks/useMindmapLayout';
import { useMindmapDrag } from './hooks/useMindmapDrag';
import { useViewportUtils } from './hooks/useViewportUtils';
import { calculateNodeSize } from './lib/layout';
import type { AppNode, MindmapNodeData } from './nodes/types';

// Custom events
const TOGGLE_CHILDREN_EVENT = 'mindmap:toggleChildren';
const CREATE_CHILD_EVENT = 'mindmap:createChild';
const CREATE_SIBLING_EVENT = 'mindmap:createSibling';
const START_EDIT_EVENT = 'mindmap:startEdit';

const rfStyle = {
  backgroundColor: '#f0fdff'
};

function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const reactFlowInstance = useReactFlow();

  // Use the mindmap layout hook
  const { autoLayout, getVisibleNodes, getVisibleEdges } = useMindmapLayout(
    nodes,
    edges,
    setNodes,
    { rootNodeId: 'root' }
  );

  // Use the mindmap drag hook
  const { onNodeDragStart, onNodeDrag, onNodeDragStop, getNodeDraggable } =
    useMindmapDrag(nodes, edges, setNodes, setEdges, autoLayout, {
      rootNodeId: 'root'
    });

  // Use viewport utils hook
  const { ensureNodeVisible } = useViewportUtils();

  // Auto-layout on initial render
  useEffect(() => {
    // Small delay to ensure nodes are measured
    const timer = setTimeout(() => {
      autoLayout();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Listen for toggle children events from nodes
  useEffect(() => {
    // Count all descendants (children, grandchildren, etc.) recursively
    const countAllDescendants = (nodeId: string): number => {
      const directChildren = edges.filter(edge => edge.source === nodeId);
      let count = directChildren.length;
      for (const edge of directChildren) {
        count += countAllDescendants(edge.target);
      }
      return count;
    };

    const handleToggleChildren = (e: Event) => {
      const event = e as CustomEvent<{ nodeId: string }>;
      const nodeId = event.detail.nodeId;

      setNodes((nds) => {
        // Calculate total descendant count (all hidden nodes)
        const descendantCount = countAllDescendants(nodeId);

        return nds.map((n) => {
          if (n.id === nodeId) {
            const nodeData = n.data as MindmapNodeData;
            return {
              ...n,
              data: {
                ...nodeData,
                hidChildren: !nodeData.hidChildren,
                childCount: descendantCount  // Store total descendant count
              }
            } as AppNode;
          }
          return n;
        });
      });

      // Re-layout after toggling
      setTimeout(autoLayout, 50);
    };

    window.addEventListener(TOGGLE_CHILDREN_EVENT, handleToggleChildren);
    return () => window.removeEventListener(TOGGLE_CHILDREN_EVENT, handleToggleChildren);
  }, [setNodes, edges, autoLayout]);

  // Listen for create child events
  useEffect(() => {
    const handleCreateChild = (e: Event) => {
      const event = e as CustomEvent<{ nodeId: string; branch: 'l' | 'r' | null }>;
      const { nodeId, branch: parentBranch } = event.detail;

      const parentNode = nodes.find(n => n.id === nodeId);
      if (!parentNode) return;

      // Uncollapse parent if collapsed
      if ((parentNode.data as MindmapNodeData).hidChildren) {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? { ...n, data: { ...n.data, hidChildren: false } } as AppNode
              : n
          )
        );
      }

      // Determine branch for new node
      let nodeBranch: 'l' | 'r';
      let sourceHandle: string;
      let targetHandle: string;

      if (nodeId === 'root') {
        // For root node, default to right branch (or use parentBranch if specified)
        nodeBranch = parentBranch || 'r';
      } else {
        // Inherit branch from parent
        nodeBranch = parentBranch || 'r';
      }

      sourceHandle = nodeBranch;
      targetHandle = nodeBranch === 'r' ? 'l' : 'r';

      const newId = uuidv4();
      const newNode: AppNode = {
        id: newId,
        position: { x: 0, y: 0 }, // Will be positioned by autoLayout
        data: {
          label: 'New Topic',
          hidChildren: false,
          branch: nodeBranch
        },
        type: 'mindmap'
      };

      const newEdge: Edge = {
        id: `${nodeId}->${newId}`,
        source: nodeId,
        sourceHandle,
        target: newId,
        targetHandle
      };

      setNodes((nds) => [...nds, newNode]);
      setEdges((eds) => [...eds, newEdge]);

      // Re-layout and then start editing the new node
      setTimeout(() => {
        autoLayout();
        // Select the new node
        setNodes((nds) =>
          nds.map((n) => ({
            ...n,
            selected: n.id === newId
          }))
        );
        // Ensure node is visible, then start editing
        setTimeout(async () => {
          await ensureNodeVisible(newId, { duration: 200 });
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent(START_EDIT_EVENT, {
              detail: { nodeId: newId }
            }));
          }, 50);
        }, 50);
      }, 150);
    };

    window.addEventListener(CREATE_CHILD_EVENT, handleCreateChild);
    return () => window.removeEventListener(CREATE_CHILD_EVENT, handleCreateChild);
  }, [nodes, setNodes, setEdges, autoLayout, ensureNodeVisible]);

  // Listen for create sibling events
  useEffect(() => {
    const handleCreateSibling = (e: Event) => {
      const event = e as CustomEvent<{ nodeId: string; branch: 'l' | 'r' | null }>;
      const { nodeId, branch: currentBranch } = event.detail;

      // Find the parent edge to get the parent node
      const parentEdge = edges.find(edge => edge.target === nodeId);
      if (!parentEdge) return; // Root node has no parent, shouldn't happen

      const parentNodeId = parentEdge.source;
      const currentNode = nodes.find(n => n.id === nodeId);
      if (!currentNode) return;

      // Inherit branch from current node
      const nodeBranch = currentBranch || 'r';
      const sourceHandle = parentEdge.sourceHandle || nodeBranch;
      const targetHandle = parentEdge.targetHandle || (nodeBranch === 'r' ? 'l' : 'r');

      const newId = uuidv4();
      const newNode: AppNode = {
        id: newId,
        position: { x: 0, y: 0 }, // Will be positioned by autoLayout
        data: {
          label: 'New Topic',
          hidChildren: false,
          branch: nodeBranch
        },
        type: 'mindmap'
      };

      const newEdge: Edge = {
        id: `${parentNodeId}->${newId}`,
        source: parentNodeId,
        sourceHandle,
        target: newId,
        targetHandle
      };

      setNodes((nds) => [...nds, newNode]);
      setEdges((eds) => [...eds, newEdge]);

      // Re-layout and then start editing the new node
      setTimeout(() => {
        autoLayout();
        // Select the new node
        setNodes((nds) =>
          nds.map((n) => ({
            ...n,
            selected: n.id === newId
          }))
        );
        // Ensure node is visible, then start editing
        setTimeout(async () => {
          await ensureNodeVisible(newId, { duration: 200 });
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent(START_EDIT_EVENT, {
              detail: { nodeId: newId }
            }));
          }, 50);
        }, 50);
      }, 150);
    };

    window.addEventListener(CREATE_SIBLING_EVENT, handleCreateSibling);
    return () => window.removeEventListener(CREATE_SIBLING_EVENT, handleCreateSibling);
  }, [nodes, edges, setNodes, setEdges, autoLayout, ensureNodeVisible]);

  // Handle new connections
  const onConnect: OnConnect = useCallback(
    (connection) => {
      setEdges((eds) => addEdge(connection, eds));
      // Re-layout after connection
      setTimeout(autoLayout, 150);
    },
    [setEdges, autoLayout]
  );

  // Handle drag connection end (create new node)
  const onConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      console.log('onConnectEnd called', connectionState);
      console.log('fromNode id:', connectionState.fromNode?.id);
      console.log('available nodes:', nodes.map(n => n.id));

      // Only create new node if not connected to existing node
      if (!connectionState.isValid) {
        const sourceNode = nodes.find(n => n.id === connectionState.fromNode?.id);
        console.log('sourceNode found:', sourceNode);
        if (!sourceNode) return;

        // Get event position
        const { clientX, clientY } =
          'changedTouches' in event ? event.changedTouches[0] : event;

        // Convert screen position to flow position
        const position = reactFlowInstance.screenToFlowPosition({
          x: clientX,
          y: clientY
        });

        // Check if drag distance is sufficient
        const parentNodeSize = calculateNodeSize(sourceNode);
        const sourceHandlePositionL = {
          x: sourceNode.position.x,
          y: sourceNode.position.y + parentNodeSize.height / 2
        };
        const sourceHandlePositionR = {
          x: sourceNode.position.x + parentNodeSize.width,
          y: sourceNode.position.y + parentNodeSize.height / 2
        };
        const distanceL = Math.sqrt(
          Math.pow(position.x - sourceHandlePositionL.x, 2) +
          Math.pow(position.y - sourceHandlePositionL.y, 2)
        );
        const distanceR = Math.sqrt(
          Math.pow(position.x - sourceHandlePositionR.x, 2) +
          Math.pow(position.y - sourceHandlePositionR.y, 2)
        );

        console.log('distances:', { distanceL, distanceR, position });

        // Minimum drag distance to create new node
        const minDragDistance = 20;
        if (distanceL > minDragDistance || distanceR > minDragDistance) {
          console.log('Creating new node!');
          // Create new node
          const newId = uuidv4();

          // Determine source and target handles based on branch
          let sourceHandle: string | undefined;
          let targetHandle: string | undefined;
          let nodeBranch: 'l' | 'r' | undefined;

          if (sourceNode.id === 'root') {
            // For root node, determine branch by position
            nodeBranch = position.x > sourceNode.position.x ? 'r' : 'l';
            sourceHandle = nodeBranch;
            targetHandle = nodeBranch === 'r' ? 'l' : 'r';
          } else {
            // For non-root nodes, inherit branch from parent's edge or data
            const sourceNodeData = sourceNode.data as { branch?: 'l' | 'r' };
            if (sourceNodeData.branch) {
              nodeBranch = sourceNodeData.branch;
              sourceHandle = nodeBranch;
              targetHandle = nodeBranch === 'r' ? 'l' : 'r';
            } else {
              const parentEdge = edges.find(e => e.target === sourceNode.id);
              if (parentEdge?.sourceHandle) {
                nodeBranch = parentEdge.sourceHandle as 'l' | 'r';
                sourceHandle = parentEdge.sourceHandle;
                targetHandle = parentEdge.sourceHandle === 'r' ? 'l' : 'r';
              }
            }
          }

          const newNode: AppNode = {
            id: newId,
            position,
            data: {
              label: 'New Topic',
              hidChildren: false,
              branch: nodeBranch
            },
            type: 'mindmap'
          };

          const newEdge: Edge = {
            id: `${sourceNode.id}->${newId}`,
            source: sourceNode.id,
            sourceHandle,
            target: newId,
            targetHandle
          };

          setNodes((nds) => [...nds, newNode]);
          setEdges((eds) => [...eds, newEdge]);

          // Re-layout after adding new node, then ensure visibility
          setTimeout(() => {
            autoLayout();
            setTimeout(() => {
              ensureNodeVisible(newId, { duration: 200 });
            }, 50);
          }, 150);
        }
        // Note: Toggle children is now handled by click event on handle
      }
    },
    [nodes, reactFlowInstance, setNodes, setEdges, autoLayout, ensureNodeVisible]
  );

  // Handle node deletion
  const onNodesDelete = useCallback(
    (nodesToDelete: AppNode[]) => {
      // Don't allow deleting root node
      const filteredNodes = nodesToDelete.filter(n => n.id !== 'root');
      if (filteredNodes.length > 0) {
        setTimeout(autoLayout, 150);
      }
    },
    [autoLayout]
  );

  // Get visible nodes with draggable property
  const displayNodes = getVisibleNodes().map((node) => ({
    ...node,
    draggable: getNodeDraggable(node.id)
  }));

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={displayNodes}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodesDelete={onNodesDelete}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        edges={getVisibleEdges()}
        edgeTypes={edgeTypes}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        fitView
        style={rfStyle}
        deleteKeyCode={['Delete', 'Backspace']}
      >
        <Background variant={BackgroundVariant.Dots} gap={12} size={0.5} />
        <Controls />
        <Panel position="top-right">
          <button
            onClick={autoLayout}
            style={{
              padding: '8px 16px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Auto Layout
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
}

export default function App() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
