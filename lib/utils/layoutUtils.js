import { getDefaultSize, is } from '../di/DiUtil.js';

import {
  getAttachedOutgoingElements,
  getIncomingElements as utilsGetIncomingElements,
  getOutgoingElements as utilsGetOutgoingElements,
} from './elementUtils.js';

export const DEFAULT_CELL_WIDTH = 150;
export const DEFAULT_CELL_HEIGHT = 140;
export const DEFAULT_POOL_MARGIN = DEFAULT_CELL_HEIGHT / 2;

export function getOutgoingElements(element, isFlipped) {
  return !isFlipped ? new Set (utilsGetOutgoingElements(element).concat(getAttachedOutgoingElements(element))) : new Set (utilsGetIncomingElements(element));
}

/**
 * Modified Manhattan layout: Uses space between grid columns to route connections
 * if direct connection is not possible.
 * @param edge
 * @param layoutGrid
 * @param shift
 * @returns waypoints
 */
export function connectElements(edge, layoutGrid, shift) {

  const { source, target } = edge;

  // TODO: Use GridController for Drawing
  const sourceDi = source.di;
  const targetDi = target.di;

  const sourceBounds = sourceDi.get('bounds');
  const targetBounds = targetDi.get('bounds');

  const sourceMid = getMid(sourceBounds);
  const targetMid = getMid(targetBounds);

  const [ sourceRow, sourceCol, sourceHeight = 1 ] = layoutGrid.find(source);
  const [ targetRow, targetCol ] = layoutGrid.find(target);

  // todo: убрать dX ???
  const edgeDirection = layoutGrid.getEdgeDirection(edge);
  const dX = targetCol - sourceCol;
  const dY = targetRow - sourceRow;

  const dockingSource = `${(dY > 0 ? 'bottom' : 'top')}-${dX > 0 ? 'right' : 'left'}`;
  const dockingTarget = `${(dY > 0 ? 'top' : 'bottom')}-${dX > 0 ? 'left' : 'right'}`;

  const { x: sourceX, y: sourceY } = coordinatesToPosition(source, layoutGrid, shift);
  const { x: targetX, y: targetY } = coordinatesToPosition(target, layoutGrid, shift);

  const sourceIsBoundary = source.$type === 'bpmn:BoundaryEvent';

  // Source === Target ==> Build loop
  if (edgeDirection === 'NO_DIRECTION') {

    if (sourceIsBoundary) return [
      getDockingPoint(sourceMid, sourceBounds, 'b', dockingSource),
      { x: sourceMid.x, y: !source.attachedToRef.isExpanded ? sourceY + DEFAULT_CELL_HEIGHT : sourceY + (source.attachedToRef.grid.rowCount + 1) * DEFAULT_CELL_HEIGHT },
      { x: targetX, y: !source.attachedToRef.isExpanded ? sourceY + DEFAULT_CELL_HEIGHT : sourceY + (source.attachedToRef.grid.rowCount + 1) * DEFAULT_CELL_HEIGHT },
      { x: sourceX, y: targetMid.y },
      getDockingPoint(targetMid, targetBounds, 'l', dockingTarget)
    ];

    return [
      getDockingPoint(sourceMid, sourceBounds, 'b', dockingSource),
      { x: sourceMid.x, y: sourceY + sourceHeight * DEFAULT_CELL_HEIGHT },
      { x: targetX, y: sourceY + sourceHeight * DEFAULT_CELL_HEIGHT },
      { x: sourceX, y: targetMid.y },
      getDockingPoint(targetMid, targetBounds, 'l', dockingTarget)
    ];
  }

  // 12 часов
  if (edgeDirection === 'S_N') {

    if (sourceIsBoundary) return [
      getDockingPoint(sourceMid, sourceBounds, 'b', dockingSource),
      { x: sourceMid.x, y: !source.attachedToRef.isExpanded ? sourceY + DEFAULT_CELL_HEIGHT : sourceY + (source.attachedToRef.grid.rowCount + 1) * DEFAULT_CELL_HEIGHT },
      { x: sourceX, y: !source.attachedToRef.isExpanded ? sourceY + DEFAULT_CELL_HEIGHT : sourceY + (source.attachedToRef.grid.rowCount + 1) * DEFAULT_CELL_HEIGHT },
      { x: targetX, y: targetMid.y },
      getDockingPoint(targetMid, targetBounds, 'l', dockingTarget)
    ];

    // пока так по колхозному
    const hasReversEdge = [ ...getOutgoingElements(target) ].includes(source);

    if (hasReversEdge) {

      // идем в обход
      return [
        getDockingPoint(sourceMid, sourceBounds, 'l', dockingSource),
        { x: sourceX, y: sourceMid.y },
        { x: targetX, y: targetMid.y },
        getDockingPoint(targetMid, targetBounds, 'l', dockingTarget)
      ];
    } else {
      return [
        getDockingPoint(sourceMid, sourceBounds, 't', dockingSource),
        getDockingPoint(targetMid, targetBounds, 'b', dockingTarget)
      ];
    }
  }

  // 1 час
  if (edgeDirection === 'SW_NE') {
    if (sourceIsBoundary) return [
      getDockingPoint(sourceMid, sourceBounds, 'b', dockingSource),
      { x: sourceMid.x, y: !source.attachedToRef.isExpanded ? sourceY + DEFAULT_CELL_HEIGHT : sourceY + (source.attachedToRef.grid.rowCount + 1) * DEFAULT_CELL_HEIGHT },
      { x: targetMid.x, y: !source.attachedToRef.isExpanded ? sourceY + DEFAULT_CELL_HEIGHT : sourceY + (source.attachedToRef.grid.rowCount + 1) * DEFAULT_CELL_HEIGHT },
      getDockingPoint(targetMid, targetBounds, 'b', dockingTarget)
    ];

    return [
      getDockingPoint(sourceMid, sourceBounds, 'r'),
      { x: targetMid.x, y: sourceMid.y },
      getDockingPoint(targetMid, targetBounds, 'b')
    ];
  }

  // 3
  if (edgeDirection === 'W_E') {

    if (sourceIsBoundary) return [
      getDockingPoint(sourceMid, sourceBounds, 'b', dockingSource),
      { x: sourceMid.x, y: !source.attachedToRef.isExpanded ? sourceY + DEFAULT_CELL_HEIGHT : sourceY + (source.attachedToRef.grid.rowCount + 1) * DEFAULT_CELL_HEIGHT },
      { x: targetMid.x, y: !source.attachedToRef.isExpanded ? sourceY + DEFAULT_CELL_HEIGHT : sourceY + (source.attachedToRef.grid.rowCount + 1) * DEFAULT_CELL_HEIGHT },
      getDockingPoint(targetMid, targetBounds, 'b', dockingTarget)
    ];

    const firstPoint = getDockingPoint(sourceMid, sourceBounds, 'r', dockingSource);
    if (source.isExpanded) {
      firstPoint.y = sourceY + DEFAULT_CELL_HEIGHT / 2;
    }
    const lastPoint = getDockingPoint(targetMid, targetBounds, 'l', dockingTarget);
    if (target.isExpanded) {
      lastPoint.y = targetY + DEFAULT_CELL_HEIGHT / 2;
    }
    return [
      firstPoint,
      lastPoint
    ];
  }

  // 4 час
  if (edgeDirection === 'NW_SE') {
    return [
      getDockingPoint(sourceMid, sourceBounds, 'b'),
      { x: sourceMid.x, y: targetMid.y },
      getDockingPoint(targetMid, targetBounds, 'l')
    ];
  }

  // 6
  if (edgeDirection === 'N_S') {
    if (sourceIsBoundary) {
      const firstPoint = getDockingPoint(sourceMid, sourceBounds, 'b', dockingSource);
      const lastPoint = getDockingPoint(targetMid, targetBounds, 't', dockingTarget);

      if (source.attachedToRef.isExpanded) {
        return [
          firstPoint,
          { x: sourceMid.x, y: !source.attachedToRef.isExpanded ? sourceY + DEFAULT_CELL_HEIGHT : sourceY + (source.attachedToRef.grid.rowCount + 1) * DEFAULT_CELL_HEIGHT },
          { x: targetMid.x, y: !source.attachedToRef.isExpanded ? sourceY + DEFAULT_CELL_HEIGHT : sourceY + (source.attachedToRef.grid.rowCount + 1) * DEFAULT_CELL_HEIGHT },
          lastPoint
        ];
      }

      return [
        firstPoint,
        lastPoint
      ];
    }

    const firstPoint = getDockingPoint(sourceMid, sourceBounds, 'b', dockingSource);
    const lastPoint = getDockingPoint(targetMid, targetBounds, 't', dockingTarget);

    if (source.isExpanded || target.isExpanded) {
      return [
        firstPoint,
        { x: sourceMid.x, y: !source.isExpanded ? sourceY + DEFAULT_CELL_HEIGHT : sourceY + (source.grid.rowCount + 1) * DEFAULT_CELL_HEIGHT },
        { x: targetMid.x, y: !source.isExpanded ? sourceY + DEFAULT_CELL_HEIGHT : sourceY + (source.grid.rowCount + 1) * DEFAULT_CELL_HEIGHT },
        lastPoint
      ];
    }
    return [
      firstPoint,
      lastPoint
    ];
  }

  // 7 часов
  if (edgeDirection === 'NE_SW') {

    if (sourceIsBoundary) return [
      getDockingPoint(sourceMid, sourceBounds, 'b'),
      { x: sourceMid.x, y: targetMid.y },
      getDockingPoint(targetMid, targetBounds, 'r')
    ];

    return [
      getDockingPoint(sourceMid, sourceBounds, 'b'),
      { x: sourceMid.x, y: targetMid.y },
      getDockingPoint(targetMid, targetBounds, 'r')
    ];
  }

  // 9 часов
  if (edgeDirection === 'E_W') {
    const maxExpanded = getMaxExpandedBetween(source, target, layoutGrid);

    // пока так по колхозному
    const hasReversEdge = utilsGetOutgoingElements(target).includes(source);

    // TODO: Remove by new edge drawing logic
    let hasSW_NEOut = layoutGrid ? layoutGrid.getExistingOutgoingEdgesFor(target) : [];
    hasSW_NEOut = hasSW_NEOut.some(item => layoutGrid.getEdgeDirection(item) === 'SW_NE');

    if (sourceIsBoundary || hasReversEdge || hasSW_NEOut) {

      // идем в обход
      return [
        getDockingPoint(sourceMid, sourceBounds, 'b', dockingSource),
        { x: sourceMid.x, y: sourceY + DEFAULT_CELL_HEIGHT + (maxExpanded ? maxExpanded - 1 : 0) * DEFAULT_CELL_HEIGHT },
        { x: targetMid.x, y: sourceY + DEFAULT_CELL_HEIGHT + (maxExpanded ? maxExpanded - 1 : 0) * DEFAULT_CELL_HEIGHT },
        getDockingPoint(targetMid, targetBounds, 'b', dockingTarget)
      ];
    } else {
      const firstPoint = getDockingPoint(sourceMid, sourceBounds, 'l', dockingSource);
      if (source.isExpanded) {
        firstPoint.y = sourceY + DEFAULT_CELL_HEIGHT / 2;
      }
      const lastPoint = getDockingPoint(targetMid, targetBounds, 'r', dockingTarget);
      if (target.isExpanded) {
        lastPoint.y = targetY + DEFAULT_CELL_HEIGHT / 2;
      }
      return [
        firstPoint,
        lastPoint
      ];
    }
  }

  // negative dX indicates connection from future to past
  // 10 часов
  if (edgeDirection === 'SE_NW') {
    if (sourceIsBoundary) return [
      getDockingPoint(sourceMid, sourceBounds, 'b', dockingSource),
      { x: sourceMid.x, y: !source.attachedToRef.isExpanded ? sourceY + DEFAULT_CELL_HEIGHT : sourceY + (source.attachedToRef.grid.rowCount + 1) * DEFAULT_CELL_HEIGHT },
      { x: targetMid.x, y: !source.attachedToRef.isExpanded ? sourceY + DEFAULT_CELL_HEIGHT : sourceY + (source.attachedToRef.grid.rowCount + 1) * DEFAULT_CELL_HEIGHT },
      getDockingPoint(targetMid, targetBounds, 'b', dockingTarget)
    ];

    // колхоз
    const elementsInHorizontal = [];
    for (let col = sourceCol - 1; col >= targetCol; col--) {
      const candidate = layoutGrid ? layoutGrid.get(sourceRow, col) : null;
      if (candidate) elementsInHorizontal.push(candidate);
    }
    if (elementsInHorizontal.length > 0) {

      // идем в обход
      return [
        getDockingPoint(sourceMid, sourceBounds, 'b', dockingSource),
        { x: sourceMid.x, y: !source.isExpanded ? sourceY + DEFAULT_CELL_HEIGHT : sourceY + (source.grid.rowCount + 1) * DEFAULT_CELL_HEIGHT },
        { x: targetMid.x, y: !source.isExpanded ? sourceY + DEFAULT_CELL_HEIGHT : sourceY + (source.grid.rowCount + 1) * DEFAULT_CELL_HEIGHT },
        getDockingPoint(targetMid, targetBounds, 'b', dockingTarget)
      ];
    } else {
      return [
        getDockingPoint(sourceMid, sourceBounds, 'l'),
        { x: targetMid.x, y: sourceMid.y },
        getDockingPoint(targetMid, targetBounds, 'b')
      ];
    }
  }

  // на будущее если не сработает что-то сверху
  const directManhattan = directManhattanConnect(source, target, layoutGrid);

  if (directManhattan) {
    const startPoint = getDockingPoint(sourceMid, sourceBounds, directManhattan[0], dockingSource);
    const endPoint = getDockingPoint(targetMid, targetBounds, directManhattan[1], dockingTarget);

    const midPoint = directManhattan[0] === 'h' ? { x: endPoint.x, y: startPoint.y } : { x: startPoint.x, y: endPoint.y };

    return [
      startPoint,
      midPoint,
      endPoint
    ];
  }
  const yOffset = -Math.sign(dY) * DEFAULT_CELL_HEIGHT / 2;

  return [
    getDockingPoint(sourceMid, sourceBounds, 'r', dockingSource),
    { x: sourceMid.x + DEFAULT_CELL_WIDTH / 2, y: sourceMid.y }, // out right
    { x: sourceMid.x + DEFAULT_CELL_WIDTH / 2, y: targetMid.y + yOffset }, // to target row
    { x: targetMid.x - DEFAULT_CELL_WIDTH / 2, y: targetMid.y + yOffset }, // to target column
    { x: targetMid.x - DEFAULT_CELL_WIDTH / 2, y: targetMid.y }, // to mid
    getDockingPoint(targetMid, targetBounds, 'l', dockingTarget)
  ];
}

