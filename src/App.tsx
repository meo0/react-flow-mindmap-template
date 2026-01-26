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
import { calculateNodeSize } from './lib/layout';
import type { AppNode, MindmapNodeData } from './nodes/types';

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

  // Auto-layout on initial render
  useEffect(() => {
    // Small delay to ensure nodes are measured
    const timer = setTimeout(() => {
      autoLayout();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Handle new connections
  const onConnect: OnConnect = useCallback(
    (connection) => {
      setEdges((eds) => addEdge(connection, eds));
      // Re-layout after connection
      setTimeout(autoLayout, 50);
    },
    [setEdges, autoLayout]
  );

  // Handle drag connection end (create new node)
  const onConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      // Only create new node if not connected to existing node
      if (!connectionState.isValid) {
        const sourceNode = nodes.find(n => n.id === connectionState.fromNode?.id);
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

        if (distanceL > 20 && distanceR > 20) {
          // Create new node
          const newId = uuidv4();

          const newNode: AppNode = {
            id: newId,
            position,
            data: {
              label: 'New Topic',
              hidChildren: false
            },
            type: 'mindmap'
          };

          // Determine source handle based on position
          const isRootNode = sourceNode.id === 'root';
          const sourceHandle = isRootNode
            ? (position.x > sourceNode.position.x ? 'r' : 'l')
            : undefined;

          const newEdge: Edge = {
            id: `${sourceNode.id}->${newId}`,
            source: sourceNode.id,
            sourceHandle,
            target: newId
          };

          setNodes((nds) => [...nds, newNode]);
          setEdges((eds) => [...eds, newEdge]);

          // Re-layout after adding new node
          setTimeout(autoLayout, 50);
        } else {
          // Toggle children visibility if short drag
          setNodes((nds) =>
            nds.map((n) => {
              if (n.id === sourceNode.id) {
                const nodeData = n.data as MindmapNodeData;
                return {
                  ...n,
                  data: { ...nodeData, hidChildren: !nodeData.hidChildren }
                } as AppNode;
              }
              return n;
            })
          );
          setTimeout(autoLayout, 50);
        }
      }
    },
    [nodes, reactFlowInstance, setNodes, setEdges, autoLayout]
  );

  // Handle node deletion
  const onNodesDelete = useCallback(
    (nodesToDelete: AppNode[]) => {
      // Don't allow deleting root node
      const filteredNodes = nodesToDelete.filter(n => n.id !== 'root');
      if (filteredNodes.length > 0) {
        setTimeout(autoLayout, 50);
      }
    },
    [autoLayout]
  );

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={getVisibleNodes()}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodesDelete={onNodesDelete}
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
