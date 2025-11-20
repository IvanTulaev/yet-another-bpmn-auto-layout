import {
  sortElementsTopLeftBottomRight,
} from '../utils/layoutUtils.js';
import { Graph } from 'graph-by-ivan-tulaev';


export function elementExecution(node, grid, executionSequence, visited, graph) {

  // выворачиваем
  // Верхние левые сдвигаем вперед и проверяем пересечения начиная с левого.
  // В идеале сдвигать только если у сдвигаемого элемента и сорса есть общий предок на его линии, чтобы не получился разрыв!
  // Вопрос по поводу переходов на другие линии выше для сорса...
  // Todo: это условие-костыль убрать его позже (см. добавление в stack)
  if (!node.notMoveForvard) moveTopLeftOutgoingForward(node, grid, executionSequence, graph, visited);
  node.notMoveForvard = false;

  // получаем новые которых нет в гриде
  // todo: перенести код
  const newOutgoing = (!grid.isFlipped ? [ ...grid.initialGraph.getOutgoingEdgesFor(node) ] : [ ...grid.initialGraph.getIncomingEdgesFor(node) ]).filter(edge => !grid.hasElement(!grid.isFlipped ? edge.target : edge.source)).map(edge => !grid.isFlipped ? edge.target : edge.source);

  // получаем вершины из стека с удалением их из грида
  // грохнем для теста так как их уже вытянули вперед
  const outgoingFromStack = getOutgoingFromStack(node, grid, executionSequence, newOutgoing && newOutgoing.length > 0, graph, visited);

  // Handle outgoing paths without boundaryEvents
  // Maybe later it will merge (Добавить сортировку по типу исходящих?)
  // Todo: поменял местами - boost - норм - надо звезды смотреть
  let outgoing = [ ...newOutgoing, ...outgoingFromStack ];

  let nextElements = [];

  outgoing.forEach(nextElement => {

    // подготавливаем место
    const nextPosition = getInsertPosition (node, grid, nextElement);

    // вставляем элемент
    // todo: костыль вставляем attachedToRef
    if (grid.isFlipped && nextElement.$type === 'bpmn:BoundaryEvent' && nextElement.attachedToRef !== node) {
      const attachedToRef = nextElement.attachedToRef;
      if (!visited.has(attachedToRef)) {
        grid.add(attachedToRef, nextPosition);
        visited.add(attachedToRef);
        fixNewCrosses(attachedToRef, grid, graph, visited, executionSequence, nextElements, true);
        nextElements.unshift(nextElement);
      }
    }
    grid.add(nextElement, nextPosition);
    visited.add(nextElement);

    fixNewCrosses(nextElement, grid, graph, visited, executionSequence, nextElements, true);

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

function moveTopLeftOutgoingForward(node, grid, executionSequence, graph, visited) {

  // получаем ребра ведущие назад из элемента
  const existingEdges = grid.getExistingOutgoingEdgesFor(node);
  if (!existingEdges || existingEdges.length === 0) return;

  const processingElements = existingEdges.filter(edge => {
    const target = !grid.isFlipped ? edge.target : edge.source;
    const source = !grid.isFlipped ? edge.source : edge.target;
    const targetPosition = grid.find(target);
    const sourcePosition = grid.find(source);

    if (source === target) return false; // self loop
    if (targetPosition[0] >= sourcePosition[0]) return false; // ниже или на той же строке, что элемент
    if (targetPosition[1] > sourcePosition[1]) return false; // правее чем элемент
    if (inStackWithoutOutgoing(target, executionSequence, grid)) return false;// не двигаем крайние на ветках

    // todo: отладить
    // - gateway.multiple.bpmn - не двигаем
    // - scenario.issue-32.bpmn - двигаем
    if (isTracingForTopLeftMove(source, target, graph, edge, visited, grid, true)) return false;// не двигаем если таргет трейсится по обратному пути
    return true;
  }).map(item => item.target)
    .sort(sortElementsTopLeftBottomRight(grid));

  if (processingElements.length === 0) return;

  while (processingElements.length > 0) {

    // TODO: подумать над удалением из стека... скорее всего не надо
    const nextElement = processingElements.shift();
    const [ nextElementRow, nextElementCol ] = grid.find(nextElement);

    const elementsToDelete = processingElements.filter(item => {
      const [ itemRow ] = grid.find(item);
      return itemRow === nextElementRow;
    });

    for (const elementToDelete of elementsToDelete) {
      const deleteIndex = elementsToDelete.indexOf(elementToDelete);
      if (deleteIndex < 0) continue;
      processingElements.splice(deleteIndex, 1);
    }

    // сдвигаем строку, а точнее ее и все что выше, чтобы сохранить диагональный рост графа?
    const [ elementRow, elementCol ] = grid.find(node);

    const shiftCount = elementCol - nextElementCol + 1;

    for (let rowIndex = grid.rowCount - 1; rowIndex >= 0; rowIndex--) {
      if (rowIndex >= elementRow) {
        grid.expandRow(rowIndex, elementCol, shiftCount);
        continue;
      }
      grid.expandRow(rowIndex, nextElementCol - 1, shiftCount);
    }

    // устраняем пересечения
    // Проверяем пересечения для всех сдвинутых элементов
    // строки от 0 до nextElementRow включительно
    // колонки от elementCol + 1 включительно до конца строки
    const topLeftPosition = [ 0, elementCol + 1 ];
    const bottomRightPosition = [ grid.rowCount - 1, grid.colCount - 1 ];
    fixCrossesInGridPart (grid, graph, visited, topLeftPosition, bottomRightPosition);
  }
}

function inStackWithoutOutgoing(node, executionSequence, grid) {
  const inStack = executionSequence.includes(node);
  const outgoing = grid.getExistingOutgoingEdgesFor(node);

  return inStack && (!outgoing || outgoing.length === 0);
}

/**
 * Пробуем делать укороченный проход чтобы не грузить проц - посмотрим как будет рисоваться
 * @param {Element} element
 * @param {Element} fromElement
 * @param {boolean} backward
 */

// todo: где еще используется кроме move forward
function isTracingForTopLeftMove(node, to, graph, unwantedEdge, visited, grid, backward) {

  // не двигаем если таргет трейсится по обратному пути
  // получаем существующий граф
  const existGraph = new Graph();
  for (const node of graph.nodes) {
    if (visited.has(node)) existGraph.addNode(node);
  }
  for (const edge of graph.edges) {
    if (visited.has(edge.target) && visited.has(edge.source)) existGraph.addEdge(edge);
  }

  // удаляем ненужное ребро
  existGraph.deleteEdge(unwantedEdge);

  // удаляем все вершины левее to
  for (const node of existGraph.nodes) {
    if (grid.find(node)[1] < grid.find(to)[1]) existGraph.deleteNode(node);
  }

  // todo: отладить scenario.issue-32.bpmn и gateway.multiple.bpmn
  return existGraph.isNodeTraced(node, to, backward); // норм проверить реверс !!!! Вот это правильно, но ломает gateway.multiple.bpmn
}

/**
 * @param grid
 * @param {[number, number]} topLeftPosition
 * @param {[number, number]} bottomRightPosition
 */
function fixCrossesInGridPart(grid, graph, visited, topLeftPosition, bottomRightPosition) {
  if (!grid.isValidPosition(topLeftPosition) || !grid.isValidPosition(bottomRightPosition)) throw new Error('fixCrossesInGridPart: invalid position');

  const [ topLeftRow, topLeftCol ] = topLeftPosition;
  const [ bottomRightRow, bottomRightCol ] = bottomRightPosition;

  for (let rowIndex = topLeftRow; rowIndex <= bottomRightRow; rowIndex++) {
    for (let colIndex = topLeftCol; colIndex <= bottomRightCol; colIndex++) {
      const element = grid.get(rowIndex, colIndex);
      if (!element) continue;
      fixNewCrosses(element, grid, graph, visited);
    }
  }
}


/**
 *  - Выдергивает исходящие элементы из стека обработки
 *  - Так же удаляет их из графа
 *  - Для дальнейшей обработки воспринимаем их как абсолютно новые вершины
 * @param element - элемент для которого ищем исходящие
 * @param grid
 * @param {Array<Element>}stack
 * @returns {any[]} - массив элементов
 */
function getOutgoingFromStack(node, grid, executionSequence, hasNewOutgoings, graph, visited) {

  // получаем все исходящие базового элемента
  // const outgoing = grid.getExistingOutgoingEdgesFor(node);
  const outgoing = grid.getExistingOutgoingEdgesFor(node) ;
  const incoming = grid.getExistingIncomingEdgesFor(node).map(edge => edge.source);

  const [ , elementCol ] = grid.find(node);
  const processingElements = [ ...outgoing ].filter(edge => {

    // оставляем только те, что идут в стек и не имеют исходящих
    const target = !grid.isFlipped ? edge.target : edge.source;
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
  }).map(item => !grid.isFlipped ? item.target : item.source).sort(sortElementsTopLeftBottomRight (grid));

  // Обрабатываем элементы.
  // Удаляем их из стека и из грида
  for (const processingElement of processingElements) {
    executionSequence.splice(executionSequence.indexOf(processingElement), 1);
    visited.delete(processingElement);
    grid.removeElement(processingElement);
  }

  // после удаления из грида удаляем лишние колонки
  grid.shrinkRows();
  grid.shrinkCols();

  // обрабатываем их как новые исходящие
  return processingElements;
}

function getInsertPosition(element, grid, nextEl) {

  const nextOnElement = nextEl.attachedToRef === element;
  if (nextOnElement) return grid.find(element);

  const sourcePosition = grid.find(element);
  if (!sourcePosition) return;

  // по умолчанию располагаем справа от element или по диагонали
  const isBoundarySource = element.$type === 'bpmn:BoundaryEvent' && !grid.isFlipped;
  const position = !isBoundarySource ? [ sourcePosition[0],sourcePosition[1] + 1 ] : [ sourcePosition[0] + 1,sourcePosition[1] + 1 ];

  // ищем первую дырку между ребрами источника
  const elPos = grid.find(element);
  const allItemsInElementPosition = [ ...grid.get(elPos[0], elPos[1]) ];
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


  // todo: убрать на после вставик?
  // обрабатываем занятость и вертикальные пересечения
  if (grid.get(position[0], position[1]) || grid.isCrossed(position, true)) {
    grid.createCol(position[1] - 1);
  }

  if (grid.isCrossed([ position[0], position[1] ])) {

    // todo: возможно стоит посмотреть по направлениям
    grid.createRow(position[0] - 1);
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
function fixNewCrosses(element, grid, graph, visited, stack, nextElements, skipTopLeftOutgoing, forwardOnlyOutgoing) {

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
    if (grid.getEdgeDirection(edge) === 'E_W' && ((!grid.isFlipped ? edge.source : edge.target).$type === 'bpmn:BoundaryEvent' && edge.id)) continue;
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

  const vCrossed = grid.getCrossedElementsFor(edge, true);

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

  const hCrossed = grid.getCrossedElementsFor(edge, false);

  if (hCrossed.length === 0) return;

  if (direction === 'SW_NE') {

    // поднимаем элементы выше пересечения
    const maxDown = getMaxDown(edge, grid);
    const [ baseSourceRow ] = grid.getSourcePosition(edge);

    for (let i = maxDown; i > 0; i--) {
      grid.createRow(baseSourceRow - 1);
    }

    const elements = grid.getElementsInRange({ row: grid.getSourcePosition(edge)[0], col: grid.getSourcePosition(edge)[1] + 1 }, { row: grid.rowCount - 1, col: grid.colCount - 1 });

    for (const element of elements) {
      const [ row, col ] = grid.find([ ...element ][0]);
      for (const innerElement of [ ...element ]) {
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
  const [ row ] = grid.find([ ...elements[0] ][0]);
  grid.createRow(row - 1);
  for (const element of elements) {
    const [ , col ] = grid.find([ ...element ][0]);
    for (const innerElement of [ ...element ]) {
      grid.move(innerElement, [ row , col ]);
    }
  }
}

function moveElementsUnderCrossLine(elements, grid) {

  // пробуем опускать элементы ниже пересечения
  const [ row ] = grid.find([ ...elements[0] ][0]);
  grid.createRow(row);
  for (const element of elements) {
    const [ , col ] = grid.find([ ...element ][0]);
    for (const innerItem of [ ...element ]) {
      grid.move(innerItem, [ row + 1 , col ]);
    }
  }
}

// TODO: проверить
function moveElementsRighterCrossLine(elements, grid) {

  // TODO: костыльчик чтобы запустилось
  const [ , col ] = grid.find([ ...elements[0] ][0]);
  grid.createCol(col);

  for (const element of elements) {
    const [ row ] = grid.find([ ...element ][0]);
    for (const innerItem of [ ...element ]) {
      grid.move(innerItem, [ row, col + 1 ]);
    }
  }
}

/**
 * All crossed on one column
 * @param elements
 * @param grid
 */
function pushVerticalEdgeBy(elements, grid) {
  const [ , col ] = grid.find([ ...elements[0] ][0]);
  grid.createCol(col - 1);

  for (const element of elements) {
    const [ row ] = grid.find([ ...element ][0]);
    for (const innerItem of [ ...element ]) {
      grid.move(innerItem, [ row, col ]);
    }
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
