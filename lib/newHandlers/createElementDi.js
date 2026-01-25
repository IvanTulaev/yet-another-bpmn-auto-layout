import { getBounds } from '../utils/layoutUtils.js';
import { getOutgoingElements } from '../utils/elementUtils.js';
import { is } from '../di/DiUtil.js';

export default function createElementDi(element, elementPosition, diFactory, grid, shift, laneLevelDif) {
  if (element.di) return [];

  if (element.$type === 'bpmn:BoundaryEvent') {
    return createBEl(element, elementPosition, diFactory, grid, shift);
  }

  if (element.$type === 'bpmn:Lane') {
    elementPosition[2] = grid.colCount;
  }

  const bounds = getBounds(element, elementPosition, shift, laneLevelDif);

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
  return [ shapeDi ];
}

function createBEl(element, elementPosition, diFactory, grid, shift) {
  const host = element.attachedToRef;
  const hostPosition = grid.find(host);

  const hostBounds = getBounds(host, hostPosition, shift);
  if (!hostBounds) throw new Error(`Create DI for ${element.id}. Nо hostBounds`);
  const DIs = [];

  // получаем соседние boundary
  // первыми должны отрисовываться те, у которых потомки ниже и правей
  let neighboursBoundary = element.$parent.flowElements.filter(item => item.attachedToRef === element.attachedToRef && grid.hasElement(element));
  neighboursBoundary = getSortedElementsByOutgoingPosition(neighboursBoundary, grid);
  neighboursBoundary.forEach((att, i, arr) => {
    const bounds = getBounds(att, elementPosition, shift);

    // distribute along lower edge
    bounds.x = hostBounds.x + (i + 1) * (hostBounds.width / (arr.length + 1)) - bounds.width / 2;
    bounds.y = hostBounds.y + hostBounds.height - bounds.height / 2;

    const attacherDi = diFactory.createDiShape(att, bounds, {
      id: att.id + '_di'
    });
    att.di = attacherDi;

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
    if (prev[0] < curPosition[0] || prev[1] < curPosition[1]) return curPosition;
    return prev;
  }, [ 0 ,0 ]);
}