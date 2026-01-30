import BPMNModdle from 'bpmn-moddle';
import { Graph } from 'graph-by-ivan-tulaev';

// todo: настроить сборщик resolve js
import {
  isStartIntermediate,
  setAdditionalPropsToElements, getAllProcesses,
} from './utils/elementUtils.js';

import {
  DEFAULT_CELL_HEIGHT,
  DEFAULT_CELL_WIDTH,
  DEFAULT_POOL_MARGIN,
  PARTICIPANT_LABEL_WIDTH,
  sortByType,
} from './utils/layoutUtils.js';
import { DiFactory } from './di/DiFactory.js';
import { is, getDefaultSize } from './di/DiUtil.js';
import { GridWithEdges } from './GridWithEdges.js';
import { elementExecution } from './newHandlers/outgoingHandler.js';
import createConnection from './newHandlers/createConnection.js';
import createElementDi from './newHandlers/createElementDi.js';
import { Edge } from './Edge.js';
import { NestedSet } from './NestedSet.js';


/**
 * @typedef {Object} BPMNElement
 * @property {boolean} isExpanded - is expanded or collapsed
 * @property {Array<BPMNElement>} attachers - prop for host element
 */


export class Layouter {
  constructor(debuggerCounter) {
    this.moddle = new BPMNModdle();
    this.diFactory = new DiFactory(this.moddle);
    this.maxDebugStep = debuggerCounter;
    this.currentDebugStep = 0;
  }

  async layoutProcess(xml) {
    const moddleObj = await this.moddle.fromXML(xml);

    const { rootElement } = moddleObj;

    // init important properties
    this.diagram = rootElement;

    // todo: убрать лишний параметр
    setAdditionalPropsToElements(moddleObj, this.getLanesNestedSet);

    // init process trees as nested sets
    // add nested set properties to process (left, right, level)
    this.processTrees = this.createNestedSets(moddleObj);

    // create and add grids for each process
    // root processes should be processed last for element expanding
    this.createGridsForProcesses();

    // expand grids
    this.expandProcessesGrids();

    // expand procsses with lanes
    this.expandParticipants();

    // get all process from root
    const rootProcesses = this.getRootProcesses();
    const collaboration = this.getCollaboration();

    if (rootProcesses.length > 0) {
      this.cleanDi();
      this.createRootDi(rootProcesses, collaboration);
      this.drawParticipants();
      this.drawProcesses();
      this.drawCollaborationMessageFlows(collaboration);
    }

    return (await this.moddle.toXML(this.diagram, { format: true })).xml;
  }

  expandParticipants() {
    const processes = this.processTrees.map(graph => [ ...graph.nodes ]).flat();

    for (const process of processes) {
      const lanes = process.grid.getLanes();
      for (const lane of lanes || []) {
        const lanePos = process.grid.find(lane);
        const laneHeight = lanePos[3] || 1;
        process.grid.addRowCol(false, lanePos[0] + laneHeight - 1, 1);
        lanePos[3] = laneHeight + 1;
      }
    }
  }

  createGridsForProcesses() {

    const processes = this.processTrees.map(graph => [ ...graph.nodes ]).flat();
    processes.sort((a, b) => a.level - b.level);

    // create and add grids for each process
    for (const process of processes) {

      const hasLanes = (process.laneSets || [])[0]?.lanes.length > 0;

      // add base grid with collapsed elements
      process.grid = this.createGridLayout(process);

      // separate base grid to independent grids
      // todo: временно костыляем
      const tempGridCollection = hasLanes ? [ process.grid ] : (process.grid._separateGrid() || [ process.grid ]);

      // for each independent grid:
      // - remove empty rows and cols
      // - shake elements by vertical and horizontal
      // todo: временно костыляем
      for (const grid of tempGridCollection) {
        grid.shrink(true);
        grid.shrink(false);

        grid.shakeIt(true);
        grid.shakeIt(false);

      // todo: временно костыляем
      }

      // merge separated grids and set new grid to the process
      // todo: временно костыляем
      if (!hasLanes) {
        process.grid = process.grid._mergeGrids(tempGridCollection);
      }
    }
  }

