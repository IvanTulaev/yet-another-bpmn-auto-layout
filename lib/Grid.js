export class Grid {
  constructor() {
    this.isFlipped = false;
    this._elements = new Map();
    this.rows = {};
    this.cols = {};
  }

  get rowCount() {
    return Object.keys(this.rows).length;
  }

  get colCount() {
    return Object.keys(this.cols).length;
  }

  get elementsCount() {
    return this._elements.size;
  }

  get elements() {
    return new Set (this._elements.keys());
  }

  /**
   *
   * @param element
   * @param {[number, number]} position - numbers are integer
   */
  add(element, position) {

    if (this._elements.has(element)) throw new Error(`Cannot add duplicated element ${JSON.stringify(element)}`);

    if (!position) {
      this._addStart(element);
      return;
    }

    const lastRow = this.rowCount - 1;
    const lastCol = this.colCount - 1;

    const rowDif = position[0] - lastRow;
    const colDif = position[1] - lastCol;
    this.addRowCol(false, lastRow >= 0 ? lastRow : undefined, rowDif);
    this.addRowCol(true, lastCol >= 0 ? lastCol : undefined, colDif);

    this._elements.set(element, position);
    this._addElementToRowsCols(element, position);
  }

  _addElementToRowsCols(element) {
    const position = this._elements.get(element);
    this.rows[position[0]] ? this.rows[position[0]].add(element) : this.rows[position[0]] = new Set([ element ]);
    this.cols[position[1]] ? this.cols[position[1]].add(element) : this.cols[position[1]] = new Set([ element ]);
  }
  _removeElementFromRowsCols(element) {
    const position = this._elements.get(element);
    if (this.rows[position[0]]) this.rows[position[0]].delete(element);
    if (this.cols[position[1]]) this.cols[position[1]].delete(element);
  }

  _addStart(element) {
    const [ row, ] = this.getGridDimensions();
    this._elements.set(element, [ row, 0 ]);
    this._addElementToRowsCols(element, [ row, 0 ]);
  }

  move(element, toPosition) {
    if (!this.elements.has(element)) throw new Error(`Cannot move not exist element ${JSON.stringify(element)}`);
    if (!this.isValidPosition(toPosition)) throw new Error(`Cannot move element ${JSON.stringify(element)} to invalid position ${toPosition}`);
    const newPos = [ ...toPosition ];
    this._removeElementFromRowsCols(element);
    this._elements.set(element, newPos);
    this._addElementToRowsCols(element);
  }

  removeElement(element) {
    if (this._elements.has(element)) {
      this._removeElementFromRowsCols(element);
      this._elements.delete(element);
    }
  }

  addRowCol(addCol, afterIndex, count = 1) {

    // добавляем линии
    const gridCount = addCol ? this.colCount : this.rowCount;
    const addCount = afterIndex >= gridCount - 1 ? afterIndex - (gridCount - 1) + count : count;
    for (let i = 0; i < addCount; i++) {
      if (addCol) {
        this.cols[gridCount + i] = new Set();
      } else {
        this.rows[gridCount + i] = new Set();
      }
    }

    // перемещаем элементы
    for (const [ item, elementPosition ] of this._elements.entries()) {
      const position = addCol ? elementPosition[1] : elementPosition[0];

      if (position > afterIndex || afterIndex === undefined) {
        this._removeElementFromRowsCols(item);
        elementPosition[addCol ? 1 : 0] += count;
        this._addElementToRowsCols(item);
      }
    }
  }

  /**
   * Для добавления перед первым элементом afterIndex = undefined
   * @param {number} rowIndex - is positive integer
   * @param {number=} afterIndex - is integer
   * @param {number=} colCount - is positive integer
   */
  expandRow(rowIndex, afterIndex, colCount = 1) {

    if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex > this.rowCount - 1) throw new Error (`Can't expand row with index: ${rowIndex}. Grid row count is ${this.rowCount}`);

    // готовим строку
    const gridColCount = this.colCount;
    const addCount = afterIndex >= gridColCount - 1 ? afterIndex - (gridColCount - 1) + colCount : colCount;
    for (let i = 0; i < addCount; i++) {
      this.cols[gridColCount + i] = new Set();
    }

    // перемещаем элементы
    [ ...this.rows[rowIndex] ].forEach(item => {
      const position = this.find(item);
      if (position[1] > afterIndex || afterIndex === undefined) {
        this._removeElementFromRowsCols(item);
        position[1] += colCount;
        this._addElementToRowsCols(item);
      }
    });
  }

  /**
   * return position of element:
   * - [row: integer, col: integer] if element exist
   * - else undefined
   * @param element
   * @returns {number[] | undefined}
   */
  find(element) {
    return this._elements.get(element);
  }

  get(row, col) {

    // todo: make simple to read
    const elementsAtPosition = new Set ([ ...this._elements.entries() ].filter(([ item, position ]) => position[0] === row && position[1] === col)
      .map(item => item[0]));

    return elementsAtPosition.size ? elementsAtPosition : null;
  }

  getElementsInRange({ row: startRow, col: startCol }, { row: endRow, col: endCol }) {

    if (startRow > endRow) {
      [ startRow, endRow ] = [ endRow, startRow ];
    }

    if (startCol > endCol) {
      [ startCol, endCol ] = [ endCol, startCol ];
    }

    return [ ...this._elements.entries() ]
      .filter(([ , position ]) => position[0] >= startRow && position[0] <= endRow && position[1] >= startCol && position[1] <= endCol)
      .map(item => item[0]);
  }

  getGridDimensions() {
    const rows = this.rowCount;
    const cols = this.colCount;

    return [ rows, cols ];
  }

  // todo: переписать на строки
  shrink(byVertical) {

    // Отсортированный массив элементов по строкам или столбцам
    const sortedElements = [ ...this._elements.entries() ]
      .sort((a, b) => {
        const aPosition = !byVertical ? a[1][1] : a[1][0];
        const bPosition = !byVertical ? b[1][1] : b[1][0];
        return aPosition - bPosition;
      });

    // актуальный индекс = 0
    // смещение = 0
    let shift = 0;
    let previousIndex = null;

    for (const element of sortedElements) {

      // У элемента берём позицию
      const position = !byVertical ? element[1][1] : element[1][0];
      this._removeElementFromRowsCols(element[0]);

      if (previousIndex === null) {
        shift = position;
      } else if (previousIndex !== position) {
        shift = shift + position - previousIndex - 1;
      }

      previousIndex = position;

      const newElPos = [ ...element[1] ];
      if (!byVertical) {
        newElPos[1] -= shift;
      } else {
        newElPos[0] -= shift;
      }
      this._elements.set(element[0], newElPos);

      this._addElementToRowsCols(element[0]);
    }

    // todo: пока не смотрим на размер элементов, а просто удаляем пустые строки
    // Здесь уже все сдвинуты
    for (const [ key, value ] of Object.entries(!byVertical ? this.cols : this.rows)) {
      if (value.size === 0) {
        if (!byVertical) {
          delete this.cols[key];
        } else {
          delete this.rows[key];
        }
      }
    }

  }

  flip(byVertical) {

    // Получить измерения
    const [ rowCount, colCount ] = this.getGridDimensions();

    // Для каждой позиции
    // - измерение - 1 - позиция
    for (const [ element, position ] of this._elements.entries()) {
      const newPosition = [ ...position ];
      this._removeElementFromRowsCols(element);
      if (!byVertical) {
        newPosition[1] = colCount - 1 - newPosition[1];
      } else {
        newPosition[0] = rowCount - 1 - newPosition[0];
      }
      this._elements.set(element, newPosition);
      this._addElementToRowsCols(element);
    }

    // todo: add directional flip flag
    this.isFlipped = !this.isFlipped;
  }

  hasElement(element) {
    return this.elements.has(element);
  }

  isValidPosition(position) {
    if (!position || !Array.isArray(position)) return false;
    const [ row, col ] = position;
    return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && col >= 0;
  }

  hasIntermediateElements(firstPosition, lastPosition, onVertical) {
    if (!this.isValidPosition(firstPosition) || !this.isValidPosition(lastPosition)) return false;
    if (!onVertical ? firstPosition[0] !== lastPosition[0] : firstPosition[1] !== lastPosition[1]) return false;

    const index = !onVertical ? firstPosition[1] : firstPosition[0];
    const [ start, end ] = !onVertical ? (firstPosition[1] <= lastPosition[1] ? [ firstPosition[1] , lastPosition[1] ] : [ lastPosition[1], firstPosition[1] ]) : (firstPosition[0] <= lastPosition[0] ? [ firstPosition[0] , lastPosition[0] ] : [ lastPosition[0], firstPosition[0] ]);
    return [ ...this._elements.values() ].some(item => !onVertical ? item[0] === index && item[1] > start && item[1] < end : item[1] === index && item[0] > start && item[0] < end);
  }

  hasElementAt(position) {
    if (!this.isValidPosition(position)) return false;
    const [ row, col ] = position;
    const element = this.get(row, col);
    return !!element;
  }
}