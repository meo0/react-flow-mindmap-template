import type { Edge, EdgeTypes } from '@xyflow/react';

// Sample initial edges for demonstration
export const initialEdges: Edge[] = [
  // Right side branches
  { id: 'root->topic-1', source: 'root', sourceHandle: 'r', target: 'topic-1' },
  { id: 'root->topic-2', source: 'root', sourceHandle: 'r', target: 'topic-2' },
  // Left side branches
  { id: 'root->topic-3', source: 'root', sourceHandle: 'l', target: 'topic-3' },
  { id: 'root->topic-4', source: 'root', sourceHandle: 'l', target: 'topic-4' },
  // Sub-branches (right)
  { id: 'topic-1->sub-1-1', source: 'topic-1', target: 'sub-1-1' },
  { id: 'topic-1->sub-1-2', source: 'topic-1', target: 'sub-1-2' },
  // Sub-branches (left)
  { id: 'topic-3->sub-3-1', source: 'topic-3', target: 'sub-3-1' },
  { id: 'topic-3->sub-3-2', source: 'topic-3', target: 'sub-3-2' }
];

export const edgeTypes = {
  // Add your custom edge types here if needed
} satisfies EdgeTypes;
