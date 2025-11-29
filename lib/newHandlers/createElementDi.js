import { DEFAULT_CELL_HEIGHT, DEFAULT_CELL_WIDTH, getBounds } from '../utils/layoutUtils.js';
import { getOutgoingElements } from '../utils/elementUtils.js';
import { getDefaultSize, is } from '../di/DiUtil.js';

export default function createElementDi(element, elementPosition, diFactory, grid, shift) {
  const [ row, col, elWidth, elHeight ] = elementPosition;
  if (element.di) return [];

  if (element.$type === 'bpmn:BoundaryEvent') {
    return createBEl(element, row, col, diFactory, grid, shift);
  }

  const bounds = getBounds(element, row, col, shift);

  // Todo: костыль для проверки работоспособности
  if (element.isExpanded) {
    const { width, height } = getDefaultSize(element);
    const { rowCount, colCount } = element.grid;

    // todo: убрать после использования ширины и высоты
    bounds.width = (colCount ? colCount : 1) * DEFAULT_CELL_WIDTH + width;
    bounds.height = (rowCount ? rowCount : 1) * DEFAULT_CELL_HEIGHT + height;
  }

  const options = {
    id: element.id + '_di'
  };

  if (element.isExpanded) {
    options.isExpanded = true;
  }

  if (is(element, 'bpmn:ExclusiveGateway')) {
    options.isMarkerVisible = true;
  }

  const shapeDi = diFactory.createDiShape(element, bounds, options);
  element.di = shapeDi;
  element.gridPosition = { row, col };
  return [ shapeDi ];
}

function createBEl(element, row, col, diFactory, grid, shift) {
  const hostBounds = element.attachedToRef.di.bounds;
  if (!hostBounds) throw new Error(`Create DI for ${element.id}. Nо hostBounds`);
  const DIs = [];

  // получаем соседние boundary
  // первыми должны отрисовываться те, у которых потомки ниже и правей
  let neighboursBoundary = element.$parent.flowElements.filter(item => item.attachedToRef === element.attachedToRef && grid.hasElement(element));
  neighboursBoundary = getSortedElementsByOutgoingPosition(neighboursBoundary, grid);
  neighboursBoundary.forEach((att, i, arr) => {
    att.gridPosition = { row, col };
    const bounds = getBounds(att, row, col, shift, element.attachedToRef);

    // distribute along lower edge
    bounds.x = hostBounds.x + (i + 1) * (hostBounds.width / (arr.length + 1)) - bounds.width / 2;

    const attacherDi = diFactory.createDiShape(att, bounds, {
      id: att.id + '_di'
    });
    att.di = attacherDi;
    att.gridPosition = { row, col };

    DIs.push(attacherDi);
  });
  return DIs;
}

// Первыми идут те у которых исходящие ниже
function getSortedElementsByOutgoingPosition(elements, grid) {
  return elements.sort((a, b) => {
    const aBottomRightChildPosition = getPositionRightBottomOutgoingElement(a, grid);
    const bBottomRightChildPosition = getPositionRightBottomOutgoingElement(b, grid);

    return aBottomRightChildPosition[0] - bBottomRightChildPosition[0] || aBottomRightChildPosition[1] - bBottomRightChildPosition[1];
  }).reverse();
}

function getPositionRightBottomOutgoingElement(element, grid) {
  return getOutgoingElements(element).reduce((prev, cur) => {
    if (!grid.hasElement(cur)) return prev;
    const curPosition = grid.find(cur);
    if (prev === undefined) return curPosition;
    if (prev[0] < curPosition[0] || prev[1] < curPosition[1]) return curPosition;
    return prev;
  }, [ 0 ,0 ]);
}