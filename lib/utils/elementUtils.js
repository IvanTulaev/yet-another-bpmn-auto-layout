import { is } from '../di/DiUtil.js';

export function isConnection(element) {
  return !!element.sourceRef;
}

export function isBoundaryEvent(element) {
  return !!element.attachedToRef;
}

export function getOutgoingElements(element) {
  if (!element) throw new Error('Element is not defined in getOutgoingElements');
  const outgoingElements = (element.outgoing || []).map(out => out.targetRef);

  // возвращаем уникальные, так как BPMN может быть не валидным
  return [ ...new Set(outgoingElements) ];
}

export function getIncomingElements(element) {
  if (!element) throw new Error('Element is not defined in getIncomingElements');
  let incomingElements = (element.incoming || []).map(out => out.sourceRef);

  // возвращаем уникальные, так как BPMN может быть не валидным
  return [ ...new Set(incomingElements) ];
}

export function getAttachedOutgoingElements(element) {
  const outgoing = new Set();
  if (element) {
    const attachedOutgoing = (element.attachers || [])
      .sort((a,b) => {
        const bOutCount = b.outgoing ? b.outgoing.length : 0;
        const aOutCount = a.outgoing ? a.outgoing.length : 0;
        return bOutCount - aOutCount;
      })
      .map(attacher => (attacher.outgoing || []).reverse())
      .flat()
      .map(out => out.targetRef)
      .filter((item, index, self) => self.indexOf(item) === index);
    for (const out of attachedOutgoing) {
      outgoing.add(out);
    }
  }

  return [ ...outgoing ];
}

export function isStartIntermediate(element) {
  return (is(element, 'bpmn:IntermediateThrowEvent') || is(element, 'bpmn:IntermediateCatchEvent'))
      && (element.incoming === undefined || element.incoming.length === 0);
}

export function bindBoundaryEventsWithHosts(elements) {
  const boundaryEvents = elements.filter(element => isBoundaryEvent(element));
  boundaryEvents.forEach(boundaryEvent => {
    const attachedTask = boundaryEvent.attachedToRef;
    const attachers = attachedTask.attachers || [];
    attachers.push(boundaryEvent);
    attachedTask.attachers = attachers;
  });
}