export function getMid(bounds) {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2
  };
}

export function getDockingPoint(point, rectangle, dockingDirection = 'r', targetOrientation = 'top-left') {

  // ensure we end up with a specific docking direction
  // based on the targetOrientation, if <h|v> is being passed
  if (dockingDirection === 'h') {
    dockingDirection = /left/.test(targetOrientation) ? 'l' : 'r';
  }

  if (dockingDirection === 'v') {
    dockingDirection = /top/.test(targetOrientation) ? 't' : 'b';
  }

  if (dockingDirection === 't') {
    return { original: point, x: point.x, y: rectangle.y };
  }

  if (dockingDirection === 'r') {
    return { original: point, x: rectangle.x + rectangle.width, y: point.y };
  }

  if (dockingDirection === 'b') {
    return { original: point, x: point.x, y: rectangle.y + rectangle.height };
  }

  if (dockingDirection === 'l') {
    return { original: point, x: rectangle.x, y: point.y };
  }

  throw new Error('unexpected dockingDirection: <' + dockingDirection + '>');
}

// helpers /////
export function coordinatesToPosition(element, grid, shift = { x: 0, y:0 }) {
  const [ row, col ] = grid.find(element);

  return {
    x: col * DEFAULT_CELL_WIDTH + shift.x,
    y: row * DEFAULT_CELL_HEIGHT + shift.y
  };
}

