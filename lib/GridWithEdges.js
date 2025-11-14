import { Graph } from 'graph-by-ivan-tulaev';

import { Grid } from './Grid.js';
import { Edge } from './Edge.js';

import {
  sortByType,
  sortColsLeftRightRowsBottomTop, sortElementsTopRightBottomLeft,
} from './utils/layoutUtils.js';


/**
 * @typedef {[number, number]} Position
 * numbers must be integer
 */

/**
 * @typedef {{position: Position, vCross: boolean, hCross: boolean}} PathSegment
 */

export class GridWithEdges extends Grid {
  constructor() {
    super();
    this.graph = new Graph();
  }

  /**
   *
   * @param element
   * @param {[number, number]} position - numbers are integer
   */
  add(element, position) {
    super.add(element, position);

    this.graph.addNode(element);
    this._createNewEdgesFor(element);
  }

  removeElement(element) {
    this.graph.deleteNode(element);

    super.removeElement(element);
  }

  move(element, toPosition) {
    const allEls = [ ...this.get(...this.find(element)) ];
    const edges = allEls.reduce((prev, cur) => {
      return [ ...prev, ...this.getAllExistingEdgesFor(cur) ];
    }, []);

    for (const el of allEls) {
      this.removeElement(el);
      this.add(el, toPosition);
    }

    for (const edge of edges) {
      this._addEdgeToGrid(edge);
    }
  }

  /**
   * Проверка существования для НОВЫХ ребер
   * Со старыми только через мапу
   * @param edge
   * @returns {*}
   * @private
   */
  _edgeIsExist(edge) {

    return [ ...this.graph.edges ]
      .some(existingEdge => existingEdge.id === edge.id && existingEdge.source === edge.source && existingEdge.target === edge.target);
  }

  _addEdgeToGrid(edge) {
    if (this._edgeIsExist(edge)) return;
    this.graph.addEdge(edge);
  }

  /**
   *
   * @param element element
   * @private
   */
  _createNewEdgesFor(element) {

    // todo: видимо так для всех надо
    if (element.$type === 'bpmn:DataObjectReference' || element.$type === 'bpmn:DataStoreReference') {
      const edges = [ ...this.baseGraph.edges ]
        .filter(edge => (edge.source === element || edge.target === element) && this.hasElement(edge.source) && this.hasElement(edge.target));
      for (const edge of edges) {
        const { source, target, id } = edge;
        const newEdge = new Edge(source, target, this);
        newEdge.id = id;
        this._addEdgeToGrid(newEdge);
      }
    }

    // todo: временный костыль
    if (element.$type === 'bpmn:BoundaryEvent') {
      this._addEdgeToGrid(new Edge(element, element.attachedToRef, this));
      this._addEdgeToGrid(new Edge(element.attachedToRef, element, this));
    }

    const outgoingFromHost = (element.outgoing || []).filter(edge => this.elements.has(edge.targetRef));
    const incomingFromHost = (element.incoming || []).filter(edge => this.elements.has(edge.sourceRef));

    for (const edge of [ ...outgoingFromHost, ...incomingFromHost ]) {

      // Ребро должно инициализироваться оригинальными сорс и target
      const newEdge = new Edge(edge.sourceRef, edge.targetRef, this);
      newEdge.id = edge.id;
      this._addEdgeToGrid(newEdge);
    }
  }

  /** @typedef {[number, number]} Position*/

  /**
   * @param {Position} position
   * @param {boolean} byVertical
   * @returns {boolean}
   */
  isCrossed(position, byVertical) {

    return [ ...this._allEdges ].some(edge => edge.isIntersect(position, byVertical));
  }

  get _allEdges() {
    return this.graph.edges;
  }

  /**
   * Пока так наличие пересечений определим
   * @param {Edge[]=} edges
   * @returns {boolean}
   */
  hasAnyCross(edges) {
    const executedEdges = edges ? edges : this._allEdges;

    return [ ...executedEdges ].some(edge => edge.crossedElements().length > 0 || edge.crossedElements(true).length > 0);
  }

  /**
   * Уплотняет грид по горизонтали или по вертикали
   * @param {boolean} byVertical
   */
  shakeIt(byVertical) {

    const sortedElements = [ ...this.elements ].sort(byVertical ? sortElementsTopRightBottomLeft(this) : sortColsLeftRightRowsBottomTop (this)).reverse();

    while (sortedElements.length > 0) {

      // работаем по первому элементу
      const element = sortedElements.pop();

      // получаем цепочку противоположную направлению уплотнения
      // удаляем из стека sortedElements все элементы из цепочки
      const chain = this.getChain(element, !byVertical);

      for (const chainElement of chain) {
        const deleteIndex = sortedElements.indexOf(chainElement);
        if (deleteIndex >= 0) {
          sortedElements.splice(deleteIndex, 1);
        }
      }

      // проверяем можно ли двинуть цепочку вверх для уплотнения по вертикали и влево для уплотнения по горизонтали
      // не одна из позиций не должна быть занята или иметь пересечения
      // - цепочка не должна удлиниться
      // todo: пока под вопросом для ребра из boundary не должны закручиваться
      const [ baseRow, baseCol ] = this.find([ ...chain ][0]);

      // двигаться не вариант если цепочка у края грида
      if (byVertical ? baseRow <= 0 : baseCol <= 0) continue;

      for (let index = byVertical ? baseRow - 1 : baseCol - 1 ; index >= 0; index--) {

        // не двигаем если есть пересечения
        // todo: добавить оптимизации
        const allPositionsAreFine = [ ...chain ].every(element => {
          const curPos = this.find(element);

          return curPos && !this.isCrossed(curPos, true) && !this.isCrossed(curPos, false) ;
        });
        if (!allPositionsAreFine) break;

        // проверяем заняты ли новые позиции
        // todo: добавить оптимизации
        const newPositionsAreFine = [ ...chain ].every(element => {
          const curPos = this.find(element);
          const checkedRow = byVertical ? index : curPos[0];
          const checkedCol = byVertical ? curPos[1] : index;
          return !this.get(checkedRow, checkedCol);
        });
        if (!newPositionsAreFine) break;

        // пробно перемещаем все элементы из цепочки на новые места
        // пересечения позже всем скоупом проверим
        for (const chainElement of chain) {
          const chainElementPosition = this.find(chainElement);
          this.move(chainElement, byVertical ? [ index, chainElementPosition[1] ] : [ chainElementPosition[0], index ]);
        }

        // проверяем не образовалось ли новых пересечений пока по старинке
        // и не удлинилась ли цепочка
        // todo: не пробегаться по всему гриду, а работать только по цепочке!!!
        const hasNewCrosses = this.hasAnyCross();
        const newChain = byVertical ? this.getChain(element, false) : this.getChain(element, true);
        if (hasNewCrosses || newChain.size > chain.size) {

          // вертаем все элементы взад
          for (const chainElement of chain) {
            const chainElementPosition = this.find(chainElement);
            this.move(chainElement, byVertical ? [ index + 1 , chainElementPosition[1] ] : [ chainElementPosition[0], index + 1 ]);
          }
          break;
        }
      }

      // после каждого прохода удаляем пустые линии чтобы не ходить по пустым местам
      byVertical ? this.shrinkRows() : this.shrinkCols();
    }
  }

