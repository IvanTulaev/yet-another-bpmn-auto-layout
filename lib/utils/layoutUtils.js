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

  // todo: убрать dX ???
  const edgeDirection = layoutGrid.getEdgeDirection(edge);
  const dX = target.gridPosition.col - source.gridPosition.col;
  const dY = target.gridPosition.row - source.gridPosition.row;

  const dockingSource = `${(dY > 0 ? 'bottom' : 'top')}-${dX > 0 ? 'right' : 'left'}`;
  const dockingTarget = `${(dY > 0 ? 'top' : 'bottom')}-${dX > 0 ? 'left' : 'right'}`;

  const { x: sourceX, y: sourceY } = coordinatesToPosition(source, shift);
  const { x: targetX } = coordinatesToPosition(target, shift);

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
      { x: sourceMid.x, y: !source.isExpanded ? sourceY + DEFAULT_CELL_HEIGHT : sourceY + (source.grid.rowCount + 1) * DEFAULT_CELL_HEIGHT },
      { x: targetX, y: !source.isExpanded ? sourceY + DEFAULT_CELL_HEIGHT : sourceY + (source.grid.rowCount + 1) * DEFAULT_CELL_HEIGHT },
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
      firstPoint.y = sourceBounds.y + getDefaultSize(source).height / 2;
    }
    const lastPoint = getDockingPoint(targetMid, targetBounds, 'l', dockingTarget);
    if (target.isExpanded) {
      lastPoint.y = targetBounds.y + getDefaultSize(target).height / 2;
    }
    return [
      firstPoint,
      lastPoint
    ];
  }

  // 4 час
  if (edgeDirection === 'NW_SE') {

    if (sourceIsBoundary) return [
      getDockingPoint(sourceMid, sourceBounds, 'b'),
      { x: sourceMid.x, y: targetMid.y },
      getDockingPoint(targetMid, targetBounds, 'l')
    ];

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

    if (sourceIsBoundary) {
      const maxExpanded = getMaxExpandedBetween(source, target, layoutGrid);
      return [
        getDockingPoint(sourceMid, sourceBounds, 'b', dockingSource),
        { x: sourceMid.x, y: !source.attachedToRef.isExpanded ? sourceY + DEFAULT_CELL_HEIGHT + maxExpanded * DEFAULT_CELL_HEIGHT : sourceY + (source.attachedToRef.grid.rowCount + 1) * DEFAULT_CELL_HEIGHT },
        { x: targetMid.x, y: !source.attachedToRef.isExpanded ? sourceY + DEFAULT_CELL_HEIGHT + maxExpanded * DEFAULT_CELL_HEIGHT : sourceY + (source.attachedToRef.grid.rowCount + 1) * DEFAULT_CELL_HEIGHT },
        getDockingPoint(targetMid, targetBounds, 'b', dockingTarget)
      ];
    }

    // пока так по колхозному
    const hasReversEdge = utilsGetOutgoingElements(target).includes(source);

    // TODO: Remove by new edge drawing logic
    let hasSW_NEOut = layoutGrid ? layoutGrid.getExistingOutgoingEdgesFor(target) : [];
    hasSW_NEOut = hasSW_NEOut.some(item => layoutGrid.getEdgeDirection(item) === 'SW_NE');

    if (hasReversEdge || hasSW_NEOut) {

      // идем в обход
      return [
        getDockingPoint(sourceMid, sourceBounds, 'b', dockingSource),
        { x: sourceMid.x, y: sourceY + (!source.isExpanded ? DEFAULT_CELL_HEIGHT : DEFAULT_CELL_HEIGHT * (source.grid.colCount + 1.5)) },
        { x: targetMid.x, y: sourceY + (!source.isExpanded ? DEFAULT_CELL_HEIGHT : DEFAULT_CELL_HEIGHT * (source.grid.colCount + 1.5)) },
        getDockingPoint(targetMid, targetBounds, 'b', dockingTarget)
      ];
    } else {
      const firstPoint = getDockingPoint(sourceMid, sourceBounds, 'l', dockingSource);
      if (source.isExpanded) {
        firstPoint.y = sourceBounds.y + getDefaultSize(source).height / 2;
      }
      const lastPoint = getDockingPoint(targetMid, targetBounds, 'r', dockingTarget);
      if (target.isExpanded) {
        lastPoint.y = targetBounds.y + getDefaultSize(target).height / 2;
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
    for (let col = source.gridPosition.col - 1; col >= target.gridPosition.col; col--) {
      const candidate = layoutGrid ? layoutGrid.get(source.gridPosition.row, col) : null;
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
export function coordinatesToPosition(element, shift = { x: 0, y:0 }) {
  const row = element.gridPosition.row;
  const col = element.gridPosition.col;

  return {
    x: col * DEFAULT_CELL_WIDTH + shift.x,
    y: row * DEFAULT_CELL_HEIGHT + shift.y
  };
}

export function getBounds(element, row, col, shift, attachedTo) {
  const { width, height } = getDefaultSize(element);
  const { x, y } = shift;

  // Center in cell
  if (!attachedTo) {
    return {
      width, height,
      x: (col * DEFAULT_CELL_WIDTH) + (DEFAULT_CELL_WIDTH - width) / 2 + x,
      y: row * DEFAULT_CELL_HEIGHT + (DEFAULT_CELL_HEIGHT - height) / 2 + y
    };
  }

  const hostBounds = attachedTo.di.bounds;

  return {
    width, height,
    x: Math.round(hostBounds.x + hostBounds.width / 2 - width / 2),
    y: Math.round(hostBounds.y + hostBounds.height - height / 2)
  };
}

// TODO: for future
// eslint-disable-next-line no-unused-vars
function isDirectPathBlocked(source, target, layoutGrid) {
  const { row: sourceRow, col: sourceCol } = source.gridPosition;
  const { row: targetRow, col: targetCol } = target.gridPosition;

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
  const { row: sourceRow, col: sourceCol } = source.gridPosition;
  const { row: targetRow, col: targetCol } = target.gridPosition;

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

    if (aPos && !bPos) return -1;
    if (!aPos && bPos) return 1;
    if (!aPos && !bPos) return 0;

    return aPos[0] - bPos[0] || aPos[1] - bPos[1];
  };
}

export function sortElementsTopRightBottomLeft(grid) {
  return function(a, b) {
    const aPos = grid.find(a);
    const bPos = grid.find(b);

    if (aPos && !bPos) return -1;
    if (!aPos && bPos) return 1;
    if (!aPos && !bPos) return 0;

    return aPos[0] - bPos[0] || bPos[1] - aPos[1];
  };
}

export function sortColsLeftRightRowsBottomTop(grid) {
  return function(a, b) {
    const aPos = grid.find(a);
    const bPos = grid.find(b);

    if (aPos && !bPos) return -1;
    if (!aPos && bPos) return 1;
    if (!aPos && !bPos) return 0;

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

  const elementsInRange = [ ...layoutGrid.elements ]
    .map(item => {
      return item.size !== undefined ? [ ...item ] : item;
    }).flat()
    .filter(element => element.gridPosition.row === sourceRow && element.gridPosition.col > firstCol && element.gridPosition.col < lastCol);

  return elementsInRange.reduce((acc, cur) => {
    return cur.grid?.getGridDimensions()[0] > acc ? cur.grid?.getGridDimensions()[0] : acc;
  }, 0);
}
