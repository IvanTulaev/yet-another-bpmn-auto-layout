import {
  sortElementsTopLeftBottomRight
} from '../utils/layoutUtils.js';

export function elementExecution(node, grid, executionSequence, visited, graph) {
  if (!grid.hasElement(node)) {
    grid.add(node);

    // todo: пока здесь фиксим пересечение нового элемента старыми ребрами
    // актуально для вставки в лейнах, возможно и в обычной вставке востребовано
    if (grid.isCrossed(grid.find(node), true)) {
      pushVerticalEdgeBy([ node ], grid);
    }
  }

  // получаем новые которых нет в гриде
  // todo: перенести код
  const newOutgoing = (!grid.isFlipped ? [ ...grid.initialGraph.getOutgoingEdgesFor(node) ] : [ ...grid.initialGraph.getIncomingEdgesFor(node) ]).filter(edge => !grid.hasElement(!grid.isFlipped ? edge.target : edge.source)).map(edge => !grid.isFlipped ? edge.target : edge.source);

  // получаем вершины из стека с удалением их из грида
  // грохнем для теста так как их уже вытянули вперед
  const outgoingFromStack = getOutgoingFromStack(node, grid, executionSequence, newOutgoing && newOutgoing.length > 0, graph, visited);

  // Handle outgoing paths without boundaryEvents
  // Maybe later it will merge (Добавить сортировку по типу исходящих?)
  let outgoing = [ ...newOutgoing, ...outgoingFromStack ];

  let nextElements = [];

  outgoing.forEach(nextElement => {

    // подготавливаем место
    const nextPosition = [ ...getInsertPosition (node, grid, nextElement) ];

    // вставляем элемент
    // todo: костыль вставляем attachedToRef
    if (grid.isFlipped && nextElement.$type === 'bpmn:BoundaryEvent' && nextElement.attachedToRef !== node) {
      const attachedToRef = nextElement.attachedToRef;
      if (!visited.has(attachedToRef)) {
        grid.add(attachedToRef, nextPosition);
        visited.add(attachedToRef);
        fixNewCrosses(attachedToRef, grid, executionSequence, nextElements, true);
        nextElements.unshift(nextElement);
      }
    }
    grid.add(nextElement, nextPosition);
    visited.add(nextElement);

    fixNewCrosses(nextElement, grid, executionSequence, nextElements, true);

    // выворачиваем
    // Верхние левые сдвигаем вперед и проверяем пересечения начиная с левого.
    moveTopLeftOutgoingForward(nextElement, grid);

    nextElements.unshift(nextElement);
  });

  // TODO: sort by priority
  const nextBoundaries = [];
  const nextOther = [];
  for (const item of nextElements) {
    if (item.$type === 'bpmn:BoundaryEvent') {
      nextBoundaries.push(item);
    } else {
      nextOther.push(item);
    }
  }

  nextBoundaries.sort((a, b) => {
    const aOutCount = a.outgoing ? a.outgoing.length : 0;
    const bOutCount = b.outgoing ? b.outgoing.length : 0;
    return aOutCount - bOutCount;
  });

  nextElements = [ ...nextBoundaries, ...nextOther ];
  return nextElements;
}