  expandProcessesGrids() {

    // root processes should be processed last for element expanding
    const processes = this.processTrees.map(graph => [ ...graph.nodes ]).flat();
    processes.sort((a, b) => b.level - a.level);

    for (const process of processes) {

      // separate base grid to independent grids
      // todo: временно костыляем
      const hasLanes = (process.laneSets || [])[0]?.lanes.length > 0;
      const tempGridCollection = hasLanes ? [ process.grid ] : (process.grid._separateGrid() || [ process.grid ]);
      for (const grid of tempGridCollection) {
        grid.shrink(true);
        grid.shrink(false);

        expandGrid(grid, false);
        expandGrid(grid, true);
      }

      // merge separated grids and set new grid to the process
      // todo: временно костыляем
      if (!hasLanes) {
        process.grid = process.grid._mergeGrids(tempGridCollection);
      }
    }
  }

  /**
   * draw participants pools at root
   */
  drawParticipants() {
    const collaboration = this.getCollaboration();

    if (!collaboration || !collaboration[0]) return;
    const participants = collaboration[0].participants;

    const x = 0;
    let y = 0;

    for (const participant of participants) {
      y = this.createParticipantDi(participant, { x, y }) + DEFAULT_POOL_MARGIN;
    }
  }

  /**
   * Draw processes.
   * Root processes should be processed first for element expanding
   */
  drawProcesses() {

    const sortedProcesses = this.processTrees.map(graph => [ ...graph.nodes ]).flat();
    sortedProcesses.sort((a, b) => a.level - b.level);

    for (const process of sortedProcesses) {

      // draw root processes in participants
      const participant = this.getParticipantForProcess(process);

      if (participant) {
        const participantDi = this.getElementDi(participant);
        const diagram = this.getProcDi(participantDi);

        let { x, y } = participantDi.bounds;
        x += DEFAULT_CELL_WIDTH / 2;
        y += DEFAULT_CELL_HEIGHT / 2;
        this.generateDi(process, { x, y }, diagram);
        continue;
      }

      // draw processes in expanded elements
      // todo: сделать понятнее для this.maxDebugStep
      if (process.isExpanded && !this.existingNodes.includes(process)) continue;
      if (process.isExpanded) {
        const baseProcDi = this.getElementDi(process);
        const diagram = this.getProcDi(baseProcDi);
        let { x, y } = baseProcDi.bounds;
        const { width, height } = getDefaultSize(process);
        x += DEFAULT_CELL_WIDTH / 2 - width / 4;
        y += DEFAULT_CELL_HEIGHT - height - height / 4;
        this.generateDi(process, { x, y }, diagram);
        continue;
      }

      // draw other processes
      const diagram = this.diagram.diagrams.find(diagram => diagram.plane.bpmnElement === process);
      this.generateDi(process, { x: 0, y: 0 }, diagram);
    }
  }

  get existingNodes() {
    return this.processTrees.map(graph => [ ...graph.nodes ]).flat().map(item => [ ...item.grid.elements ]).flat();
  }

  drawCollaborationMessageFlows(collaboration) {
    const messageFlows = collaboration[0] ? collaboration[0].messageFlows : null;
    if (messageFlows) {
      for (const message of messageFlows) {
        const { sourceRef, targetRef } = message;

        // todo: debug mode сделать презентабельнее
        const existNodes = this.existingNodes;
        if (!existNodes.includes(sourceRef) || !existNodes.includes(targetRef)) continue;

        const sourceBounds = sourceRef.di.bounds;
        const targetBounds = targetRef.di.bounds;
        const dY = targetBounds.y - sourceBounds.y;
        const waypoints = [
          { x: sourceBounds.x + sourceBounds.width / 2 },
          { x: targetBounds.x + targetBounds.width / 2 }
        ];

        if (dY > 0) {
          waypoints[0].y = sourceBounds.y + sourceBounds.height;
          waypoints[1].y = targetBounds.y;
        } else {
          waypoints[0].y = sourceBounds.y;
          waypoints[1].y = targetBounds.y + targetBounds.height;
        }

        const edge = this.diFactory.createDiEdge(message, waypoints);
        this.diagram.diagrams[0].plane.get('planeElement').push(edge);
      }
    }
  }