export function getBounds(element, elementPosition, shift, attachedTo) {
  const [ row, col, positionWidth, positionHeight ] = elementPosition;
  const { width: defaultWidth, height: defaultHeight } = getDefaultSize(element);

  let width = ((!positionWidth ? 1 : positionWidth) - 1) * DEFAULT_CELL_WIDTH + defaultWidth;
  let height = ((!positionHeight ? 1 : positionHeight) - 1) * DEFAULT_CELL_HEIGHT + defaultHeight;
  let x = col * DEFAULT_CELL_WIDTH + (DEFAULT_CELL_WIDTH - defaultWidth) / 2 + shift.x;
  let y = row * DEFAULT_CELL_HEIGHT + (DEFAULT_CELL_HEIGHT - defaultHeight) / 2 + shift.y;

  // todo: сделать универсально
  if (element.$type === 'bpmn:Lane') {
    const participantLabelWidth = 30;

    width = (positionWidth || 1) * DEFAULT_CELL_WIDTH + DEFAULT_CELL_WIDTH - participantLabelWidth;
    x = col * DEFAULT_CELL_WIDTH + shift.x - DEFAULT_CELL_WIDTH / 2 + participantLabelWidth;
    y = row * DEFAULT_CELL_HEIGHT + shift.y - DEFAULT_CELL_HEIGHT / 2;
    height = (positionHeight || 1) * DEFAULT_CELL_HEIGHT;
  }

  return {
    width,
    height,
    x,
    y
  };
}