function moveTopLeftOutgoingForward(node, grid) {

  // todo: выбрать сегмент по всем идущим назад ребрами
  // двигать весь сегмент
  // нужны тестовые данные для этого кейса
  /*
  Алгоритм без выворачивания следующий.
  Вопрос по элементам ниже пока не двигаем - тоже их удаляем из копии.
  Делаем копию грида.
  Работаем по копии грида.
  Удаляем все элементы левее таргета.
  Удаляем все исходящие ребра из сорса. ---
  Строим сегмент графа из таргета.
  Если сорс в сегменте, то не двигаем.
  Находим крайние левые позиции сегмента.
  Двигаем в базовом гриде сегмент вправо таким образом, чтобы крайний левый элемент оказался правее сорса
   */
  // получаем ребра ведущие назад из элемента
  let existingEdges = grid.getBackwardUpOutgoingEdgesFor(node);

  // todo: пока без сортировки чтобы проверить концепцию сдвига
  while (existingEdges.length > 0) {

    const workingEdge = existingEdges.shift();

    // todo: оптимизировать
    const sourcePos = grid.getSourcePosition(workingEdge);
    const targetPos = grid.getTargetPosition(workingEdge);
    const source = grid.getEdgeSource(workingEdge);
    const target = grid.getEdgeTarget(workingEdge);

    if (targetPos[1] > grid.find(node)[1]) continue;

    const gridCopy = grid.getGridCopy();

    gridCopy.removeEdge(workingEdge);

    // оптимизированный проход без поиска в гриде
    gridCopy._elements.forEach((value, key) => {
      const [ , colIndex ] = value;
      if (colIndex < targetPos[1]) gridCopy.removeElement(key);
    });

    const graphSegment = gridCopy.getGraphSegmentFrom(target);

    if (graphSegment.nodes.includes(source)) continue;

    const segmentCords = Array.from(gridCopy.getSegmentLeftCoordinates(graphSegment));

    const minColPosition = segmentCords.reduce((acc, cur) => {
      return acc === undefined || cur[1] < acc[1] ? cur : acc;
    }, undefined);

    const minRowPosition = segmentCords.reduce((acc, cur) => {
      return acc === undefined || cur[0] < acc[0] ? cur : acc;
    }, undefined);

    const maxRowPosition = segmentCords.reduce((acc, cur) => {
      return acc === undefined || cur[0] > acc[0] ? cur : acc;
    }, undefined);

    const shift = sourcePos[1] - minColPosition[1] + 1;

    const newMap = new Map(segmentCords);

    let previousShiftPos = undefined; // [row, col]

    for (let rowIndex = 0; rowIndex < grid.rowCount; rowIndex++) {

      const getShiftPos = () => {

        // todo: погонять тесты
        // здесь надо смещать все что выше
        if (rowIndex < minRowPosition[0]) {
          previousShiftPos = minRowPosition[0];
          return minRowPosition[1] - 1; // выше сегмента
        }
        if (newMap.has(rowIndex)) {
          previousShiftPos = newMap.get(rowIndex);
          return newMap.get(rowIndex) - 1;
        }

        const nodePosition = grid.find(node) || [];

        // посреди сегмента выше ноды
        if (rowIndex > minRowPosition[0] && rowIndex < maxRowPosition[0] && rowIndex < nodePosition[0]) {
          return previousShiftPos;
        }


        if (rowIndex === nodePosition[0] || rowIndex > minRowPosition[0]) {
          previousShiftPos = nodePosition;

          return nodePosition[1];
        }

        return previousShiftPos;
      };

      const shiftPos = getShiftPos() ;

      grid.expandRow(rowIndex, shiftPos, shift);
    }
  }
}

function inStackWithoutOutgoing(node, executionSequence, grid) {
  const inStack = executionSequence.includes(node);
  const outgoing = grid.getExistingOutgoingEdgesFor(node);

  return inStack && (!outgoing?.length > 0);
}

/**
 * @param grid
 * @param {[number, number]} topLeftPosition
 * @param {[number, number]} bottomRightPosition
 */
// eslint-disable-next-line no-unused-vars
function fixCrossesInGridPart(grid, graph, visited, topLeftPosition, bottomRightPosition) {
  if (!grid.isValidPosition(topLeftPosition) || !grid.isValidPosition(bottomRightPosition)) throw new Error('fixCrossesInGridPart: invalid position');

  const [ topLeftRow, topLeftCol ] = topLeftPosition;
  const [ bottomRightRow, bottomRightCol ] = bottomRightPosition;

  for (let rowIndex = topLeftRow; rowIndex <= bottomRightRow; rowIndex++) {
    for (let colIndex = topLeftCol; colIndex <= bottomRightCol; colIndex++) {
      const element = grid.get(rowIndex, colIndex);
      if (!element) continue;
      fixNewCrosses(element, grid);
    }
  }
}


/**
 *  - Выдергивает исходящие элементы из стека обработки
 *  - Так же удаляет их из графа
 *  - Для дальнейшей обработки воспринимаем их как абсолютно новые вершины
 // * @param element - элемент для которого ищем исходящие
 // * @param grid
 // * @param {Array<Element>}stack
 // * @returns {any[]} - массив элементов
 */