  getParticipantForProcess(process) {
    const collaboration = this.getCollaboration();
    if (!collaboration || !collaboration[0]) return;
    const participants = this.getCollaboration()[0].participants;

    if (!participants) return;

    return participants.find(participant => participant.processRef === process);
  }

  getElementDi(element) {
    return this.diagram.diagrams
      .map(diagram => diagram.plane.planeElement).flat()
      .find(item => item.bpmnElement === element);
  }

  getProcDi(element) {
    return this.diagram.diagrams.find(diagram => diagram.plane.planeElement.includes(element));
  }

  // todo: переписать под nested sets
  createNestedSets(bpmnModel) {
    const processGraph = new Graph();
    const allProcesses = getAllProcesses(bpmnModel);

    // add nodes to graph
    for (const process of allProcesses) {
      processGraph.addNode(process);
    }

    // add edges
    for (const process of allProcesses) {
      const children = this.getSubProcesses(process);
      for (const child of children) {
        processGraph.addEdge({ source: process, target: child });
      }
    }

    const separatedGraphs = processGraph.getSeparatedGraphs();

    // set root process to tree
    for (const graph of separatedGraphs) {
      const rootProcesses = graph.nodes.filter(node => graph.getIncomingEdgesFor(node).size === 0);

      // must have 1 root process
      if (rootProcesses.length > 1) throw new Error('Process tree has more than 1 root elements');
      if (rootProcesses.length === 0) throw new Error('Process tree has 0 root elements');

      graph.rootProcess = rootProcesses[0];
    }

    // set nested sets attributes
    for (const graph of separatedGraphs) {

      // callback that get start node from process tree
      // it's root process
      const getStartElement = (visited, initialGraph) => {
        const root = initialGraph.rootProcess;

        root.left = 0;
        root.level = 0;

        return root;
      };

      // callback that get next executed nodes
      // it's first node without left prop if we go from root,
      // or without right prop if we go to root
      const getNextNodes = (node, graph) => {

        const { left, level } = node;

        // get first node without left prop
        const outgoingNode = [ ...graph.getOutgoingEdgesFor(node) ]
          .map(edge => edge.target)
          .find(node => node.left === undefined);

        if (outgoingNode) {
          outgoingNode.level = level + 1;
          outgoingNode.left = left + 1;
          return [ outgoingNode ];
        }

        // if no outgoingNode get max right
        const maxRight = [ ...graph.getOutgoingEdgesFor(node) ]
          .map(edge => edge.target)
          .reduce((prev, cur) => {
            return prev === undefined || cur.right > prev.right ? cur.right : prev;
          } , undefined);

        if (maxRight) {
          node.right = maxRight + 1;
        } else {
          node.right = node.left + 1;
        }

        // get incoming
        const incoming = [ ...graph.getIncomingEdgesFor(node) ]
          .map(edge => edge.source)
          .find(node => node.right === undefined);

        if (incoming) return [ incoming ];
      };
      graph.genericTraversing(getNextNodes, getStartElement);
    }

    return separatedGraphs;
  }

  getSubProcesses(processes) {
    return processes.flowElements ? processes.flowElements.filter(process => process.$type === 'bpmn:SubProcess') : [];
  }

  createRootDi(processes, collaboration) {

    const mainElement = collaboration && collaboration.length > 0 ? collaboration[0] : processes[0];
    this.createProcessDi(mainElement);
  }

  createProcessDi(element) {
    const diFactory = this.diFactory;

    const planeDi = diFactory.createDiPlane({
      id: 'BPMNPlane_' + element.id,
      bpmnElement: element
    });
    const diagramDi = diFactory.createDiDiagram({
      id: 'BPMNDiagram_' + element.id,
      plane: planeDi
    });

    const diagram = this.diagram;

    diagram.diagrams.push(diagramDi);

    return diagramDi;
  }