// TODO: for future
// eslint-disable-next-line no-unused-vars
function isDirectPathBlocked(source, target, layoutGrid) {
  const [ sourceRow, sourceCol ] = layoutGrid.find(source);
  const [ targetRow, targetCol ] = layoutGrid.find(target);

  const dX = targetCol - sourceCol;
  const dY = targetRow - sourceRow;

  let totalElements = 0;

  if (dX) {
    totalElements += layoutGrid.getElementsInRange({ row: sourceRow, col: sourceCol }, { row: sourceRow, col: targetCol }).length;
  }

  if (dY) {
    totalElements += layoutGrid.getElementsInRange({ row: sourceRow, col: targetCol }, { row: targetRow, col: targetCol }).length;
  }

  return totalElements > 2;
}

function directManhattanConnect(source, target, layoutGrid) {
  const [ sourceRow, sourceCol ] = layoutGrid.find(source);
  const [ targetRow, targetCol ] = layoutGrid.find(target);

  const dX = targetCol - sourceCol;
  const dY = targetRow - sourceRow;

  // Only directly connect left-to-right flow
  if (!(dX > 0 && dY !== 0)) {
    return;
  }

  // If below, go down then horizontal
  if (dY > 0) {
    let totalElements = 0;
    const bendPoint = { row: targetRow, col: sourceCol };
    totalElements += layoutGrid.getElementsInRange({ row: sourceRow, col: sourceCol }, bendPoint).length;
    totalElements += layoutGrid.getElementsInRange(bendPoint, { row: targetRow, col: targetCol }).length;

    return totalElements > 2 ? false : [ 'v', 'h' ];
  } else {

    // If above, go horizontal than vertical
    let totalElements = 0;
    const bendPoint = { row: sourceRow, col: targetCol };

    totalElements += layoutGrid.getElementsInRange({ row: sourceRow, col: sourceCol }, bendPoint).length;
    totalElements += layoutGrid.getElementsInRange(bendPoint, { row: targetRow, col: targetCol }).length;

    return totalElements > 2 ? false : [ 'h', 'v' ];
  }
}

