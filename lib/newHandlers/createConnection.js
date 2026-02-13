import {
  connectElements,
} from '../utils/layoutUtils.js';

export default function createConnection(edge, layoutGrid, diFactory, shift) {
  const { id } = edge;

  // todo: пока костыль для отрисовки только тех, которые с id
  if (id) {
    const waypoints = connectElements(edge, layoutGrid, shift);
    const options = { ...edge.originalEdge.oldDi, id: id + '_di' };
    delete options.waypoint;
    delete options.label;
    delete options.$type;
    return diFactory.createDiEdge(edge, waypoints, options);
  }
}
