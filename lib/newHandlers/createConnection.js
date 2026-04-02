import {
  connectElements,
} from '../utils/layoutUtils.js';
import { deleteLayoutAttributes } from '../di/DiUtil.js';

export default function createConnection(edge, getAdditionalProp, layoutGrid, diFactory, shift) {
  const { id } = edge;

  // todo: пока костыль для отрисовки только тех, которые с id
  if (id) {
    const waypoints = connectElements(edge, getAdditionalProp, layoutGrid, shift);
    const options = { ...getAdditionalProp(edge.originalEdge, 'oldDi'), id: id + '_di' };
    deleteLayoutAttributes(options);
    return diFactory.createDiEdge(edge.originalEdge, waypoints, options);
  }
}