export function sortElementsTopLeftBottomRight(grid) {
  return function(a, b) {
    const aPos = grid.find(a);
    const bPos = grid.find(b);

    return aPos[0] - bPos[0] || aPos[1] - bPos[1];
  };
}

export function sortElementsTopRightBottomLeft(grid) {
  return function(a, b) {
    const aPos = grid.find(a);
    const bPos = grid.find(b);

    return aPos[0] - bPos[0] || bPos[1] - aPos[1];
  };
}

export function sortColsLeftRightRowsBottomTop(grid) {
  return function(a, b) {
    const aPos = grid.find(a);
    const bPos = grid.find(b);

    return aPos[1] - bPos[1] || bPos[0] - aPos[0];
  };
}

/**
 *
 * @param {*[]} arr array of BPMN elements
 * @param {string|string[]} types array of types
 * @returns {*[]} sorted array of BPMN elements
 */
export function sortByType(arr, types) {
  const typesArray = [ types ].flat();

  let result = [];

  if (typesArray.length > 0) {
    typesArray.forEach((type,index) => {
      const matching = arr.filter(item => is(item, type));
      result = result.concat(matching);
      if (index === typesArray.length - 1 && result.length !== arr.length) {
        for (const item of arr) {
          if (!result.includes(item)) result.push(item);
        }
      }
    });
  } else {
    result = arr;
  }

  return result;
}

function getMaxExpandedBetween(source, target, layoutGrid) {
  const [ sourceRow, sourceCol ] = layoutGrid.find(source);
  const [ , targetCol ] = layoutGrid.find(target);

  const firstCol = sourceCol < targetCol ? sourceCol : targetCol;
  const lastCol = sourceCol < targetCol ? targetCol : sourceCol;

  const elementsInRange = [ ...layoutGrid.rows[sourceRow] ].filter(item => {
    const [ , col ] = layoutGrid.find(item);
    return col >= firstCol && col <= lastCol;
  });

  return elementsInRange.reduce((acc, cur) => {
    const [ , , , height ] = layoutGrid.find(cur);
    return height > acc ? height : acc;
  }, 0);
}
