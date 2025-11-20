export class Grid {
  constructor() {
    this._grid = [];
    this.isFlipped = false;
    this._elements = new Set();
  }

  get rowCount() {
    return this._grid.length;
  }

  get elementsCount() {
    return this._elements.size;
  }

  get elements() {
    return this._elements;
  }

  get colCount() {

    // так как грид теперь всегда прямоугольный, то можно позволить
    const firstRow = this._grid[0];
    return firstRow && firstRow.length;
  }

  /**
   *
   * @param element
   * @param {[number, number]} position - numbers are integer
   */
  add(element, position) {
    if (!this.isValidPosition(position)) {
      this._addStart(element);
      return;
    }

    const [ row, col ] = position;

    if (!this._grid[row]) {
      this._grid[row] = [];
    }

    // todo: remove to new logic
    if (this._grid[row][col]) {

      // throw new Error('Grid is occupied please ensure the place you insert at is not occupied');
      this._grid[row][col].add(element);
    } else {
      this._grid[row][col] = new Set([ element ]);
    }

    // this._grid[row][col] = element;
    this._elements.add(element);
    this.toRectangle();
  }

  move(element, toPosition) {
    if (!this.elements.has(element)) return;
    if (!this.isValidPosition(toPosition)) return;
    const position = this.find(element);
    if (!this.isValidPosition(position)) return;
    this.removeElementAt(position);
    this.add(element, toPosition);
  }

  removeElement(element) {
    if (!element) return;
    if (!this.elements.has(element)) return;
    const position = this.find(element);

    if (position) {
      const setPos = this.get(position[0], position[1]);
      setPos.delete(element);
      this.elements.delete(element);

      if (setPos.size === 0) this._grid[position[0]][position[1]] = null;

    }

    // todo: удалять один элемент
    // this.removeElementAt(position);
  }

  /**
   *
   * @param {number} afterIndex - number is integer
   */
  createRow(afterIndex) {
    if (!afterIndex && !Number.isInteger(afterIndex)) {
      this._grid.push(Array(this.colCount));
    } else {
      this._grid.splice(afterIndex + 1, 0, Array(this.colCount));
    }
  }

  /**
   *
   * @param {number} afterIndex - number is integer
   * @param {number=} colCount - number is positive integer
   */
  createCol(afterIndex, colCount) {
    this._grid.forEach((row, rowIndex) => {
      this.expandRow(rowIndex, afterIndex, colCount);
    });
  }

  /**
   * @param {number} rowIndex - is positive integer
   * @param {number} afterIndex - is integer
   * @param {number=} colCount - is positive integer
   */
  expandRow(rowIndex, afterIndex, colCount) {
    if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex > this.rowCount - 1) return;

    const placeholder = Number.isInteger(colCount) && colCount > 0 ? Array(colCount) : Array(1);

    const row = this._grid[rowIndex];

    if (!afterIndex && !Number.isInteger(afterIndex)) {
      row.splice(row.length, 0, ...placeholder);
    } else {
      row.splice(afterIndex + 1, 0, ...placeholder);
    }
  }

  _addStart(element) {
    this._grid.push([ new Set([ element ]) ]);
    this._elements.add(element);
  }

  /**
   * return position of element:
   * - [row: integer, col: integer] if element exist
   * - else undefined
   * @param element
   * @returns {number[] | undefined}
   */
  find(element) {
    let row, col;
    row = this._grid.findIndex(row => {
      col = row.findIndex(el => {
        return el?.has(element);
      });

      return col !== -1;
    });

    if (this.isValidPosition([ row, col ])) {
      return [ row, col ];
    }
  }

  get(row, col) {
    return (this._grid[row] || [])[col];
  }

  getElementsInRange({ row: startRow, col: startCol }, { row: endRow, col: endCol }) {
    const elements = [];

    if (startRow > endRow) {
      [ startRow, endRow ] = [ endRow, startRow ];
    }

    if (startCol > endCol) {
      [ startCol, endCol ] = [ endCol, startCol ];
    }

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const element = this.get(row, col);

        if (element) {
          elements.push(element);
        }
      }
    }

    return elements;
  }

  getGridDimensions() {
    const numRows = this._grid.length;
    let maxCols = 0;

    for (let i = 0; i < numRows; i++) {
      const currentRowLength = this._grid[i].length;
      if (currentRowLength > maxCols) {
        maxCols = currentRowLength;
      }
    }

    return [ numRows , maxCols ];
  }

  // TODO: REMOVE AFTER REFACTORING EDGE DRAWING
  elementsByPosition() {
    const elements = [];

    this._grid.forEach((row, rowIndex) => {
      row.forEach((element, colIndex) => {
        if (!element) return;
        for (const el of [ ...element ]) {
          elements.push({
            element:el,
            row: rowIndex,
            col: colIndex
          });
        }

      });
    });

    return elements;
  }

  shrinkCols() {

    for (let colIndex = this.colCount - 1 ; colIndex >= 0; colIndex--) {
      const shrinkRequired = this._grid.every(row => row[colIndex] == null);
      if (!shrinkRequired) continue;

      for (const row of this._grid) {
        row.splice(colIndex, 1);
      }
    }
  }

  shrinkRows() {
    this._grid = this._grid.filter(row => !row.every(col => col == null));
  }

  /**
   *
   * @param {[number, number]} position - numbers are integer
   */
  removeElementAt(position) {
    const [ row, col ] = position;
    const element = this.get(row, col);
    if (element) {
      this._grid[row][col] = null;

      // // todo: костыль для запуска шейка
      // const execEl = element.size !== undefined ? [...element] : [element];
      // for (const el of execEl) {
      //   this.elements.delete(el);
      // }

      this.elements.delete(element);
    }
  }

  toRectangle() {
    const [ , colCount ] = this.getGridDimensions();
    this._grid.forEach((row) => {
      if (row.length < colCount) {
        const difference = colCount - row.length;
        for (let i = 0; i < difference; i++) {
          row.splice(row.length, 0, null);
        }
      }
    });
  }

  flipHorizontally() {
    for (const row of this._grid) {
      row.reverse();
    }
    this.isFlipped = !this.isFlipped;
  }

  hasElement(element) {
    return this.elements.has(element);
  }

  isValidPosition(position) {
    if (!position || !Array.isArray(position) || position.length !== 2) return false;
    const [ row, col ] = position;
    return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && col >= 0;
  }

  hasIntermediateElements(firstPosition, lastPosition, onVertical) {
    if (!this.isValidPosition(firstPosition) || !this.isValidPosition(lastPosition)) return false;
    if (!onVertical) {

      // работаем по горизонтали
      const [ start, end ] = firstPosition[1] <= lastPosition[1] ? [ firstPosition[1] , lastPosition[1] ] : [ lastPosition[1], firstPosition[1] ];
      for (let col = start + 1; col < end; col++) {
        if (!this.hasElementAt([ firstPosition[0], col ])) ;
        return true;
      }
      return false;
    } else {

      // работаем по вертикали
      const [ start, end ] = firstPosition[0] <= lastPosition[0] ? [ firstPosition[0] , lastPosition[0] ] : [ lastPosition[0], firstPosition[0] ];
      for (let row = start + 1; row < end; row++) {
        if (!this.hasElementAt([ row, firstPosition[1] ])) continue;
        return true;
      }
      return false;
    }
  }

  hasElementAt(position) {
    if (!this.isValidPosition(position)) return false;
    const [ row, col ] = position;
    const element = this.get(row, col);
    return !!element;
  }
}