  /**
   * Create participant diagram
   * @param participant
   * @param {{x: number, y: number}} origin
   * @returns {number} bottom Y coordinate of created shape
   */
  createParticipantDi(participant, origin) {

    // get size of child process element
    const grid = participant.processRef.grid;
    const { colCount, rowCount } = grid;

    const { width: defaultWidth, height: defaultHeight } = getDefaultSize(participant);


    // Result size is children grid size + paddings ( 1/2 of width or height)
    // let width = colCount > 0 ? colCount * DEFAULT_CELL_WIDTH + DEFAULT_CELL_WIDTH : defaultWidth;
    let width = colCount > 0 ? (colCount + 1) * DEFAULT_CELL_WIDTH : defaultWidth;
    let height = defaultHeight;

    const nestedLanes = participant.processRef.lanesNestedSet;
    const maxLevel = nestedLanes.getMaxLevel();

    if (nestedLanes.nestedSet.size > 0) {
      height = rowCount * DEFAULT_CELL_HEIGHT;

      // 1 - лейбл пула
      // maxLevel + 1 level count
      width = width + (maxLevel + 2) * PARTICIPANT_LABEL_WIDTH;
    } else {
      height = rowCount > 0 ? rowCount * DEFAULT_CELL_HEIGHT + DEFAULT_CELL_HEIGHT : defaultHeight;
    }
    const participantDi = this.diFactory.createDiShape(participant, { width, height, ...origin }, { id: participant.id + '_di' });
    const planeDi = this.diagram.diagrams[0].plane.get('planeElement');
    planeDi.push(...[ participantDi ]);

    const poolOrigin = { ...origin };
    nestedLanes.nestedSet.forEach((pos, lane) => {

      const laneX = poolOrigin.x + (pos.level + 1) * PARTICIPANT_LABEL_WIDTH;
      const leaves = nestedLanes.getLeaves(lane);
      if (leaves.length === 0) leaves.push([ lane, pos ]);

      const laneRowPos = leaves.reduce((prev, [ curLeave ]) => {
        const curGridPos = grid.find(curLeave);
        return prev === undefined || curGridPos[0] < prev ? curGridPos[0] : prev;
      }, undefined);

      const laneY = poolOrigin.y + laneRowPos * DEFAULT_CELL_HEIGHT;

      const levelDif = maxLevel - pos.level;
      let laneWidth = (colCount > 0 ? colCount + 1 : 2) * DEFAULT_CELL_WIDTH + (levelDif + 1) * PARTICIPANT_LABEL_WIDTH;

      let laneHeight = leaves.reduce((prev, [ curLeave ]) => {
        const curGridPos = grid.find(curLeave);
        return prev + (curGridPos[3] || 2);
      }, 0) * DEFAULT_CELL_HEIGHT;

      const laneDi = this.diFactory.createDiShape(lane, { width: laneWidth, height:laneHeight, x: laneX, y: laneY }, { id: lane.id + '_di' });
      const planeDi = this.diagram.diagrams[0].plane.get('planeElement');
      planeDi.push(...[ laneDi ]);

    });

    return participantDi.bounds.y + participantDi.bounds.height;
  }

  cleanDi() {
    this.diagram.diagrams = [];
  }

  getLanesNestedSet(process) {

    const getFirstLevel = (process) => {
      return [ ...process.laneSets ? process.laneSets[0].lanes : [] ].reverse();
    };

    const getNext = (item) => {
      return item.childLaneSet?.lanes || [];
    };

    return new NestedSet(process, getFirstLevel, getNext);

  }