function getOutgoingFromStack(node, grid, executionSequence, hasNewOutgoings, graph, visited) {

  // получаем все исходящие базового элемента
  // const outgoing = grid.getExistingOutgoingEdgesFor(node);
  const outgoing = grid.getExistingOutgoingEdgesFor(node) ;
  const incoming = grid.getExistingIncomingEdgesFor(node).map(edge => grid.getEdgeSource(edge));

  const [ , elementCol ] = grid.find(node);
  const processingElements = [ ...outgoing ].filter(edge => {

    // оставляем только те, что идут в стек и не имеют исходящих
    const target = grid.getEdgeTarget(edge);
    const targetCol = grid.find(target)[1];

    if (!inStackWithoutOutgoing(target, executionSequence, grid)) return false;


    // исключаем если общий родитель, так как уже расставили их правильно
    // пробуем нет входящих кроме element
    // если есть общий родитель и есть новые исходящие то выкидываем
    const targetIncoming = grid.getExistingIncomingEdgesFor(target)
      .map(targetEdge => targetEdge.source);

    const commonParent = targetIncoming.find(targetParent => incoming.includes(targetParent));
    if (commonParent && hasNewOutgoings) return false;

    // пробуем оставлять только те, что слева
    return targetCol <= elementCol;
  }).map(item => grid.getEdgeTarget(item)).sort(sortElementsTopLeftBottomRight (grid));

  // Обрабатываем элементы.
  // Удаляем их из стека и из грида
  for (const processingElement of processingElements) {
    executionSequence.splice(executionSequence.indexOf(processingElement), 1);
    visited.delete(processingElement);
    grid.removeElement(processingElement);
  }

  // после удаления из грида удаляем лишние колонки
  // grid.shrink(true);
  // grid.shrink(false);

  // обрабатываем их как новые исходящие
  return processingElements;
}

function getInsertPosition(element, grid, nextEl) {

  // todo: пока костыль
  if (grid.isFlipped && nextEl.$type === 'bpmn:BoundaryEvent' && grid.hasElement(nextEl.attachedToRef)) return grid.find(nextEl.attachedToRef);

  const nextOnElement = nextEl.attachedToRef === element;
  if (nextOnElement) return grid.find(element);

  const sourcePosition = grid.find(element);
  if (!sourcePosition) throw new Error('No source position');

  // по умолчанию располагаем справа от element
  const position = [ sourcePosition[0], sourcePosition[1] + 1 ];

  // если boundary в одном лэйне, то по диагонали
  const isBoundarySource = element.$type === 'bpmn:BoundaryEvent' && !grid.isFlipped;
  const elementLane = element.laneRef;
  const nextElLane = nextEl.laneRef;
  if (isBoundarySource && elementLane === nextElLane) {
    position[0] += 1;
  }

  if (elementLane !== nextElLane) { // todo: здесь!!!
    const [ elementLaneRow ] = grid.find(elementLane);
    const [ nextElLaneRow, , , nextElLaneHeight ] = grid.find(nextElLane);
    const laneRowPosDif = elementLaneRow - nextElLaneRow;
    if (laneRowPosDif > 0) {
      position[0] = nextElLaneRow + (nextElLaneHeight || 1) - 1;
    } else {
      position[0] = nextElLaneRow;
    }
  }

  // ищем первую дырку между ребрами источника
  const elPos = grid.find(element);
  const allItemsInElementPosition = [ ...grid.get(elPos[0], elPos[1]) ].filter(item => item.$type !== 'bpmn:Lane');
  const elementPositionEdges = [];

  // todo: надо смотреть реверс
  for (const item of allItemsInElementPosition) {
    [ ...grid.getExistingOutgoingEdgesFor(item) ]

      // .filter(edge => edge.target !== edge.source && visited.has(edge.source) && visited.has(edge.target))
      .filter(edge => edge.target !== edge.source)
      .forEach(edge => elementPositionEdges.push(edge));
  }

  // проверяем вертикаль вниз от позиции
  for (let i = position[0]; i <= grid.rowCount; i++) {
    const point = [ i, position[1] ];
    const crossedOrOccupied = elementPositionEdges.some(edge => {
      return (grid.getTargetPosition(edge)[0] === i && grid.getTargetPosition(edge)[1] === position[1]) || grid.isIntersect(edge, point, false) || grid.isIntersect(edge, point, true);
    });

    if (crossedOrOccupied && i === grid.colCount - 1) {
      position[0] = i + 1;
      continue;
    }

    if (crossedOrOccupied) continue;
    position[0] = i;
    break;
  }

  // todo: убрать на после вставки?
  // обрабатываем занятость и вертикальные пересечения
  if (grid.get(position[0], position[1]) || grid.isCrossed(position, true)) {
    grid.addRowCol(true, position[1] - 1);
  }

  if (grid.isCrossed([ position[0], position[1] ])) {

    // todo: возможно стоит посмотреть по направлениям
    grid.addRowCol(false, position[0] - 1);
  }
  return position;
}

