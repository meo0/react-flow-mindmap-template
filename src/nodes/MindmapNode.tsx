import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Handle, NodeProps, Position, useReactFlow } from '@xyflow/react';
import type { MindmapNode as MindmapNodeType } from './types';

interface MindmapNodeProps extends NodeProps<MindmapNodeType> {
  isEditing?: boolean;
  isRootNode?: boolean;
  onLabelChange?: (id: string, label: string) => void;
  onToggleChildren?: (id: string) => void;
  onEditStart?: (id: string) => void;
  onEditEnd?: (id: string) => void;
}

// Custom event for toggling children
const TOGGLE_CHILDREN_EVENT = 'mindmap:toggleChildren';

export function MindmapNode({
  id,
  data,
  selected,
  isConnectable
}: MindmapNodeProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(data.label);
  const spanRef = useRef<HTMLSpanElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const [inputWidth, setInputWidth] = useState(100);
  const { getNodes, getEdges, setNodes } = useReactFlow();

  // Get current nodes and edges to determine handle types
  const nodes = getNodes();
  const edges = getEdges();

  // Find the parent edge (edge where this node is the target)
  const parentEdge = edges.find(e => e.target === id);

  // Determine if this is the root node (no incoming edges)
  const isRootNode = !parentEdge;

  // Determine branch by traversing up to find an edge with explicit handles
  // or by checking node position as fallback
  const determineBranch = (): 'l' | 'r' => {
    let currentNodeId = id;
    let currentEdge = parentEdge;

    // Traverse up the tree to find an edge with explicit handle info
    while (currentEdge) {
      // Check targetHandle first (more reliable after branch switch)
      if (currentEdge.targetHandle === 'r') return 'l'; // targetHandle='r' means left branch
      if (currentEdge.targetHandle === 'l') return 'r'; // targetHandle='l' means right branch
      // Check sourceHandle as fallback
      if (currentEdge.sourceHandle === 'l') return 'l';
      if (currentEdge.sourceHandle === 'r') return 'r';

      // Move up to parent
      currentNodeId = currentEdge.source;
      currentEdge = edges.find(e => e.target === currentNodeId);
    }

    // Fallback: use current node position
    const nodeX = nodes.find(node => node.id === id)?.position.x ?? 0;
    return nodeX < 0 ? 'l' : 'r';
  };

  const branch = isRootNode ? null : determineBranch();
  const isLeftBranch = branch === 'l';

  // Handle types based on branch
  // Left branch: left=source (outgoing to children), right=target (incoming from parent)
  // Right branch: left=target (incoming from parent), right=source (outgoing to children)
  const leftHandleType = isRootNode ? 'source' : (isLeftBranch ? 'source' : 'target');
  const rightHandleType = isRootNode ? 'source' : (isLeftBranch ? 'target' : 'source');

  // Calculate children count from edges (for non-collapsed state)
  const edgeChildCount = edges.filter(edge => edge.source === id).length;

  // Use stored childCount when collapsed, otherwise count from edges
  const childCount = data.hidChildren ? (data.childCount ?? 0) : edgeChildCount;

  // Check if this node has children (use stored count if collapsed)
  const hasChildren = childCount > 0;

  // Handle click on handle to toggle children visibility
  const handleToggleChildren = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (hasChildren) {
      // Dispatch custom event to toggle children
      window.dispatchEvent(new CustomEvent(TOGGLE_CHILDREN_EVENT, {
        detail: { nodeId: id }
      }));
    }
  }, [id, hasChildren]);

  // Handle double click to edit
  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  // Start editing function
  const startEditing = useCallback(() => {
    setIsEditing(true);
  }, []);

  // Handle keyboard shortcuts on node (F2 or Enter to edit)
  const handleNodeKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isEditing) return;
    if (e.key === 'F2' || e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      startEditing();
    }
  }, [isEditing, startEditing]);

  // Focus node when selected (to enable keyboard shortcuts)
  useEffect(() => {
    if (selected && !isEditing && nodeRef.current) {
      nodeRef.current.focus();
    }
  }, [selected, isEditing]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Update input value when data changes
  useEffect(() => {
    setInputValue(data.label);
  }, [data.label]);

  // Calculate input width from span
  useEffect(() => {
    if (spanRef.current && spanRef.current.offsetWidth) {
      setInputWidth(spanRef.current.offsetWidth);
    } else {
      setInputWidth(50);
    }
  }, [inputValue]);

  const handleBlur = () => {
    setIsEditing(false);
    // Update node data with new label
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, label: inputValue } } : n
      )
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
    if (e.key === 'Escape') {
      setInputValue(data.label);
      setIsEditing(false);
    }
  };

  return (
    <div
      ref={nodeRef}
      tabIndex={0}
      onKeyDown={handleNodeKeyDown}
      className={`mindmap-node ${selected ? 'selected' : ''} ${isRootNode ? 'root-node' : ''}`}
      style={{
        padding: '4px 8px',
        borderRadius: '4px',
        border: `2px solid ${selected ? '#3b82f6' : '#93c5fd'}`,
        background: isRootNode ? '#93c5fd' : '#dbeafe',
        minWidth: '40px',
        textAlign: 'center',
        cursor: 'pointer',
        outline: 'none',
        position: 'relative'
      }}
    >
      <Handle
        type={leftHandleType}
        position={Position.Left}
        id="l"
        isConnectable={isConnectable}
        style={{
          width: '16px',
          height: '16px',
          background: '#93c5fd',
          border: leftHandleType === 'target' ? 'none' : '2px solid #93c5fd',
          pointerEvents: leftHandleType === 'target' ? 'none' : 'auto'
        }}
      >
        {leftHandleType === 'source' && (
          <div
            onClick={handleToggleChildren}
            onMouseDown={(e) => e.stopPropagation()}
            className="nodrag nopan"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: hasChildren ? 'pointer' : 'default',
              pointerEvents: hasChildren ? 'auto' : 'none',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              color: data.hidChildren ? '#1e40af' : '#6b7280',
              background: data.hidChildren ? '#bfdbfe' : 'transparent',
              borderRadius: '50%'
            }}
          >
            {data.hidChildren && hasChildren ? childCount : ''}
          </div>
        )}
      </Handle>

      <div>
        {isEditing ? (
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="nodrag"
            style={{
              width: inputWidth + 16,
              background: '#bfdbfe',
              border: 'none',
              borderRadius: '4px',
              padding: '4px',
              textAlign: 'center',
              outline: 'none'
            }}
          />
        ) : (
          <div
            onDoubleClick={handleDoubleClick}
            style={{
              padding: '4px',
              minWidth: '40px',
              minHeight: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
          >
            <span>{data.label}</span>
            {selected && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startEditing();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                className="nodrag"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.6,
                  transition: 'opacity 0.15s'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
                title="編集 (F2 / Enter)"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            )}
          </div>
        )}
        <span
          ref={spanRef}
          style={{
            visibility: 'hidden',
            position: 'absolute',
            whiteSpace: 'pre',
            font: 'inherit',
            padding: 'inherit'
          }}
        >
          {inputValue}
        </span>
      </div>

      <Handle
        type={rightHandleType}
        position={Position.Right}
        id="r"
        isConnectable={isConnectable}
        style={{
          width: '16px',
          height: '16px',
          background: '#93c5fd',
          border: rightHandleType === 'target' ? 'none' : '2px solid #93c5fd',
          pointerEvents: rightHandleType === 'target' ? 'none' : 'auto'
        }}
      >
        {rightHandleType === 'source' && (
          <div
            onClick={handleToggleChildren}
            onMouseDown={(e) => e.stopPropagation()}
            className="nodrag nopan"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: hasChildren ? 'pointer' : 'default',
              pointerEvents: hasChildren ? 'auto' : 'none',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              color: data.hidChildren ? '#1e40af' : '#6b7280',
              background: data.hidChildren ? '#bfdbfe' : 'transparent',
              borderRadius: '50%'
            }}
          >
            {data.hidChildren && hasChildren ? childCount : ''}
          </div>
        )}
      </Handle>
    </div>
  );
}