  createGridLayout(process) {

    // create graph from elements
    const processGraph = new Graph();
    const grid = new GridWithEdges(processGraph);

    // add lanesNestedSet to process
    process.lanesNestedSet = this.getLanesNestedSet(process);
    const lanes = process.lanesNestedSet.getLeaves().sort((a, b) => a[1].left - b[1].left).map(([ lane ]) => lane);
    for (const lane of lanes) {
      grid.add(lane);
      grid.find(lane)[3] = 1;
    }

    // add nodes
    for (const flowElement of process.flowElements || []) {

      if (!is(flowElement,'bpmn:SequenceFlow') && !is(flowElement,'bpmn:DataObject')) {
        processGraph.addNode(flowElement);
      }
    }

    // add edges
    // todo: переписать компактней
    for (const node of processGraph.nodes) {

      // boundary
      // добавляем два ребра, так как у нас направленный граф
      if (node.$type === 'bpmn:BoundaryEvent') {
        processGraph.addEdge(new Edge(node, node.attachedToRef));
        processGraph.addEdge(new Edge(node.attachedToRef, node));
      }

      // sequenceFlow
      for (const outgoingItem of node.outgoing || []) {
        const newEdge = new Edge(outgoingItem.sourceRef, outgoingItem.targetRef);
        newEdge.id = outgoingItem.id;
        processGraph.addEdge(newEdge);
      }

      // data associations - двигаемся от связанной ноды
      const dataInputAssociations = node.dataInputAssociations;
      for (const association of dataInputAssociations || []) {
        for (const dataSource of association.sourceRef || []) {
          const newEdge = new Edge(dataSource, association.$parent);
          newEdge.id = association.id;
          newEdge.propRef = association.targetRef;
          processGraph.addEdge(newEdge);
        }
      }

      const dataOutputAssociations = node.dataOutputAssociations;
      for (const association of dataOutputAssociations || []) {
        const source = association.$parent;
        const target = association.targetRef;
        const newEdge = new Edge(source, target);
        newEdge.id = association.id;
        processGraph.addEdge(newEdge);
      }
    }

    // export type GetStartElementFunction<N> = (visited: Set<N>, initialGraph: Graph<N>)
    const dfsGetStartElement = (visited, initialGraph) => {
      if (this.maxDebugStep !== undefined && this.maxDebugStep <= this.currentDebugStep) return;

      // get elements in the grid that have incoming that are not in grid
      const targetElementInGridSourceNotExist = [ ...visited ].find(node => {
        const incomingEdges = !grid.isFlipped ? [ ...initialGraph.getIncomingEdgesFor(node) ] : [ ...initialGraph.getOutgoingEdgesFor(node) ];
        return incomingEdges.filter(edge => !visited.has(!grid.isFlipped ? edge.source : edge.target)).length > 0;
      });
      if (targetElementInGridSourceNotExist) {
        grid.flip(false);

        return targetElementInGridSourceNotExist;
      }

      // maybe need boundaryEvents processing here
      const primaryStartElements = initialGraph.nodes.filter(node => {
        const incomingEdges = !grid.isFlipped ? initialGraph.getIncomingEdgesFor(node) : initialGraph.getOutgoingEdgesFor(node);
        return !visited.has(node) && incomingEdges.size === 0 && !isStartIntermediate(node);
      });
      if (primaryStartElements.length > 0) return sortByType(primaryStartElements, 'bpmn:StartEvent')[0];

      const sourceElementInGridTargetNotExist = [ ...visited ].find(node => {

        // todo: добавить сортировку sortElementsTopLeftBottomRight?
        const outgoing = !grid.isFlipped ? [ ...initialGraph.getOutgoingEdgesFor(node) ] : [ ...initialGraph.getIncomingEdgesFor(node) ];
        return outgoing.filter(edge => !visited.has(!grid.isFlipped ? edge.target : edge.source)).length > 0;
      });
      if (sourceElementInGridTargetNotExist) return sourceElementInGridTargetNotExist;

      // All elements without incoming from other elements
      // this case as the very last one
      const otherStartingElement = initialGraph.nodes.find(node => {
        if (visited.has(node)) return false;

        // incoming without Loops
        const incoming = !grid.isFlipped ? [ ...initialGraph.getIncomingEdgesFor(node) ] : [ ...initialGraph.getOutgoingEdgesFor(node) ];
        return incoming.filter(edge => node !== (!grid.isFlipped ? edge.source : edge.target)).length === 0;
      });
      if (otherStartingElement) return otherStartingElement;

      const flippedStartElement = initialGraph.nodes.find(node => {

        if (visited.has(node)) return false;

        let outgoingEdges = (!grid.isFlipped ? [ ...initialGraph.getOutgoingEdgesFor(node) ] : [ ...initialGraph.getIncomingEdgesFor(node) ]).filter(edge => edge.target !== edge.source);

        return outgoingEdges.length === 0;
      });

      if (flippedStartElement) {
        grid.flip(false);
        return flippedStartElement;
      }
      this.currentDebugStep += 1;

      // not traversed elements (restElements)
      return initialGraph.nodes.find(node => !visited.has(node));
    };

    // GetNextNodesFunction<N> = (node: N, graph: Graph<N>, visited: Set<N>) => Array<N> | undefined
    const dfsGetNextNodes = (node, graph, visited, executionSequence) => {
      if (this.maxDebugStep !== undefined && this.maxDebugStep <= this.currentDebugStep) return;

      // основная обработка
      const nextElements = elementExecution(node, grid, executionSequence, visited, graph);

      this.currentDebugStep += 1;
      return nextElements;
    };

    processGraph.genericTraversing(
      dfsGetNextNodes,
      dfsGetStartElement,
    );

    // flip grid on end
    if (grid.isFlipped) {
      grid.flip(false);
    }

    return grid;
  }