// только для тех что впереди
// /**
//  * @param element
//  * @param grid
//  * @param {[Element]=} stack
//  * @param {[Element]=} nextElements
//  * @param {boolean} skipTopLeftOutgoing
//  * @param {boolean} forwardOnlyOutgoing
//  */
function fixNewCrosses(element, grid, stack, nextElements, skipTopLeftOutgoing) {

  // todo: пока здесь фиксим пересечение нового элемента старыми ребрами
  // актуально для вставки в лейнах, возможно и в обычной вставке востребовано
  if (grid.isCrossed(grid.find(element), true)) {
    pushVerticalEdgeBy([ element ], grid);
  }

  // реверс логики переноса вперед для исходящих
  // исправляем пересечения образованные исходящими и входящими ребрами новой вершины
  // получаем исходящие
  const outgoingEdges = [ ...grid.getExistingOutgoingEdgesFor(element) ]
    .sort((a, b) => {
      const [ aRow, aCol ] = grid.getTargetPosition(a);
      const [ bRow, bCol ] = grid.getTargetPosition(b);
      return aRow - bRow || aCol - bCol;
    });
  const incomingEdges = [ ...grid.getExistingIncomingEdgesFor(element) ]
    .sort((a, b) => {
      const [ aRow, aCol ] = grid.getSourcePosition(a);
      const [ bRow, bCol ] = grid.getSourcePosition(b);
      return aRow - bRow || aCol - bCol;
    });

  const edges = [ ...outgoingEdges, ...incomingEdges ]
    .filter(edge => {
      const { target, source } = edge;
      const direction = grid.getEdgeDirection(edge);

      // не обрабатываем следующие случаи
      // если self loop
      if (target === source) return false;

      // если в обработке текущей очереди исходящих
      if (nextElements && nextElements.includes(target)) return false;

      // если таргет в стеке и у него нет существующих исходящих если передали стек
      if (stack) {

        if (inStackWithoutOutgoing(target, stack, grid)) return false;
      }
      if (skipTopLeftOutgoing) {

        // TODO: Пока непонятно надо ли как то обрабатывать стек?
        if (source === element && (direction === 'SE_NW' || direction === 'S_N')) return false;
      }

      return true;
    });

  for (const edge of edges) {

    // исправляем вертикали
    fixNewVerticalCrosses(edge, grid);

    // не исправляем гризонтали если E_W из boundary
    if (grid.getEdgeDirection(edge) === 'E_W' && ((grid.getEdgeSource(edge)).$type === 'bpmn:BoundaryEvent' && edge.id)) continue;
    fixNewHorizontalCrosses(edge, grid);
  }
}

// TODO: Add tests for boundary edges
function fixNewVerticalCrosses(edge, grid) {

  // заготовка по направлениям
  // S_N - нет, так как не предполагается схемой
  // SW_NE
  // W_E - нет вертикали
  // NW_SE
  // N_S
  // NE_SW
  // E_W - нет вертикали
  // SE_NW

  const direction = grid.getEdgeDirection(edge);

  if (direction === 'W_E' || direction === 'E_W') return;

  const vCrossed = grid.getCrossedElementsFor(edge, true).filter(item => item.$type !== 'bpmn:Lane');

  if (vCrossed.length <= 0) return;

  if (direction === 'S_N') {
    moveElementsRighterCrossLine(vCrossed, grid);
    return;
  }

  if (direction === 'SW_NE') {

    // требуется дополнительное условие?
    // пока сдвигаем вертикаль
    pushVerticalEdgeBy(vCrossed, grid);
    return;
  }

  if (direction === 'NW_SE') {
    pushVerticalEdgeBy(vCrossed, grid);
    return;
  }

  if (direction === 'N_S') {
    moveElementsRighterCrossLine(vCrossed, grid);
    return;
  }

  if (direction === 'NE_SW') {
    pushVerticalEdgeBy(vCrossed, grid);
    return;
  }

  if (direction === 'SE_NW') {
    pushVerticalEdgeBy(vCrossed, grid);
    return;
  }
}

