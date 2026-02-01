# YABAL - Yet Another BPMN Auto Layout

**Automated, intelligent layout for BPMN diagrams**

Transform your BPMN XML files into beautifully organized diagrams with automatic layout algorithms. Perfect for developers, business analysts, and architects who need clear, readable process visualizations.

[![Live Demo](https://img.shields.io/badge/demo-live-green)](https://ivantulaev.github.io/yet-another-bpmn-auto-layout/)
[![npm version](https://img.shields.io/npm/v/yet-another-bpmn-auto-layout)](https://www.npmjs.com/package/yet-another-bpmn-auto-layout)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

## ✨ Features

### 🏢 **Collaboration Layout**
- Visualize all participants in BPMN collaborations
- Hierarchical lane representation as tree structures

### 🔄 **Smart Sub-Process Handling**
- **Collapsed sub-processes** displayed as nested diagrams
- **Expanded sub-processes** integrated within parent flows
- Context-aware layout based on sub-process type

### 📊 **Process Organization**
- Independent process graphs arranged on separate grid lines
- Logical grouping of related elements
- Optimized spacing for readability

### 💾 **Data Element Support**
- **DataObjects** and **DataStores** positioned intelligently
- Consistent alignment with flow elements
- Placement within appropriate participant lanes

### 🛠 **Developer Experience**
- **Debug mode** with step-by-step layout visualization
- Browser-based test statistics
- Stable element ordering for predictable results
- Large process graph optimization for human comprehension

## 🚀 Quick Start

### Installation

```bash
npm install yet-another-bpmn-auto-layout
```

### Basic Usage

```javascript
import { layoutProcess } from 'yet-another-bpmn-auto-layout';
import diagramXML from './diagram.bpmn';

// Apply automatic layout to your BPMN diagram
const diagramWithLayoutXML = await layoutProcess(diagramXML);
console.log(diagramWithLayoutXML);
```

## 🖥️ Interactive Demo

### For Business Analysts & Team Members

1. **Clone and run the demo:**
   ```bash
   git clone https://github.com/IvanTulaev/yet-another-bpmn-auto-layout.git
   cd yet-another-bpmn-auto-layout
   npm install
   npm start
   ```

2. **Open your browser** (automatically launches at `http://localhost:8080`)

3. **Use the interface:**
   - **Upload** your BPMN file (left panel, "Open" button)
   - **View** the automatically laid out diagram
   - **Download** the result (right panel, "Download" button)

## 🧪 Testing

### Run Test Suite

```bash
# Run tests and view results in terminal
npm runt test

# Run tests with browser inspection (after run test)
npm run test:inspect

# Update snapshots after verification
npm run test:update-snapshots
```

### Test Specific Features

```bash
# Test grid layout functionality
npm run test ./test/GridSpec.js
```

## 📁 Project Structure

Place test BPMN files in:
```
/test/fixtures/
```

## ⚠️ Current Limitations

The following BPMN elements are not currently auto-laid:
- Text annotations
- Groups

We're actively working to expand element support in future releases.

## 🔗 Resources & Support

- **[Live Demo](https://ivantulaev.github.io/yet-another-bpmn-auto-layout/)** - Try it now
- **[GitHub Issues](https://github.com/IvanTulaev/yet-another-bpmn-auto-layout/issues)** - Report bugs or request features
- **npm Package** - `yet-another-bpmn-auto-layout`

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

**YABAL** - Making BPMN diagrams readable, one layout at a time.