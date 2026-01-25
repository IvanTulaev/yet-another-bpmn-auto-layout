import { Graph } from 'graph-by-ivan-tulaev';

import { Grid } from './Grid.js';

import {
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
  constructor(initialGraph) {
    super();

    this.initialGraph = initialGraph;
    this.graph = new Graph();
  }

  getLanes() {
    return [ ...this.elements ].filter(element => element.$type === 'bpmn:Lane');
  }

  /**
   *
   * @param element
   * @param {[number, number]=} position - numbers are integer
   */
  add(element, position) {

    // добавляем lanes
    if (element.$type === 'bpmn:Lane') {
      super.add(element, position);
      return;
    }

    // обычное добавление элементов если lanes нет
    const lanes = this.getLanes();
    if (lanes.length === 0) {
      super.add(element, position);
      this.graph.addNode(element);
      this._createNewEdgesFor(element);
      return;
    }

    // добавляем элементы в lanes
    const lanePosition = this.find(element.laneRef);
    if (!position) {

      // получаем первую пустую строку в пределах lane и помещаем элемент туда
      const firstLaneRow = lanePosition[0];
      const lastLaneRow = lanePosition[0] + lanePosition[3] - 1;
      for (let rowIndex = firstLaneRow; rowIndex <= lastLaneRow; rowIndex++) {
        const elementsInRow = new Set (this.rows[rowIndex]);
        elementsInRow.delete(element.laneRef);
        if (elementsInRow.size === 0) {

          // здесь вставляем и тормозим
          super.add(element, [ rowIndex, 0 ]);
          this.graph.addNode(element);
          this._createNewEdgesFor(element);
          return;
        }
      }

      // если пробежались по всем строкам lane и не нашли пустую, то добавляем новую строку в lane
      this.addRowCol(false, lanePosition[0] + lanePosition[3] - 1);
      super.add(element, [ lanePosition[0] + lanePosition[3], 0 ]);
      lanePosition[3] += 1;
      this.graph.addNode(element);
      this._createNewEdgesFor(element);
      return;
    }

    const rowDif = position[0] + (position[3] || 1) - (lanePosition[0] + (lanePosition[3] || 1));
    if (rowDif > 0) {
      this.addRowCol(false, lanePosition[0] + (lanePosition[3] || 1) - 1, rowDif);
      lanePosition[3] += rowDif;
    }
    super.add(element, position);
    this.graph.addNode(element);
    this._createNewEdgesFor(element);
  }

  removeElement(element) {
    this.graph.deleteNode(element);

    super.removeElement(element);
  }

  /**
   * Проверка существования для НОВЫХ ребер
   * Со старыми только через мапу
   * @param edge
   * @returns {*}
   * @private
   */
  _edgeIsExist(edge) {
    return [ ...this.graph.edges ].includes(edge);
  }

  _addEdgeToGrid(edge) {
    if (!this._edgeIsExist(edge)) this.graph.addEdge(edge);
  }

  /**
   *
   * @param element element
   * @private
   */
  _createNewEdgesFor(element) {

    // todo: переписать под обертку
    const edges = [ ...this.initialGraph.getOutgoingEdgesFor(element), ...this.initialGraph.getIncomingEdgesFor(element) ]
      .filter(edge => this.hasElement(edge.source) && this.hasElement(edge.target));
    for (const edge of edges) {
      this._addEdgeToGrid(edge);
    }
  }

  /** @typedef {[number, number]} Position*/

  /**
   * @param {Position} position
   * @param {boolean=} byVertical
   * @returns {boolean}
   */
  isCrossed(position, byVertical = false) {

    return [ ...this._allEdges ].some(edge => this.isIntersect(edge, position, byVertical));
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

    return [ ...executedEdges ].some(edge => this.getCrossedElementsFor(edge).length > 0 || this.getCrossedElementsFor(edge, true).length > 0);
  }

  /**
   * Уплотняет грид по горизонтали или по вертикали
   * @param {boolean} byVertical
   */
  shakeIt(byVertical) {

    const sortedElements = [ ...this.elements ].filter(item => item.$type !== 'bpmn:Lane').sort(byVertical ? sortElementsTopRightBottomLeft(this) : sortColsLeftRightRowsBottomTop (this)).reverse();

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
        const newChain = this.getChain(element, !byVertical);
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
      this.shrink(byVertical);
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
    const elInPos = [ ...this.get(elementPosition[0], elementPosition[1]) ].filter(item => item.$type !== 'bpmn:Lane');
    for (const el of elInPos) {
      chain.add(el);

      // todo: возможно стоит добавить другие варианты ребер - в себя - убрать undefined
      [ ...this.getAllExistingEdgesFor(el) ]
        .filter(edge => {
          const edgeDirection = this.getEdgeDirection(edge);
          return !byVertical ? (edgeDirection === 'W_E' || edgeDirection === 'E_W') : (edgeDirection === 'N_S' || edgeDirection === 'S_N');
        })
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
    return !this.isFlipped ? [ ...this.graph.getOutgoingEdgesFor(element) ] : [ ...this.graph.getIncomingEdgesFor(element) ];
  }

  getExistingIncomingEdgesFor(element) {
    return !this.isFlipped ? [ ...this.graph.getIncomingEdgesFor(element) ] : [ ...this.graph.getOutgoingEdgesFor(element) ];
  }

  getAllExistingEdgesFor(element) {
    const outgoingEdges = this.getExistingOutgoingEdgesFor(element);
    const incomingEdges = this.getExistingIncomingEdgesFor(element);
    return new Set([ ...outgoingEdges, ...incomingEdges ]);
  }

  _separateGrid() {

    // создаем копию графа
    const executedGraph = Graph.mergeGraphs(new Set([ this.graph ]));

    const separatedGraphs = executedGraph.getSeparatedGraphs();

    // todo: костыль для устранения проблемы после разделения пустого графа
    if (separatedGraphs.length === 0) return [ new GridWithEdges(this.initialGraph) ];

    // todo: добавить проверку на не пересечение
    const grids = [];

    for (const graph of separatedGraphs) {
      const grid = new GridWithEdges(this.initialGraph);

      let minRow = null;
      let maxRow = null;

      for (const node of graph.nodes) {
        const position = [ ...this.find(node) ];
        if (minRow === null || minRow > position[0]) minRow = position[0];
        if (maxRow === null || maxRow < position[0]) maxRow = position[0];
        grid.add(node, position);
      }

      grids.push(grid);
    }

    return grids;
  }

  // todo: сделать нормальное копирование
  _mergeGrids(grids) {
    const newGrid = new GridWithEdges(grids[0].initialGraph);

    grids.forEach(grid => {
      let rowShift = newGrid.rowCount;

      Object.keys(grid.rows).forEach(rowIndex => {
        if (grid.rows[rowIndex].size === 0) {
          newGrid.addRowCol(false, rowShift + Number.parseInt(rowIndex) - 1);
        } else {
          grid.rows[rowIndex].forEach(node => {
            const newPosition = [ ...grid.find(node) ];
            newPosition[0] = newPosition[0] + rowShift;
            newGrid.add(node, newPosition);
          });
        }
      });
    });

    return newGrid;
  }

  getSourcePosition(edge) {
    const source = this.getEdgeSource(edge);
    return this.find(source);
  }

  getTargetPosition(edge) {
    const target = this.getEdgeTarget(edge);
    return this.find(target);
  }

  /**
   * @typedef {('S_N' | 'SW_NE' | 'W_E' | 'NW_SE' | 'N_S' | 'NE_SW' | 'E_W' | 'SE_NW' | 'NO_DIRECTION')} Direction
   * - **S_N** - south to north
   * - **SW_NE** - south-west to north-east
   * - **W_E** - west to east
   * - **NW_SE** - north-west to south-east
   * - **N_S** - north to south
   * - **NE_SW** - north-east to south-west
   * - **E_W** - east to west
   * - **SE_NW** - south-east to north-west
   * - **NO_DIRECTION** - if it's not a vector but a point
   */

  /**
   * @param edge
   * @returns {Direction}
   */
  getEdgeDirection(edge) {
    const sourcePosition = this.getSourcePosition(edge);
    const targetPosition = this.getTargetPosition(edge);

    if (!this.isValidPosition(sourcePosition) || !this.isValidPosition(targetPosition)) throw new Error(`Invalid position of source or target in  ${edge.source.id}-${edge.target.id} flipped:${this.isFlipped}`);

    const [ sourceRow, sourceCol ] = sourcePosition;
    const [ targetRow, targetCol ] = targetPosition;

    const vDifference = sourceRow - targetRow;
    const hDifference = sourceCol - targetCol;

    // self
    if (vDifference === 0 && hDifference === 0) return 'NO_DIRECTION';

    // south to north
    if (vDifference > 0 && hDifference === 0) return 'S_N';

    // south-west to north-east
    if (vDifference > 0 && hDifference < 0) return 'SW_NE';

    // west to east
    if (vDifference === 0 && hDifference < 0) return 'W_E';

    // north-west to south-east
    if (vDifference < 0 && hDifference < 0) return 'NW_SE';

    // north to south
    if (vDifference < 0 && hDifference === 0) return 'N_S';

    // north-east to south-west
    if (sourceRow < targetRow && sourceCol > targetCol) return 'NE_SW';

    // east to west
    if (sourceRow === targetRow && sourceCol > targetCol) return 'E_W';

    // south-east to north-west
    if (sourceRow > targetRow && sourceCol > targetCol) return 'SE_NW';
  }

  /**
   * @param edge
   * @returns {Array<PathSegment>}
   */
  getPathFor(edge) {
    const direction = this.getEdgeDirection(edge);

    if (direction === 'NO_DIRECTION') return this._pathForNoDirection();
    if (direction === 'S_N') return this._pathForSouthToNorth(edge);
    if (direction === 'SW_NE') return this._pathForSouthWestToNorthEast(edge);
    if (direction === 'W_E') return this._pathForWestToEast(edge);
    if (direction === 'NW_SE') return this._pathForNorthWestToSouthEast(edge);
    if (direction === 'N_S') return this._pathForNorthToSouth(edge);
    if (direction === 'NE_SW') return this._pathForNorthEastToSouthWest(edge);
    if (direction === 'E_W') return this._pathForEastToWest(edge);
    if (direction === 'SE_NW') return this._pathForSouthEastToNorthWest(edge);
    return [];
  }

  _pathForNoDirection() {
    return [];
  }

  getEdgeSource(edge) {
    return !this.isFlipped ? edge.source : edge.target;
  }

  getEdgeTarget(edge) {
    return !this.isFlipped ? edge.target : edge.source;
  }

  _pathForSouthToNorth(edge) {
    const pathSegments = [];
    const [ sourceRow, sourceCol ] = this.getSourcePosition(edge);
    const [ targetRow ] = this.getTargetPosition(edge);

    // если sourceIsBoundary, то сразу идем в обход, так же для реверса
    if (this.getEdgeSource(edge).$type === 'bpmn:BoundaryEvent' && edge.id) return pathSegments;

    // TODO: при реверсе флипать сегменты перед отдачей? Need tests!
    // проверяем есть ли элементы между sourcePosition, targetPosition
    // если есть, то ребро пойдет в обход
    // так же оно пойдет в обход если элементы на соседних клетках и есть обратное ребро targetPosition-sourcePosition
    let hasIntermediateElements = this.hasIntermediateElements(this.getSourcePosition(edge), this.getTargetPosition(edge), true);

    // идем между ячейками грида
    if (hasIntermediateElements) return pathSegments;

    // проверяем петлю source -> target -> source
    const targetElementOutgoingEdges = this.getExistingOutgoingEdgesFor(this.getEdgeTarget(edge));
    const targetElementOutgoing = [ ...targetElementOutgoingEdges ].map(edge => this.getEdgeTarget(edge));

    // идем в обход если есть ребро в противоположном направлении
    if (targetElementOutgoing.includes(this.getEdgeSource(edge))) return pathSegments;

    // в остальных случаях идем прямо
    for (let rowIndex = sourceRow - 1; rowIndex > targetRow; rowIndex--) {
      pathSegments.push({ position: [ rowIndex, sourceCol ], vCross: true });
    }

    return pathSegments;
  }

  _pathForSouthWestToNorthEast(edge) {
    const pathSegments = [];
    const [ sourceRow, sourceCol ] = this.getSourcePosition(edge);
    const [ targetRow, targetCol ] = this.getTargetPosition(edge);

    // если sourceIsBoundary, то пропускаем горизонтальную часть
    if (!(this.getEdgeSource(edge).$type === 'bpmn:BoundaryEvent')) {

      // move right then up
      for (let colIndex = sourceCol + 1; colIndex < targetCol; colIndex++) {
        pathSegments.push({ position: [ sourceRow, colIndex ], hCross: true });
      }
    }

    pathSegments.push({ position: [ sourceRow, targetCol ], hCross: true, vCross: true });

    for (let rowIndex = sourceRow - 1; rowIndex > targetRow; rowIndex--) {
      pathSegments.push({ position: [ rowIndex, targetCol ], vCross: true });
    }

    return pathSegments;
  }

  _pathForWestToEast(edge) {
    const pathSegments = [];
    const [ sourceRow, sourceCol ] = this.getSourcePosition(edge);
    const [ , targetCol ] = this.getTargetPosition(edge);

    // всегда идем вперед
    for (let colIndex = sourceCol + 1; colIndex < targetCol; colIndex++) {
      pathSegments.push({ position: [ sourceRow, colIndex ], hCross: true });
    }

    return pathSegments;
  }

  _pathForNorthWestToSouthEast(edge) {
    const pathSegments = [];
    const [ sourceRow, sourceCol ] = this.getSourcePosition(edge);
    const [ targetRow, targetCol ] = this.getTargetPosition(edge);

    // идем сначала вниз, потом вправо так же и для sourceIsBoundary
    for (let rowIndex = sourceRow + 1; rowIndex < targetRow; rowIndex++) {
      pathSegments.push({ position: [ rowIndex, sourceCol ], vCross: true });
    }
    pathSegments.push({ position: [ targetRow, sourceCol ], vCross: true, hCross: true });

    for (let colIndex = sourceCol + 1; colIndex < targetCol; colIndex++) {
      pathSegments.push({ position: [ targetRow, colIndex ], hCross: true });
    }

    return pathSegments;
  }

  _pathForNorthToSouth(edge) {
    const pathSegments = [];
    const [ sourceRow, sourceCol ] = this.getSourcePosition(edge);
    const [ targetRow ] = this.getTargetPosition(edge);

    // всегда идем вниз так же и для sourceIsBoundary
    for (let rowIndex = sourceRow + 1; rowIndex < targetRow; rowIndex++) {
      pathSegments.push({ position: [ rowIndex, sourceCol ], vCross: true });
    }

    return pathSegments;
  }

  _pathForNorthEastToSouthWest(edge) {
    const pathSegments = [];
    const [ sourceRow, sourceCol ] = this.getSourcePosition(edge);
    const [ targetRow, targetCol ] = this.getTargetPosition(edge);

    // идем вниз потом налево так же и для sourceIsBoundary
    for (let rowIndex = sourceRow + 1; rowIndex < targetRow; rowIndex++) {
      pathSegments.push({ position: [ rowIndex, sourceCol ], vCross: true });
    }

    pathSegments.push({ position: [ targetRow, sourceCol ], vCross: true, hCross: true });

    for (let colIndex = sourceCol - 1; colIndex > targetCol; colIndex--) {
      pathSegments.push({ position: [ targetRow, colIndex ], hCross: true });
    }

    return pathSegments;
  }

  _pathForEastToWest(edge) {
    const pathSegments = [];
    const [ sourceRow, sourceCol ] = this.getSourcePosition(edge);
    const [ , targetCol ] = this.getTargetPosition(edge);

    // здесь аналогично движению вверх
    // проверяем есть ли элементы между sourcePosition, targetPosition
    // если есть, то ребро пойдет в обход
    // так же оно пойдет в обход если элементы на соседних клетках и есть обратное ребро targetPosition-sourcePosition
    // идем между ячейками грида
    for (let colIndex = sourceCol - 1; colIndex > targetCol; colIndex--) {
      pathSegments.push({ position: [ sourceRow, colIndex ], hCross: true });
    }

    return pathSegments;
  }

  _pathForSouthEastToNorthWest(edge) {
    const pathSegments = [];
    const [ sourceRow, sourceCol ] = this.getSourcePosition(edge);
    const [ targetRow, targetCol ] = this.getTargetPosition(edge);

    // для sourceIsBoundary пропускаем горизонталь
    if (!(this.getEdgeSource(edge).$type === 'bpmn:BoundaryEvent' && edge.id)) {

      // пробуем новую схему для хост-хост без обхода
      for (let colIndex = sourceCol - 1; colIndex > targetCol; colIndex--) {
        pathSegments.push({ position: [ sourceRow, colIndex ], hCross: true });
      }
    }

    // угловой сегмент
    if (!(this.getEdgeSource(edge).$type === 'bpmn:BoundaryEvent' && edge.id)) {
      pathSegments.push({ position: [ sourceRow, targetCol ], hCross: true, vCross: true });
    } else {
      pathSegments.push({ position: [ sourceRow, targetCol ], vCross: true });
    }

    // идем наверх
    for (let rowIndex = sourceRow - 1; rowIndex > targetRow; rowIndex--) {
      pathSegments.push({ position: [ rowIndex, targetCol ], vCross: true });
    }

    return pathSegments;
  }

  getCrossedElementsFor(edge, byVertical = false) {
    const crossedElements = [];
    for (const segment of this.getPathFor(edge)) {
      const [ row, col ] = segment.position;
      const element = this.get(row, col);
      if (element && ((byVertical && segment.vCross) || (!byVertical && segment.hCross))) crossedElements.push(element);
    }
    return crossedElements;
  }

  isIntersect(edge, position, byVertical) {

    // быстрый расчет по направлениям
    const [ row, col ] = position;
    const [ sourceRow, sourceCol ] = this.getSourcePosition(edge);
    const [ targetRow, targetCol ] = this.getTargetPosition(edge);
    const direction = this.getEdgeDirection(edge);

    if (direction === 'S_N') {
      return byVertical && col === sourceCol && row < sourceRow && row > targetRow;
    }

    if (direction === 'SW_NE') {
      if (byVertical && col === targetCol && row <= sourceRow && row > targetRow) return true;
      return !byVertical && col > sourceCol && col <= targetCol && row === sourceRow;
    }

    if (direction === 'W_E') {
      return !byVertical && col > sourceCol && col < targetCol && row === sourceRow;
    }

    if (direction === 'NW_SE') {
      if (byVertical && col === sourceCol && row > sourceRow && row <= targetRow) return true;
      return !byVertical && col >= sourceCol && col < targetCol && row === targetRow;
    }

    if (direction === 'N_S') {
      return byVertical && col === sourceCol && row > sourceRow && row < targetRow;
    }

    if (direction === 'NE_SW') {
      if (byVertical && col === sourceCol && row > sourceRow && row <= targetRow) return true;
      return !byVertical && col > targetCol && col <= sourceCol && row === targetRow;

    }

    if (direction === 'E_W') {
      return !byVertical && col > targetCol && col < sourceCol && row === sourceRow;
    }

    if (direction === 'SE_NW') {

      // todo: все это надо собрать в одном месте
      // а так же если есть входящие в source с направлением NW_SE
      if (byVertical && col === targetCol && row > targetRow && row <= sourceRow) return true;
      return !byVertical && col >= targetCol &&
          col < sourceCol && row === sourceRow &&
          !this.getExistingIncomingEdgesFor(this.getEdgeSource(edge))
            .some(edge => this.getEdgeDirection(edge) === 'NW_SE' || this.getEdgeDirection(edge) === 'W_E');
    }
  }

  /**
   * Получает ребра идущие назад и вверх
   * @param node
   * @returns {*}
   */
  getBackwardUpOutgoingEdgesFor(node) {
    return this.getExistingOutgoingEdgesFor(node).filter(edge => {
      const direction = this.getEdgeDirection(edge);
      return direction === 'S_N' || direction === 'SE_NW';
    });
  }

  /**
   * Создает копию грида
   * @returns {GridWithEdges}
   */
  getGridCopy() {
    return this._mergeGrids([ this ]);
  }

  /**
   * Удаляет ребро из грида
   * @param edge
   */
  removeEdge(edge) {
    this.graph.deleteEdge(edge);
  }

  getGraphSegmentFrom(node) {

    const segment = new Graph();

    // проходим только вперед
    // GetStartElementFunction<N> = (visited: Set<N>, initialGraph: Graph<N>) => N | undefined
    const getStartElement = (visited, initialGraph) => {
      return !visited.has(node) ? node : undefined;
    };

    // GetNextNodesFunction<N> = (node: N, graph: Graph<N>, visited: Set<N>, executionSequence: Array<N>) => Array<N> | undefined
    const getNextNodes = (node, graph, visited, executionSequence) => {
      const nextEdges = this.getExistingOutgoingEdgesFor(node).filter(edge => {
        const target = this.getEdgeTarget(edge);
        const source = this.getEdgeSource(edge);
        return !visited.has(target) && target !== source;
      });

      segment.addNode(node);
      const nextNodes = nextEdges.map(edge => {
        return this.getEdgeTarget(edge);
      });

      for (const node of nextNodes) {
        segment.addNode(node);
      }

      for (const edge of nextEdges) {
        segment.addEdge(edge);
      }

      return nextNodes;
    };

    this.graph.genericTraversing(getNextNodes, getStartElement);

    return segment;
  }

  getSegmentLeftCoordinates(segment) {

    const leftCoordinates = new Map();

    for (const node of segment.nodes) {
      const [ nodeRow, nodeCol ] = this.find(node);

      if (!leftCoordinates.has(nodeRow)) leftCoordinates.set(nodeRow, nodeCol);

      if (nodeCol < leftCoordinates.get(nodeRow)) leftCoordinates.set(nodeRow, nodeCol);
    }
    return leftCoordinates;
  }
}