  /**
   * Возвращает горизонтальную или вертикальную последовательность элементов
   * @param {any} element BPMN Element
   * @param {boolean} byVertical
   * @param {Set<any>=}oldChain
   * @returns {Set<any>}
   */
  getChain(element, byVertical, oldChain) {
    const chain = !oldChain ? new Set() : oldChain;
    if (!element) return chain;

    const elementPosition = this.find(element);
    if (!elementPosition) return chain;

    const edges = [];

    // получаем все элементы в позиции
    const elInPos = this.get(elementPosition[0], elementPosition[1]);
    for (const el of elInPos) {
      chain.add(el);

      // todo: возможно стоит добавить другие варианты ребер - в себя
      [ ...this.getAllExistingEdgesFor(el) ]
        .filter(edge => !byVertical ? (edge.direction === 'W_E' || edge.direction === 'E_W') : (edge.direction === 'N_S' || edge.direction === 'S_N'))
        .forEach(edge => edges.push(edge));
    }

    for (const edge of edges) {
      const nextElement = edge.source === element ? edge.target : edge.source;
      if (!chain.has(nextElement)) {
        const nextChain = this.getChain(nextElement, byVertical, chain);
        for (const nextChainEl of nextChain) {
          chain.add(nextChainEl);
        }
      }
    }
    return chain;
  }

  getExistingOutgoingEdgesFor(element) {
    return [ ...this.graph.getOutgoingEdgesFor(element) ];
  }

  getExistingIncomingEdgesFor(element) {
    return [ ...this.graph.getIncomingEdgesFor(element) ];
  }

  getAllExistingEdgesFor(element) {
    const outgoingEdges = this.getExistingOutgoingEdgesFor(element);
    const incomingEdges = this.getExistingIncomingEdgesFor(element);
    return new Set([ ...outgoingEdges, ...incomingEdges ]);
  }

  get existGraph() {

    // todo: пока так
    if (this.isFlipped) throw new Error("Don't use with flipped grid!");
    const graph = new Graph();

    for (const node of this.elements) {
      graph.addNode(node);
    }

    for (const edge of this._allEdges) {
      graph.addEdge(edge);
    }

    return graph;
  }

  _separateGrid() {

    const executedGraph = this.existGraph;

    const separatedGraphs = executedGraph.getSeparatedGraphs();

    // todo: добавить проверку на не пересечение
    const grids = [];

    for (const graph of separatedGraphs) {
      const grid = this._createGridWith(this.rowCount, this.colCount);
      grid.baseGraph = this.baseGraph;

      let minRow = null;
      let maxRow = null;

      // todo: костыль до полного перехода на граф
      // for (const node of graph.nodes) {
      // const execNodes = graph.nodes
      for (const node of sortByType(graph.nodes, 'bpmn:BoundaryEvent').reverse()) {
        const position = this.find(node);
        if (minRow === null || minRow > position[0]) minRow = position[0];
        if (maxRow === null || maxRow < position[0]) maxRow = position[0];
        grid._superAdd(node, position);
        grid.graph.addNode(node);
      }

      // todo: костыль для пролива ребер надо посмотреть почему не создаются - может в ручную делать а не при добавлении вершины
      graph.edges.forEach(edge => {
        grid._addEdgeToGrid(edge);
      });

      grids.push(grid);
    }

    return grids;
  }

  _superAdd(element, position) {
    super.add(element, position);
  }

  _mergeGrids(grids) {
    const newGrid = new GridWithEdges();

    for (const grid of grids) {
      newGrid.baseGraph = grid.baseGraph;
      newGrid._grid = newGrid._grid.concat(grid._grid);
      newGrid._elements = new Set([ ...newGrid._elements, ...grid._elements ]);

      // объединяем графы
      newGrid.graph = Graph.mergeGraphs(new Set([ newGrid.graph, grid.graph ]));
    }

    return newGrid;
  }

  _createGridWith(rowCount, colCount) {
    const crossGrid = new GridWithEdges();
    for (let i = 0 ; i < rowCount; i++) {
      crossGrid._grid.push(Array(colCount));
    }
    return crossGrid;
  }
}