// TODO: Add tests for boundary edges
// возможно добавить потом наличие ребер
function fixNewHorizontalCrosses(edge, grid) {

  // заготовка по направлениям
  const direction = grid.getEdgeDirection(edge);

  // по этим направлениям не предполагается горизонтальных пересечений
  if (direction === 'S_N' || direction === 'N_S') return;

  const hCrossed = grid.getCrossedElementsFor(edge, false).filter(item => item.$type !== 'bpmn:Lane');

  if (hCrossed.length === 0) return;

  if (direction === 'SW_NE') {

    // поднимаем элементы выше пересечения
    const maxDown = getMaxDown(edge, grid);
    const [ baseSourceRow ] = grid.getSourcePosition(edge);
    grid.addRowCol(false, baseSourceRow - 1, maxDown);

    const elements = grid.getElementsInRange({ row: grid.getSourcePosition(edge)[0], col: grid.getSourcePosition(edge)[1] + 1 }, { row: grid.rowCount - 1, col: grid.colCount - 1 }).filter(item => item.$type !== 'bpmn:Lane');

    for (const element of elements) {
      const [ row, col ] = grid.find(element);
      for (const innerElement of [ ...grid.get(row, col) ]) {
        grid.move(innerElement, [ row - maxDown, col ]);
      }
    }
    return;
  }

  if (direction === 'W_E') {

    // опускаем элементы
    moveElementsUnderCrossLine(hCrossed, grid);
    return;
  }

  if (direction === 'NW_SE') {
    moveElementsUpperCrossLine(hCrossed, grid);
    return;
  }

  if (direction === 'NE_SW') {
    moveElementsUpperCrossLine(hCrossed, grid);
    return;
  }

  if (direction === 'E_W') {

    // опускаем элементы
    moveElementsUnderCrossLine(hCrossed, grid);
    return;
  }

  if (direction === 'SE_NW') {
    moveElementsUpperCrossLine(hCrossed, grid);
    return;
  }
}

function moveElementsUpperCrossLine(elements, grid) {

  // пробуем поднимать элементы выше пересечения
  const [ row ] = grid.find(elements[0]);
  grid.addRowCol(false, row - 1);
  for (const element of elements) {
    const [ , col ] = grid.find(element);
    grid.move(element, [ row , col ]);
  }
}

function moveElementsUnderCrossLine(elements, grid) {

  // пробуем опускать элементы ниже пересечения
  const [ row ] = grid.find(elements[0]);
  grid.addRowCol(false, row);
  for (const element of elements) {
    const [ , col ] = grid.find(element);
    grid.move(element, [ row + 1 , col ]);
  }
}

// TODO: проверить
function moveElementsRighterCrossLine(elements, grid) {

  // TODO: костыльчик чтобы запустилось
  const [ , col ] = grid.find(elements[0]);
  grid.addRowCol(true, col);

  for (const element of elements) {
    const [ elRow ] = grid.find(element);
    grid.move(element, [ elRow, col + 1 ]);
  }
}

/**
 * All crossed on one column
 * @param elements
 * @param grid
 */
function pushVerticalEdgeBy(elements, grid) {
  const [ , col ] = grid.find(elements[0]);
  grid.addRowCol(true, col - 1);

  for (const element of elements) {
    const [ row ] = grid.find(element);
    grid.move(element, [ row, col ]);
  }
}

// Todo: сделать для всех направлений, а не только для SW_NE и сделать методы в гриде
function getMaxDown(edge, grid) {
  const sourcePosition = grid.getSourcePosition(edge);
  const targetPosition = grid.getTargetPosition(edge);

  let maxDown = sourcePosition[0];

  for (let rowIndex = sourcePosition[0]; rowIndex < grid.rowCount; rowIndex++) {
    if (grid.getElementsInRange({ row: rowIndex, col: sourcePosition[1] + 1 }, { row: rowIndex, col: targetPosition[1] }).length > 0) {
      maxDown++;
    } else {
      break;
    }
  }

  return maxDown - sourcePosition[0];
}
