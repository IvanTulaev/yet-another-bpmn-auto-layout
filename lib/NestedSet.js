export class NestedSet {
  constructor(object, getFirst, getNext) {

    this.nestedSet = this._init(object, getFirst, getNext);
  }

  _init(object, getFirst, getNext) {
    const resultNestedSet = new Map(); // left, right, level
    const stack = getFirst(object);
    stack.forEach(item => {
      resultNestedSet.set(item, { level: 0 });
    });

    while (stack.length > 0) {
      const curItem = stack.pop();
      const curPosition = resultNestedSet.get(curItem);
      if (curPosition.left === undefined) {
        const maxRight = [ ...resultNestedSet.values() ].reduce((prev, cur) => {
          return cur.right > prev || prev === undefined ? cur.right : prev;
        }, undefined);
        curPosition.left = maxRight !== undefined ? maxRight + 1 : 0;
      }
      if (curPosition.right === undefined) {
        stack.push(curItem);
        const subItems = getNext(curItem).filter(item => resultNestedSet.get(item)?.level === undefined);
        if (subItems.length === 0) {
          let maxRight = [ ...resultNestedSet.values() ].reduce((prev, cur) => {
            return cur.right > prev || prev === undefined ? cur.right : prev;
          }, undefined);
          if (maxRight === undefined) maxRight = [ ...resultNestedSet.values() ].reduce((prev, cur) => {
            return cur.left > prev || prev === undefined ? cur.left : prev;
          }, undefined);
          if (curPosition.left > maxRight) maxRight = curPosition.left;
          curPosition.right = maxRight + 1;
        }
        [ ...subItems ].reverse().forEach((subLane, index, arr) => {
          stack.push(subLane);
          const subPosition = index === arr.length - 1 ? { level: curPosition.level + 1, left: curPosition.left + 1 } : { level: curPosition.level + 1 };
          resultNestedSet.set(subLane, subPosition);
        });
      }
    }

    return resultNestedSet;
  }

  getLeaves(item) {
    const position = this.nestedSet.get(item);
    return [ ...this.nestedSet.entries() ].filter(([ element, elPos ]) => {
      if (!position) return elPos.right - elPos.left === 1;
      return elPos.left > position.left && elPos.right < position.right && elPos.right - elPos.left === 1;
    });
  }

  getNested(item) {
    if (!item) return this.nestedSet.entries();
    const position = this.nestedSet.get(item);
    return [ ...this.nestedSet.entries() ].filter(([ , elPos ]) => {
      return elPos.left > position.left && elPos.right < position.right;
    });
  }

  isLeaf(item) {
    const position = this.nestedSet.get(item);
    return position.right - position.left === 1;
  }

  getMaxLevel() {
    return [ ...this.nestedSet.values() ].reduce((prev, nestPos) => {
      return prev < nestPos.level ? nestPos.level : prev;
    },0) ;
  }

}