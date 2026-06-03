# React + TypeScript + Vite
# 🌐 ArchCanvas — Interactive Codebase Map Maker
This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.
**ArchCanvas** is a browser-native visual workspace designed to map folder hierarchies, annotate files, draw module data flows, and generate styled documentation. Instead of maintaining static drawings, ArchCanvas connects directly to your codebase, letting you lay out structure visually and compile a clean `.github/ARCHITECTURE.md` file (complete with interactive Mermaid diagrams) for your repository.
Currently, two official plugins are available:
---
- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)
## ✨ Key Features
## React Compiler
*   🚀 **API GitHub Import**: Paste any public GitHub repository link to fetch its files hierarchy recursively via the GitHub REST API.
*   📁 **Local Folder Access**: Select a folder directly from your local disk using the browser's native **File System Access API** (`showDirectoryPicker`) to map structures instantly.
*   🖱️ **Infinite Zoom & Pan Viewport**: Seamlessly explore large codebases with cursor-centered scroll zooming and mouse drag-panning across an 8000px coordinate grid.
*   🔀 **SVG Bezier Connectors**: Drag-and-drop linking anchors on the edges of folders/files cards to draw glowing vector curves indicating imports, dependencies, or data flows.
*   🏷️ **Architectural Layers**: Group elements into logical tiers (UI Components, Business Logic, API Routers, Database Models, Configuration Helpers) with custom color badges.
*   📝 **GFM & Mermaid Exporter**: Compile custom annotations, component descriptions, and connection states into standardized GitHub-Flavored Markdown.
*   Toggleable Sidebar: Hide the project overview/editor sidebar at the click of a button to maximize drawing space, or click any component node to slide it back open.
The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).
---
## Expanding the ESLint configuration
## 🛠️ Architecture Canvas Structure
If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:
Here is how the **ArchCanvas** codebase is structured and coordinates data flows (generated using the app's own compiler output!):
```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
```mermaid
graph TD
  node_app["📁 App.tsx (State Coordinator)"]
  node_types("📄 types.ts (Models & States)")
  node_toolbar("📄 Toolbar.tsx (Control Bar)")
  node_canvas["📁 CanvasWorkspace.tsx (2D Viewport)"]
  node_card("📄 NodeCard.tsx (Component Cards)")
  node_details["📁 DetailsPanel.tsx (Sidebar Editor)"]
      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,
      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
  node_app --> node_types
  node_app --> node_toolbar
  node_app --> node_canvas
  node_app --> node_details
  node_canvas --> node_card
  node_card --> node_types
  node_details --> node_types
```
You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:
---
```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'
## 💻 Tech Stack & Design
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
*   **Build Engine**: Vite + React 19 + TypeScript
*   **Styling**: Pure CSS with custom variable theme maps (sleek glassmorphic dark mode).
*   **Icons**: Lucide React
*   **Accessibility & SEO**: Clean semantics, proper layout hierarchies, and a single `<h1>` page heading.
*   **Module Syntax**: Strict compliance with TypeScript type-only imports (`import type`).
---
## 🚀 Getting Started
### Prerequisites
Ensure you have [Node.js](https://nodejs.org/) installed on your machine.
### Installation
1. Clone or navigate to the project directory:
   ```bash
   cd architecture-canvas
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Build the application for production:
   ```bash
   npm run build
   ```
---
## 📝 Documenting Your First Codebase
1.  Launch the app and click **Load Local Folder** (on supported browsers like Chrome/Edge) or paste a public GitHub URL in the **Import** input.
2.  Your folders and files will arrange themselves into an initial cascading directory grid.
3.  Hover over any card to reveal its left (input) and right (output) socket anchors.
4.  Drag a line from a card's **Right Anchor** to link it to another card, mapping out import rules or data flows.
5.  Click a card to select it, open the editor panel on the right, assign its **Architectural Layer**, and describe its purpose.
6.  Once you're done, click **Generate Doc File** in the panel to copy a formatted markdown template with directory breakdown, metrics tables, and Mermaid flow diagrams to create your `.github/ARCHITECTURE.md` file!
