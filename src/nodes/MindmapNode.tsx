import React, { useState, useEffect, useRef } from 'react';
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
  const [inputWidth, setInputWidth] = useState(100);
  const { getNodes, getEdges, setNodes } = useReactFlow();

  // Get current node position to determine handle types
  const nodes = getNodes();
  const edges = getEdges();
  const currentNode = nodes.find(n => n.id === id);
  const nodeX = currentNode?.position.x ?? 0;

  // Determine if this is the root node (no incoming edges)
  const hasIncomingEdge = edges.some(e => e.target === id);
  const isRootNode = !hasIncomingEdge;

  // Handle types based on position
  const leftHandleType = isRootNode ? 'source' : (nodeX < 0 ? 'source' : 'target');
  const rightHandleType = isRootNode ? 'source' : (nodeX < 0 ? 'target' : 'source');

  // Calculate hidden children count
  const getHiddenChildrenCount = () => {
    if (!data.hidChildren) return 0;
    return edges.filter(edge => edge.source === id).length;
  };

  // Handle double click to edit
  const handleDoubleClick = () => {
    setIsEditing(true);
  };

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

  const getHandleLabel = (handleType: string) => {
    if (handleType === 'target') return '';
    const hiddenCount = getHiddenChildrenCount();
    return hiddenCount > 0 ? hiddenCount.toString() : '';
  };

  return (
    <div
      className={`mindmap-node ${selected ? 'selected' : ''} ${isRootNode ? 'root-node' : ''}`}
      style={{
        padding: '4px 8px',
        borderRadius: '4px',
        border: `2px solid ${selected ? '#3b82f6' : '#93c5fd'}`,
        background: isRootNode ? '#93c5fd' : '#dbeafe',
        minWidth: '40px',
        textAlign: 'center',
        cursor: 'pointer'
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
        <div
          style={{
            transform: 'translateY(-2px)',
            pointerEvents: 'none',
            fontSize: '0.75rem',
            color: '#4B5563'
          }}
        >
          {getHandleLabel(leftHandleType)}
        </div>
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
              minHeight: '20px'
            }}
          >
            {data.label}
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
        <div
          style={{
            transform: 'translateY(-2px)',
            pointerEvents: 'none',
            fontSize: '0.75rem',
            color: '#4B5563'
          }}
        >
          {getHandleLabel(rightHandleType)}
        </div>
      </Handle>
    </div>
  );
}
