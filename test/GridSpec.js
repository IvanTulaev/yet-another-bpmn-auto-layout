import { strict as assert} from 'assert';
import {describe, it, beforeEach} from 'mocha';
import { Grid } from '../lib/Grid.js';

describe('Grid', () => {
  let grid;

  beforeEach(() => {
    grid = new Grid();
  });

  describe('Constructor', () => {
    it('should create empty grid with default parameters', () => {
      assert.strictEqual(grid.rowCount, 0);
      assert.strictEqual(grid.colCount, 0);
      assert.strictEqual(grid.elementsCount, 0);
      assert.strictEqual(grid.isFlipped, false);
    });
  });

  describe('add()', () => {
    it('should add element to valid position', () => {
      grid.add('element1', [0, 0]);
      assert.strictEqual(grid.hasElement('element1'), true);
      assert.strictEqual(grid.get(0, 0).has('element1'), true);
      assert.strictEqual(grid.elementsCount, 1);
    });

    it('should add element to start when position is invalid', () => {
      grid.add('element1', [-1, -1]);
      assert.strictEqual(grid.hasElement('element1'), true);
      assert.strictEqual(grid.rowCount, 1);
      assert.strictEqual(grid.colCount, 1);
    });

    it('should add multiple elements to same position', () => {
      grid.add('element1', [0, 0]);
      grid.add('element2', [0, 0]);

      const set = grid.get(0, 0);
      assert.strictEqual(set.has('element1'), true);
      assert.strictEqual(set.has('element2'), true);
      assert.strictEqual(set.size, 2);
      assert.strictEqual(grid.elementsCount, 2);
    });

    it('should automatically create row when adding to non-existent row col', () => {
      grid.add('element1', [2, 2]);
      grid.add('element2', [4, 4]);
      assert.deepEqual(grid._elements.get('element1'), [2,2]);
      assert.deepEqual(grid._elements.get('element2'), [4,4]);
      assert.strictEqual(grid.rowCount, 5);
      assert.strictEqual(grid.colCount, 5);
    });

    it('should make grid rectangular after adding', () => {
      grid.add('element1', [0, 0]);
      grid.add('element2', [1, 2]);

      const [rows, cols] = grid.getGridDimensions();
      assert.strictEqual(rows, 2);
      assert.strictEqual(cols, 3);
    });
  });

  describe('removeElement()', () => {
    beforeEach(() => {
      grid.add('element1', [0, 0]);
      grid.add('element2', [0, 0]);
      grid.add('element3', [1, 1]);
    });

    it('should remove element from grid', () => {
      grid.removeElement('element1');
      assert.strictEqual(grid.hasElement('element1'), false);
      assert.strictEqual(grid.get(0, 0).has('element1'), false);
      assert.strictEqual(grid.elementsCount, 2);
    });

    it('should not remove other elements in same position', () => {
      grid.removeElement('element1');
      assert.strictEqual(grid.get(0, 0).has('element2'), true);
      assert.strictEqual(grid.elementsCount, 2);
    });

    it('should set position to null when last element is removed', () => {
      grid.removeElement('element1');
      grid.removeElement('element2');
      assert.strictEqual(grid.get(0, 0), null);
    });

    it('should do nothing when removing non-existent element', () => {
      const initialCount = grid.elementsCount;
      grid.removeElement('non-existent');
      assert.strictEqual(grid.elementsCount, initialCount);
    });

    it('should handle removing null element', () => {
      const initialCount = grid.elementsCount;
      grid.removeElement(null);
      assert.strictEqual(grid.elementsCount, initialCount);
    });
  });

  describe('move()', () => {
    beforeEach(() => {
      grid.add('element1', [0, 0]);
    });

    it('should move element to new position', () => {
      grid.move('element1', [1, 1]);
      assert.strictEqual(grid.hasElement('element1'), true);
      assert.strictEqual(grid.get(0, 0), null);
      assert.strictEqual(grid.get(1, 1).has('element1'), true);
    });

    it('should not move element to invalid position', () => {
      const originalPosition = grid.find('element1');
      assert.throws(() => grid.move('element1', [-1, -1]),
          (error) => error.message === `Cannot move element "element1" to invalid position -1,-1`
      );
      assert.deepStrictEqual(grid.find('element1'), originalPosition);
    });

    it('should do nothing when moving non-existent element', () => {
      assert.throws(() => grid.move('non-existent', [1, 1]),
          (error) => error.message === `Cannot move not exist element "non-existent"`
      );
    });
  });

  describe('find()', () => {
    beforeEach(() => {
      grid.add('element1', [2, 3]);
      grid.add('element2', [0, 0]);
    });

    it('should find element position', () => {
      const position = grid.find('element1');
      assert.deepStrictEqual(position, [2, 3]);
    });

    it('should return undefined for non-existent element', () => {
      const position = grid.find('non-existent');
      assert.strictEqual(position, undefined);
    });

    it('should handle multiple elements in same position', () => {
      grid.add('element3', [2, 3]);
      const position1 = grid.find('element1');
      const position3 = grid.find('element3');
      assert.deepStrictEqual(position1, [2, 3]);
      assert.deepStrictEqual(position3, [2, 3]);
    });
  });

  describe('createRow() and createCol()', () => {
    beforeEach(() => {
      // grid = new Grid();
      grid.add('element1', [0, 0]);
      grid.add('element2', [2, 2]);
    });

    it('should create row at specific index', () => {
      grid.addRowCol(false, 0);
      assert.strictEqual(grid.rowCount, 4);
      assert.strictEqual(grid.colCount, 3);

      // todo: not actual
      // assert.strictEqual(grid._grid[1].length, 3); // новая строка должна иметь правильную длину
    });

    it('should create column at specific index', () => {
      grid.addRowCol(true, 1);
      assert.strictEqual(grid.colCount, 4);
      assert.strictEqual(grid.rowCount, 3);
    });

    it('should create multiple columns', () => {
      grid.addRowCol(true, 0, 2);
      assert.strictEqual(grid.colCount, 5);
    });
  });

  describe('expandRow()', () => {
    beforeEach(() => {
      grid = new Grid();
      grid.add('element1', [0, 0]);
      grid.add('element2', [2, 2]);
    });

    it('should expand specific row at the start when no index provided', () => {
      grid.expandRow(0);
      assert.strictEqual(grid.get(0,1).has('element1'), true);
      assert.strictEqual(grid.get(2,2).has('element2'), true);
      assert.strictEqual(grid.colCount, 4);
      assert.strictEqual(grid.rowCount, 3);

      // todo: не актуально
      // assert.strictEqual(grid._grid[0].length, 3);
      // assert.strictEqual(grid._grid[1].length, 2);
    });

    it('should expand row at specific index ith multiple columns', () => {
      grid.expandRow(2, 1, 2);
      assert.strictEqual(grid.get(0,0).has('element1'), true);
      assert.strictEqual(grid.get(2,4).has('element2'), true);
      assert.strictEqual(grid.colCount, 5);
      assert.strictEqual(grid.rowCount, 3);
    });

    it('should not expand invalid row', () => {
      assert.throws(() => grid.expandRow(-1, 0),
          (error) => error.message === `Can't expand row with index: -1. Grid row count is ${grid.rowCount}`
      )

      assert.throws(() => grid.expandRow(10, 0),
          (error) => error.message === `Can't expand row with index: 10. Grid row count is ${grid.rowCount}`
      )
    });
  });

  describe('getElementsInRange()', () => {
    beforeEach(() => {
      grid.add('a', [0, 0]);
      grid.add('b', [1, 1]);
      grid.add('c', [2, 2]);
    });

    it('should get elements in specified range', () => {
      const elements = grid.getElementsInRange(
          { row: 0, col: 0 },
          { row: 2, col: 2 }
      );
      assert.strictEqual(elements.length, 3);
    });

    it('should handle reversed coordinates', () => {
      const elements = grid.getElementsInRange(
          { row: 2, col: 2 },
          { row: 0, col: 0 }
      );
      assert.strictEqual(elements.length, 3);
    });

    it('should return empty array for empty range', () => {
      const elements = grid.getElementsInRange(
          { row: 5, col: 5 },
          { row: 10, col: 10 }
      );
      assert.strictEqual(elements.length, 0);
    });

    it('should return partial range when some positions are empty', () => {
      const elements = grid.getElementsInRange(
          { row: 0, col: 0 },
          { row: 1, col: 1 }
      );
      assert.strictEqual(elements.length, 2);
    });
  });

  describe('shrink operations', () => {
    beforeEach(() => {
      grid = new Grid();
      grid.add('element1', [0, 0]);
      grid.add('element2', [2, 2]);
    });

    it('should shrink empty columns', () => {
      grid.shrink(false);
      assert.strictEqual(grid.colCount, 2);
      assert.strictEqual(grid.rowCount, 3);
    });

    it('should shrink empty rows', () => {
      grid.shrink(true);
      assert.strictEqual(grid.rowCount, 2);
      assert.strictEqual(grid.colCount, 3);
    });

    it('should not shrink columns with elements', () => {
      grid.shrink(false);
      grid.shrink(false);
      assert.strictEqual(grid.colCount, 2);
      assert.strictEqual(grid.rowCount, 3);
    });

    it('should not shrink rows with elements', () => {
      grid.shrink(true);
      grid.shrink(true);
      assert.strictEqual(grid.rowCount, 2);
      assert.strictEqual(grid.colCount, 3);
    });
  });

  describe('flipHorizontally()', () => {
    beforeEach(() => {
      grid.add('left', [0, 0]);
      grid.add('right', [0, 2]);
      grid.add('middle', [0, 1]);
    });

    it('should flip grid horizontally', () => {
      grid.flip(false);
      assert.deepStrictEqual(grid.find('left'), [0, 2]);
      assert.deepStrictEqual(grid.find('right'), [0, 0]);
      assert.deepStrictEqual(grid.find('middle'), [0, 1]);
    });

    it('should toggle isFlipped flag', () => {
      const originalState = grid.isFlipped;
      grid.flip(false);
      assert.strictEqual(grid.isFlipped, !originalState);
      grid.flip(false);
      assert.strictEqual(grid.isFlipped, originalState);
    });
  });

  describe('hasIntermediateElements()', () => {
    beforeEach(() => {
      grid.add('a', [0, 0]);
      grid.add('b', [0, 2]);
      grid.add('c', [0, 1]); // промежуточный элемент
      grid.add('d', [2, 0]);
      grid.add('e', [1, 0]); // промежуточный элемент
    });

    it('should detect intermediate elements horizontally', () => {
      const hasIntermediate = grid.hasIntermediateElements([0, 0], [0, 2], false);
      assert.strictEqual(hasIntermediate, true);
    });

    it('should detect no intermediate elements horizontally', () => {
      grid.removeElement('c');
      const hasIntermediate = grid.hasIntermediateElements([0, 0], [0, 2], false);
      assert.strictEqual(hasIntermediate, false);
    });

    it('should detect intermediate elements vertically', () => {
      const hasIntermediate = grid.hasIntermediateElements([0, 0], [2, 0], true);
      assert.strictEqual(hasIntermediate, true);
    });

    it('should detect no intermediate elements vertically', () => {
      grid.removeElement('e');
      const hasIntermediate = grid.hasIntermediateElements([0, 0], [2, 0], true);
      assert.strictEqual(hasIntermediate, false);
    });

    it('should handle invalid positions', () => {
      const hasIntermediate = grid.hasIntermediateElements([-1, 0], [0, 0], false);
      assert.strictEqual(hasIntermediate, false);
    });

    it('should handle adjacent positions', () => {
      const hasIntermediate = grid.hasIntermediateElements([0, 0], [0, 1], false);
      assert.strictEqual(hasIntermediate, false);
    });
  });

  describe('isValidPosition()', () => {
    it('should validate correct positions', () => {
      assert.strictEqual(grid.isValidPosition([0, 0]), true);
      assert.strictEqual(grid.isValidPosition([5, 10]), true);
    });

    it('should reject invalid positions', () => {
      assert.strictEqual(grid.isValidPosition([-1, 0]), false);
      assert.strictEqual(grid.isValidPosition([0, -1]), false);
      assert.strictEqual(grid.isValidPosition([0.5, 0]), false);
      assert.strictEqual(grid.isValidPosition([0, 0.5]), false);
      assert.strictEqual(grid.isValidPosition(null), false);
      assert.strictEqual(grid.isValidPosition([0]), false);
      // assert.strictEqual(grid.isValidPosition([0, 0, 0]), false);
      assert.strictEqual(grid.isValidPosition(undefined), false);
      assert.strictEqual(grid.isValidPosition('string'), false);
    });
  });

  describe('elementsByPosition()', () => {
    beforeEach(() => {
      grid.add('a', [0, 0]);
      grid.add('b', [0, 0]);
      grid.add('c', [1, 1]);
    });

    // it('should return all elements with positions', () => {
    //   const elements = grid.elementsByPosition();
    //   assert.strictEqual(elements.length, 3);
    //
    //   // Проверяем что все элементы присутствуют
    //   const elementStrings = elements.map(e => e.element).sort();
    //   assert.deepStrictEqual(elementStrings, ['a', 'b', 'c']);
    //
    //   // Проверяем позиции
    //   const positions = elements.map(e => `${e.row},${e.col}`).sort();
    //   assert.deepStrictEqual(positions, ['0,0', '0,0', '1,1']);
    // });
  });

  describe('getGridDimensions()', () => {
    it('should return correct dimensions for irregular grid', () => {
      grid.add('a', [0,1]);
      grid.add('b', [1,0]);
      grid.add('c', [2,2]);
      grid.add('e', [2,3]);

      const [rows, cols] = grid.getGridDimensions();
      assert.strictEqual(rows, 3);
      assert.strictEqual(cols, 4);
    });

    it('should handle empty grid', () => {
      const [rows, cols] = grid.getGridDimensions();
      assert.strictEqual(rows, 0);
      assert.strictEqual(cols, 0);
    });

    it('should handle single element grid', () => {
      grid.add('single', [0, 0]);
      const [rows, cols] = grid.getGridDimensions();
      assert.strictEqual(rows, 1);
      assert.strictEqual(cols, 1);
    });
  });

  describe('hasElementAt()', () => {
    beforeEach(() => {
      grid.add('test', [1, 1]);
    });

    it('should return true for position with element', () => {
      assert.strictEqual(grid.hasElementAt([1, 1]), true);
    });

    it('should return false for empty position', () => {
      assert.strictEqual(grid.hasElementAt([0, 0]), false);
    });

    it('should return false for invalid position', () => {
      assert.strictEqual(grid.hasElementAt([-1, 0]), false);
    });
  });
});