# React Mindmap Template

A React Flow-based mindmap template with automatic bidirectional layout using d3-flextree.

## Features

- Bidirectional mindmap layout (branches extend left and right from center)
- Auto-layout calculation using d3-flextree
- Drag from handle to create new nodes
- Click handle to toggle children visibility
- Double-click to edit node labels
- Delete nodes with Delete/Backspace key
- Built with React Flow v12

## Quick Start

### Using this template

```bash
# Clone via degit
npx degit meo0/react-mindmap-template my-mindmap
cd my-mindmap
npm install
npm run dev
```

Or click "Use this template" on GitHub to create a new repository.

### Development

```bash
npm install
npm run dev
```

### Build

```bash
npm run build
```

## Project Structure

```
src/
├── App.tsx                     # Main application component
├── main.tsx                    # Entry point
├── index.css                   # Global styles
├── nodes/
│   ├── index.ts               # Node types and initial data
│   ├── types.ts               # TypeScript type definitions
│   └── MindmapNode.tsx        # Custom mindmap node component
├── edges/
│   └── index.ts               # Edge types and initial data
├── hooks/
│   └── useMindmapLayout.ts    # Layout management hook
└── lib/
    └── layout.ts              # d3-flextree layout calculations
```

## Usage

### Basic Usage

The template uses React Flow's built-in state management:

```tsx
import { useNodesState, useEdgesState } from '@xyflow/react';
import { initialNodes, nodeTypes } from './nodes';
import { initialEdges, edgeTypes } from './edges';
import { useMindmapLayout } from './hooks/useMindmapLayout';

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const { autoLayout, getVisibleNodes, getVisibleEdges } = useMindmapLayout(
    nodes,
    edges,
    setNodes,
    { rootNodeId: 'root' }
  );

  return (
    <ReactFlow
      nodes={getVisibleNodes()}
      edges={getVisibleEdges()}
      nodeTypes={nodeTypes}
      // ...
    />
  );
}
```

### Creating Nodes

Drag from a node's handle to empty space to create a new child node. The node will automatically be positioned based on the mindmap layout.

### Toggling Children

Click a node's handle (short drag) to toggle visibility of its children.

### Auto Layout

Click the "Auto Layout" button or call `autoLayout()` to recalculate positions.

## Customization

### Adding Node Properties

Edit `src/nodes/types.ts`:

```typescript
export type MindmapNodeData = {
  label: string;
  hidChildren?: boolean;
  // Add your custom properties
  memo?: string;
  color?: string;
};
```

### Styling Nodes

Edit `src/nodes/MindmapNode.tsx` or `src/index.css` to customize node appearance.

### Layout Configuration

Edit `src/lib/layout.ts` to adjust spacing:

```typescript
const DEFAULT_NODE_WIDTH = 150;
const DEFAULT_NODE_HEIGHT = 40;
const NODE_SPACING_HORIZONTAL = 100;
const NODE_SPACING_VERTICAL = 8;
```

## API Reference

### useMindmapLayout Hook

```typescript
function useMindmapLayout<T extends Node>(
  nodes: T[],
  edges: Edge[],
  setNodes: Dispatch<SetStateAction<T[]>>,
  options?: { rootNodeId?: string }
): {
  autoLayout: () => void;
  getVisibleNodes: () => T[];
  getVisibleEdges: () => Edge[];
}
```

### Layout Functions

- `calculateMindmapLayout(nodes, edges, rootNodeId)` - Calculate bidirectional layout
- `calculateLayout(nodes, edges, rootNodeId)` - Calculate single-direction tree layout
- `getFilteredNodes(nodes, edges)` - Get visible nodes (respects hidChildren)
- `getFilteredEdges(nodes, edges)` - Get visible edges

## Dependencies

- `@xyflow/react` ^12.5.1 - React Flow
- `d3-flextree` ^2.1.2 - Flexible tree layout
- `uuid` ^11.1.0 - UUID generation

## License

MIT

## Credits

Based on [React Flow Vite Template](https://github.com/xyflow/vite-react-flow-template)
