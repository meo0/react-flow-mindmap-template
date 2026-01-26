import type { Node, BuiltInNode } from '@xyflow/react';

export type MindmapNodeData = {
  label: string;
  hidChildren?: boolean;
};

export type MindmapNode = Node<MindmapNodeData, 'mindmap'>;
export type AppNode = BuiltInNode | MindmapNode;
