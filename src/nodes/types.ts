import type { Node, BuiltInNode } from '@xyflow/react';

export type MindmapNodeData = {
  label: string;
  hidChildren?: boolean;
  childCount?: number;  // Number of direct children (stored when collapsed)
  branch?: 'l' | 'r';   // Which branch the node belongs to (left or right)
};

export type MindmapNode = Node<MindmapNodeData, 'mindmap'>;
export type AppNode = BuiltInNode | MindmapNode;
