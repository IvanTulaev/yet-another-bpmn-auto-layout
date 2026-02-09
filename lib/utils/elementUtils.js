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

export function getAllProcesses(bpmnModel) {
  const allElements = bpmnModel.elementsById;
  if (!allElements) return [];
  return Object.values(allElements).filter(element => element.$type === 'bpmn:Process' || element.$type === 'bpmn:SubProcess');
}

// /**
//  * Set expanded property to element from its diagram
//  * @param bpmnModel
//  */
export function setAdditionalPropsToElements(bpmnModel, getLanes) {
  const allElements = bpmnModel.elementsById;
  if (allElements) {
    for (const element of Object.values(allElements)) {

      // mark expanded processes
      if (element.$type === 'bpmndi:BPMNShape' && element.isExpanded === true) element.bpmnElement.isExpanded = true;

      // mark lane indexes
      // todo: добавить очередность как она есть в DI, если есть
      if (element.$type === 'bpmn:Participant') {
        element.processRef.lanesNestedSet = getLanes(element.processRef);
        element.processRef.lanesNestedSet.nestedSet.forEach((_, node) => {
          if (node.$type === 'bpmn:Lane') {
            const elements = node.flowNodeRef;
            if (elements) {
              elements.forEach(element => element.laneRef = node);
            }
          }
        });

        const flowElements = element.processRef.flowElements || [];
        for (const flowElement of flowElements) {
          if (
            !is(flowElement,'bpmn:SequenceFlow') &&
            !is(flowElement,'bpmn:DataObject') &&
            !is(flowElement,'bpmn:DataObjectReference') &&
            !is(flowElement,'bpmn:DataStoreReference') &&
            !flowElement.laneRef) {
            flowElement.laneRef = element.processRef;
          }
        }
        //!is(flowElement,'bpmn:SequenceFlow') && !is(flowElement,'bpmn:DataObject')


          // .getLeaves().map(([ item ]) => item);
        // if (lanes) {
        //   lanes.forEach((lane) => {
        //     const nodes = lane.flowNodeRef;
        //     if (nodes) {
        //       nodes.forEach(node => node.laneRef = lane);
        //     }
        //   });
        // }
      }
    }
  }
}
