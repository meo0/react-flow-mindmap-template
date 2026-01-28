import type { Edge, EdgeTypes } from '@xyflow/react';

// Sample initial edges for demonstration
export const initialEdges: Edge[] = [
  // Right side branches (sourceHandle='r', targetHandle='l')
  { id: 'root->topic-1', source: 'root', sourceHandle: 'r', target: 'topic-1', targetHandle: 'l' },
  { id: 'root->topic-2', source: 'root', sourceHandle: 'r', target: 'topic-2', targetHandle: 'l' },
  // Left side branches (sourceHandle='l', targetHandle='r')
  { id: 'root->topic-3', source: 'root', sourceHandle: 'l', target: 'topic-3', targetHandle: 'r' },
  { id: 'root->topic-4', source: 'root', sourceHandle: 'l', target: 'topic-4', targetHandle: 'r' },
  // Sub-branches (right) - inherit right branch handles
  { id: 'topic-1->sub-1-1', source: 'topic-1', sourceHandle: 'r', target: 'sub-1-1', targetHandle: 'l' },
  { id: 'topic-1->sub-1-2', source: 'topic-1', sourceHandle: 'r', target: 'sub-1-2', targetHandle: 'l' },
  // Sub-branches (left) - inherit left branch handles
  { id: 'topic-3->sub-3-1', source: 'topic-3', sourceHandle: 'l', target: 'sub-3-1', targetHandle: 'r' },
  { id: 'topic-3->sub-3-2', source: 'topic-3', sourceHandle: 'l', target: 'sub-3-2', targetHandle: 'r' }
];

export const edgeTypes = {
  // Add your custom edge types here if needed
} satisfies EdgeTypes;
