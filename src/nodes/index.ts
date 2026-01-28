import type { NodeTypes } from '@xyflow/react';
import { MindmapNode } from './MindmapNode';
import { AppNode } from './types';

// Sample initial nodes for demonstration
export const initialNodes: AppNode[] = [
  {
    id: 'root',
    type: 'mindmap',
    position: { x: 0, y: 0 },
    data: { label: 'Main Topic', hidChildren: false }
  },
  // Right branch nodes
  {
    id: 'topic-1',
    type: 'mindmap',
    position: { x: 200, y: -50 },
    data: { label: 'Subtopic 1', hidChildren: false, branch: 'r' }
  },
  {
    id: 'topic-2',
    type: 'mindmap',
    position: { x: 200, y: 50 },
    data: { label: 'Subtopic 2', hidChildren: false, branch: 'r' }
  },
  // Left branch nodes
  {
    id: 'topic-3',
    type: 'mindmap',
    position: { x: -200, y: -50 },
    data: { label: 'Subtopic 3', hidChildren: false, branch: 'l' }
  },
  {
    id: 'topic-4',
    type: 'mindmap',
    position: { x: -200, y: 50 },
    data: { label: 'Subtopic 4', hidChildren: false, branch: 'l' }
  },
  // Right branch sub-nodes
  {
    id: 'sub-1-1',
    type: 'mindmap',
    position: { x: 400, y: -80 },
    data: { label: 'Detail 1-1', hidChildren: false, branch: 'r' }
  },
  {
    id: 'sub-1-2',
    type: 'mindmap',
    position: { x: 400, y: -20 },
    data: { label: 'Detail 1-2', hidChildren: false, branch: 'r' }
  },
  // Left branch sub-nodes
  {
    id: 'sub-3-1',
    type: 'mindmap',
    position: { x: -400, y: -80 },
    data: { label: 'Detail 3-1', hidChildren: false, branch: 'l' }
  },
  {
    id: 'sub-3-2',
    type: 'mindmap',
    position: { x: -400, y: -20 },
    data: { label: 'Detail 3-2', hidChildren: false, branch: 'l' }
  }
];

export const nodeTypes = {
  mindmap: MindmapNode
} satisfies NodeTypes;
