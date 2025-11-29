import {
  connectElements,
} from '../utils/layoutUtils.js';

export default function createConnection(edge, layoutGrid, diFactory, shift) {
  const { id } = edge;

  // todo: пока костыль для отрисовки только тех, которые с id
  if (id) {
    const waypoints = connectElements(edge, layoutGrid, shift);
    return diFactory.createDiEdge(edge, waypoints, {
      id: id + '_di'
    });
  }
}