  generateDi(process , shift, procDi) {
    const { grid: layoutGrid } = process;

    const diFactory = this.diFactory;

    const prePlaneElement = procDi ? procDi : this.diagram.diagrams[0];

    const planeElement = prePlaneElement.plane.get('planeElement');

    // todo: убрать после нормальной реализации отрисовки
    const flowElsDIs = [];

    const maxLevel = process.lanesNestedSet.getMaxLevel();

    // 1 - лейбл пула
    // maxLevel + 1 level count
    const elXShift = (maxLevel + 2) * PARTICIPANT_LABEL_WIDTH;

    // Step 1: Create DI for all elements
    layoutGrid._elements.forEach((elementPosition, element) => {
      if (element.$type !== 'bpmn:Lane') {
        const curShift = { ...shift };
        if (layoutGrid.getLanes().length > 0) {
          curShift.x += elXShift;
        }
        const dis = createElementDi(element, elementPosition, diFactory, layoutGrid, curShift);
        flowElsDIs.push(...dis);
      }
    });

    // Step 2: Create DI for all connections
    layoutGrid._allEdges.forEach(edge => {
      const curShift = { ...shift };
      if (layoutGrid.getLanes().length > 0) {
        curShift.x += elXShift;
      }
      const connection = createConnection(edge, layoutGrid, diFactory, curShift);
      if (connection) flowElsDIs.push(connection);
    });

    // todo: убрать после нормальной реализации отрисовки
    // Пока сортируем для стабильности результата
    this.sortDIsByDefinitionPosition(flowElsDIs, process).forEach(item => planeElement.push(item));
  }

  sortDIsByDefinitionPosition(DIs, process) {
    return DIs.sort((a, b) => {
      const aIndex = process.flowElements?.findIndex(item => item.id === a.bpmnElement.id);
      const bIndex = process.flowElements?.findIndex(item => item.id === b.bpmnElement.id);
      return aIndex - bIndex;
    });
  }

  getRootProcesses() {
    return this.diagram.get('rootElements').filter(el => el.$type === 'bpmn:Process');
  }

  getCollaboration() {
    return this.diagram.get('rootElements').filter(el => el.$type === 'bpmn:Collaboration');
  }
}

/**
 * Check grid by columns or rows.
 * If it has elements with isExpanded === true,
 * find the maximum size of elements grids and expand the parent grid horizontally or vertically.
 * @param grid
 * @param {boolean=} byVertical
 */
function expandGrid(grid, byVertical) {

  // todo: здесь можно оптимизировать добавив строки и колонки в грид
  const indexesToExpand = new Map();
  grid._elements.forEach((position, element) => {
    if (element.isExpanded) {
      const maxCount = indexesToExpand.get(byVertical ? position[0] : position[1]);
      let curCount = (!byVertical ? element.grid.colCount : element.grid.rowCount) || 1;
      const newCount = curCount + 1;
      byVertical ? position[3] = newCount : position[2] = newCount;
      if (maxCount === undefined || curCount > maxCount) {
        indexesToExpand.set(byVertical ? position[0] : position[1], curCount);
      }
    }
  });

  [ ...indexesToExpand.entries() ].sort(([ aKey ],[ bKey ]) => Number.parseInt(bKey) - Number.parseInt(aKey)).forEach(([ key, value ]) => {

    // расширяем лэйны начиная с последнего
    if (byVertical) {
      const lanes = grid.getLanes();
      for (const lane of lanes) {
        const lanePos = grid.find(lane);
        if (Number.parseInt(key) <= lanePos[0] + lanePos[3] - 1 && Number.parseInt(key) >= lanePos[0]) {
          lanePos[3] += Number.parseInt(value);
        }
      }
    }
    grid.addRowCol(!byVertical, key, value);
  });
}
