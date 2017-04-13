<template>
  <div class="gridster">
    <slot></slot>
    <div v-if="movingItem" :style="previewStyle" class="gridster-item gridster-preview-holder"></div>
  </div>
</template>
<script>
  import {GridsterDebounce} from "./vue-gridster-utils"
  export default {
    name: "gridster",
    props: {
      options: {
        type: Object, default(){
          return {}
        }
      }
    },
    data(){
      return {
        grid: [],
        allItems: [],
        gridHeight: 1,
        movingItem: null,
        isLoaded: false,
        isLayoutChanging: false,
        curWidth: 0,
        curColWidth: 0,
        curRowHeight: 0,

        columns: 6, // number of columns in the grid
        pushing: true, // whether to push other items out of the way
        floating: true, // whether to automatically float items up so they stack
        swapping: false, // whether or not to have items switch places instead of push down if they are the same size
        width: 'auto', // width of the grid. "auto" will expand the grid to its parent container
        colWidth: 'auto', // width of grid columns. "auto" will divide the width of the grid evenly among the columns
        rowHeight: 'match', // height of grid rows. 'match' will make it the same as the column width, a numeric value will be interpreted as pixels, '/2' is half the column width, '*5' is five times the column width, etc.
        margins: [10, 10], // margins in between grid items
        outerMargin: true,
        sparse: false, // "true" can increase performance of dragging and resizing for big grid (e.g. 20x50)
        isMobile: false, // toggle mobile view
        mobileBreakPoint: 600, // width threshold to toggle mobile mode
        mobileModeEnabled: true, // whether or not to toggle mobile mode when screen width is less than mobileBreakPoint
        minColumns: 1, // minimum amount of columns the grid can scale down to
        minRows: 1, // minimum amount of rows to show if the grid is empty
        maxRows: 100, // maximum amount of rows in the grid
        defaultSizeX: 2, // default width of an item in columns
        defaultSizeY: 1, // default height of an item in rows
        minSizeX: 1, // minimum column width of an item
        maxSizeX: null, // maximum column width of an item
        minSizeY: 1, // minimum row height of an item
        maxSizeY: null, // maximum row height of an item
        saveGridItemCalculatedHeightInMobile: false, // grid item height in mobile display. true- to use the calculated height by sizeY given
        resizable: { // options to pass to resizable handler
          enabled: true,
          handles: ['s', 'e', 'n', 'w', 'se', 'ne', 'sw', 'nw']
        },
        draggable: { // options to pass to draggable handler
          enabled: true,
          scrollSensitivity: 20, // Distance in pixels from the edge of the viewport after which the viewport should scroll, relative to pointer
          scrollSpeed: 15 // Speed at which the window should scroll once the mouse pointer gets within scrollSensitivity distance
        }
      }
    },
    computed: {
      previewStyle: {
        get() {
          if (!this.movingItem) {
            return {display: 'none'};
          }
          return {
            display: 'block',
            height: (this.movingItem.sizeY * this.curRowHeight - this.margins[0]) + 'px',
            width: (this.movingItem.sizeX * this.curColWidth - this.margins[1]) + 'px',
            top: (this.movingItem.row * this.curRowHeight + (this.outerMargin ? this.margins[0] : 0)) + 'px',
            left: (this.movingItem.col * this.curColWidth + (this.outerMargin ? this.margins[1] : 0)) + 'px'
          };
        }
      }
    },
    methods: {
      isVisible(el) {
        return el.style.visibility !== 'hidden' && el.style.display !== 'none';
      },
      updateHeight() {
        this.$el.style.height = (this.gridHeight * this.curRowHeight) + (this.outerMargin ? this.margins[0] : -this.margins[0]) + 'px';
      },
      refresh() {
        if (!this.isVisible(this.$el)) {
          return;
        }

        if (this.width === 'auto') {
          let value = parseInt(this.$el.style.width, 10);
          this.curWidth = this.$el.offsetWidth || (isNaN(value) ? 0 : value);
        } else {
          this.curWidth = this.width;
        }

        if (this.colWidth === 'auto') {
          this.curColWidth = (this.curWidth + (this.outerMargin ? -this.margins[1] : this.margins[1])) / this.columns;
        } else {
          this.curColWidth = this.colWidth;
        }

        this.curRowHeight = this.rowHeight;
        if (typeof this.rowHeight === 'string') {
          if (this.rowHeight === 'match') {
            this.curRowHeight = Math.round(this.curColWidth);
          } else if (this.rowHeight.indexOf('*') !== -1) {
            this.curRowHeight = Math.round(this.curColWidth * this.rowHeight.replace('*', '').replace(' ', ''));
          } else if (this.rowHeight.indexOf('/') !== -1) {
            this.curRowHeight = Math.round(this.curColWidth / this.rowHeight.replace('/', '').replace(' ', ''));
          }
        }

        this.isMobile = (this.mobileModeEnabled && this.curWidth <= this.mobileBreakPoint);

        for (let rowIndex = 0, l = this.grid.length; rowIndex < l; ++rowIndex) {
          let columns = this.grid[rowIndex];
          if (!columns) {
            continue;
          }
          for (let colIndex = 0, len = columns.length; colIndex < len; ++colIndex) {
            if (columns[colIndex]) {
              let item = columns[colIndex];
              item.setElementPosition();
              item.setElementSizeY();
              item.setElementSizeX();
            }
          }
        }
        this.updateHeight();
      },
      resize: GridsterDebounce(function () {
        if (this.movingItem) {
          return;
        }

        let value = parseInt(this.$el.style.width, 10);
        let width = this.$el.offsetWidth || (isNaN(value) ? 0 : value);
        if (width === this.prevWidth) {
          return;
        }

        this.prevWidth = width;

        if (this.isLoaded) {
          this.$el.classList.remove("gridster-resized");
        }

        this.refresh();

        if (this.isLoaded) {
          this.$el.classList.add("gridster-resized");
        }

        this.$emit("gridster-resized", this);
      }, 100),
      layoutChanged() {
        if (this.isLayoutChanging) {
          return;
        }
        this.isLayoutChanging = true;
        let that = this;
        setTimeout(function () {
          that.isLayoutChanging = false;
          if (that.isLoaded) {
            that.floatItemsUp();
          }
          that.updateHeightPlus(that.movingItem ? that.movingItem.sizeY : 0);
        }, 30);
      },

      /**
       * Check if item can occupy a specified position in the grid
       *
       * @param {Object} item The item in question
       * @param {Number} row The row index
       * @param {Number} column The column index
       * @returns {Boolean} True if if item fits
       */
      canItemOccupy(item, row, column) {
        return row > -1 && column > -1 && item.sizeX + column <= this.columns && item.sizeY + row <= this.maxRows;
      },

      /**
       * Set the item in the first suitable position
       *
       * @param {Object} item The item to insert
       */
      autoSetItemPosition(item) {
        // walk through each row and column looking for a place it will fit
        for (var rowIndex = 0; rowIndex < this.maxRows; ++rowIndex) {
          for (var colIndex = 0; colIndex < this.columns; ++colIndex) {
            // only insert if position is not already taken and it can fit
            var items = this.getItems(rowIndex, colIndex, item.sizeX, item.sizeY, item);
            if (items.length === 0 && this.canItemOccupy(item, rowIndex, colIndex)) {
              this.putItem(item, rowIndex, colIndex);
              return;
            }
          }
        }
        throw new Error('Unable to place item!');
      },

      /**
       * Gets items at a specific coordinate
       *
       * @param {Number} row
       * @param {Number} column
       * @param {Number} sizeX
       * @param {Number} sizeY
       * @param {Array} excludeItems An array of items to exclude from selection
       * @returns {Array} Items that match the criteria
       */
      getItems(row, column, sizeX, sizeY, excludeItems) {
        var items = [];
        if (!sizeX || !sizeY) {
          sizeX = sizeY = 1;
        }
        if (excludeItems && !(excludeItems instanceof Array)) {
          excludeItems = [excludeItems];
        }
        var item;
        if (this.sparse === false) { // check all cells
          for (var h = 0; h < sizeY; ++h) {
            for (var w = 0; w < sizeX; ++w) {
              item = this.getItem(row + h, column + w, excludeItems);
              if (item && (!excludeItems || excludeItems.indexOf(item) === -1) && items.indexOf(item) === -1) {
                items.push(item);
              }
            }
          }
        } else { // check intersection with all items
          var bottom = row + sizeY - 1;
          var right = column + sizeX - 1;
          for (var i = 0; i < this.allItems.length; ++i) {
            item = this.allItems[i];
            if (item && (!excludeItems || excludeItems.indexOf(item) === -1) && items.indexOf(item) === -1 && this.intersect(item, column, right, row, bottom)) {
              items.push(item);
            }
          }
        }
        return items;
      },

      /**
       * @param {Array} items
       * @returns {Object} An item that represents the bounding box of the items
       */
      getBoundingBox(items) {

        if (items.length === 0) {
          return null;
        }
        if (items.length === 1) {
          return {
            row: items[0].row,
            col: items[0].col,
            sizeY: items[0].sizeY,
            sizeX: items[0].sizeX
          };
        }

        var maxRow = 0;
        var maxCol = 0;
        var minRow = 9999;
        var minCol = 9999;

        for (var i = 0, l = items.length; i < l; ++i) {
          var item = items[i];
          minRow = Math.min(item.row, minRow);
          minCol = Math.min(item.col, minCol);
          maxRow = Math.max(item.row + item.sizeY, maxRow);
          maxCol = Math.max(item.col + item.sizeX, maxCol);
        }

        return {
          row: minRow,
          col: minCol,
          sizeY: maxRow - minRow,
          sizeX: maxCol - minCol
        };
      },

      /**
       * Checks if item intersects specified box
       *
       * @param {object} item
       * @param {number} left
       * @param {number} right
       * @param {number} top
       * @param {number} bottom
       */
      intersect(item, left, right, top, bottom) {
        return (left <= item.col + item.sizeX - 1 &&
        right >= item.col &&
        top <= item.row + item.sizeY - 1 &&
        bottom >= item.row);
      },

      /**
       * Removes an item from the grid
       *
       * @param {Object} item
       */
      removeItem(item) {
        var index;
        for (var rowIndex = 0, l = this.grid.length; rowIndex < l; ++rowIndex) {
          var columns = this.grid[rowIndex];
          if (!columns) {
            continue;
          }
          index = columns.indexOf(item);
          if (index !== -1) {
            columns[index] = null;
            break;
          }
        }
        if (this.sparse) {
          index = this.allItems.indexOf(item);
          if (index !== -1) {
            this.allItems.splice(index, 1);
          }
        }
        this.layoutChanged();
      },

      /**
       * Returns the item at a specified coordinate
       *
       * @param {Number} row
       * @param {Number} column
       * @param {Array} excludeItems Items to exclude from selection
       * @returns {Object} The matched item or null
       */
      getItem(row, column, excludeItems) {
        if (excludeItems && !(excludeItems instanceof Array)) {
          excludeItems = [excludeItems];
        }
        var sizeY = 1;
        while (row > -1) {
          var sizeX = 1,
            col = column;
          while (col > -1) {
            var items = this.grid[row];
            if (items) {
              var item = items[col];
              if (item && (!excludeItems || excludeItems.indexOf(item) === -1) && item.sizeX >= sizeX && item.sizeY >= sizeY) {
                return item;
              }
            }
            ++sizeX;
            --col;
          }
          --row;
          ++sizeY;
        }
        return null;
      },

      /**
       * Insert an array of items into the grid
       *
       * @param {Array} items An array of items to insert
       */
      putItems(items) {
        for (var i = 0, l = items.length; i < l; ++i) {
          this.putItem(items[i]);
        }
      },

      /**
       * Insert a single item into the grid
       *
       * @param {Object} item The item to insert
       * @param {Number} row (Optional) Specifies the items row index
       * @param {Number} column (Optional) Specifies the items column index
       * @param {Array} ignoreItems
       */
      putItem(item, row, column, ignoreItems) {
        // auto place item if no row specified
        if (typeof row === 'undefined' || row === null) {
          row = item.row;
          column = item.col;
          if (typeof row === 'undefined' || row === null) {
            this.autoSetItemPosition(item);
            return;
          }
        }

        // keep item within allowed bounds
        if (!this.canItemOccupy(item, row, column)) {
          column = Math.min(this.columns - item.sizeX, Math.max(0, column));
          row = Math.min(this.maxRows - item.sizeY, Math.max(0, row));
        }

        // check if item is already in grid
        if (item.oldRow !== null && typeof item.oldRow !== 'undefined') {
          var samePosition = item.oldRow === row && item.oldColumn === column;
          var inGrid = this.grid[row] && this.grid[row][column] === item;
          if (samePosition && inGrid) {
            item.row = row;
            item.col = column;
            return;
          } else {
            // remove from old position
            var oldRow = this.grid[item.oldRow];
            if (oldRow && oldRow[item.oldColumn] === item) {
              delete oldRow[item.oldColumn];
            }
          }
        }

        item.oldRow = item.row = row;
        item.oldColumn = item.col = column;

        this.moveOverlappingItems(item, ignoreItems);

        if (!this.grid[row]) {
          this.grid[row] = [];
        }
        this.grid[row][column] = item;

        if (this.sparse && this.allItems.indexOf(item) === -1) {
          this.allItems.push(item);
        }

        if (this.movingItem === item) {
          this.floatItemUp(item);
        }
        this.layoutChanged();
      },

      /**
       * Trade row and column if item1 with item2
       *
       * @param {Object} item1
       * @param {Object} item2
       */
      swapItems(item1, item2) {
        this.grid[item1.row][item1.col] = item2;
        this.grid[item2.row][item2.col] = item1;

        var item1Row = item1.row;
        var item1Col = item1.col;
        item1.row = item2.row;
        item1.col = item2.col;
        item2.row = item1Row;
        item2.col = item1Col;
      },

      /**
       * Prevents items from being overlapped
       *
       * @param {Object} item The item that should remain
       * @param {Array} ignoreItems
       */
      moveOverlappingItems(item, ignoreItems) {
        // don't move item, so ignore it
        if (!ignoreItems) {
          ignoreItems = [item];
        } else if (ignoreItems.indexOf(item) === -1) {
          ignoreItems = ignoreItems.slice(0);
          ignoreItems.push(item);
        }

        // get the items in the space occupied by the item's coordinates
        var overlappingItems = this.getItems(
          item.row,
          item.col,
          item.sizeX,
          item.sizeY,
          ignoreItems
        );
        this.moveItemsDown(overlappingItems, item.row + item.sizeY, ignoreItems);
      },

      /**
       * Moves an array of items to a specified row
       *
       * @param {Array} items The items to move
       * @param {Number} newRow The target row
       * @param {Array} ignoreItems
       */
      moveItemsDown(items, newRow, ignoreItems) {
        if (!items || items.length === 0) {
          return;
        }
        items.sort(function (a, b) {
          return a.row - b.row;
        });

        ignoreItems = ignoreItems ? ignoreItems.slice(0) : [];
        var topRows = {},
          item, i, l;

        // calculate the top rows in each column
        for (i = 0, l = items.length; i < l; ++i) {
          item = items[i];
          var topRow = topRows[item.col];
          if (typeof topRow === 'undefined' || item.row < topRow) {
            topRows[item.col] = item.row;
          }
        }

        // move each item down from the top row in its column to the row
        for (i = 0, l = items.length; i < l; ++i) {
          item = items[i];
          var rowsToMove = newRow - topRows[item.col];
          this.moveItemDown(item, item.row + rowsToMove, ignoreItems);
          ignoreItems.push(item);
        }
      },

      /**
       * Moves an item down to a specified row
       *
       * @param {Object} item The item to move
       * @param {Number} newRow The target row
       * @param {Array} ignoreItems
       */
      moveItemDown(item, newRow, ignoreItems) {
        if (item.row >= newRow) {
          return;
        }
        while (item.row < newRow) {
          ++item.row;
          this.moveOverlappingItems(item, ignoreItems);
        }
        this.putItem(item, item.row, item.col, ignoreItems);
      },

      /**
       * Moves all items up as much as possible
       */
      floatItemsUp() {
        if (this.floating === false) {
          return;
        }
        for (var rowIndex = 0, l = this.grid.length; rowIndex < l; ++rowIndex) {
          var columns = this.grid[rowIndex];
          if (!columns) {
            continue;
          }
          for (var colIndex = 0, len = columns.length; colIndex < len; ++colIndex) {
            var item = columns[colIndex];
            if (item) {
              this.floatItemUp(item);
            }
          }
        }
      },

      /**
       * Float an item up to the most suitable row
       *
       * @param {Object} item The item to move
       */
      floatItemUp(item) {
        if (this.floating === false) {
          return;
        }
        var colIndex = item.col,
          sizeY = item.sizeY,
          sizeX = item.sizeX,
          bestRow = null,
          bestColumn = null,
          rowIndex = item.row - 1;

        while (rowIndex > -1) {
          var items = this.getItems(rowIndex, colIndex, sizeX, sizeY, item);
          if (items.length !== 0) {
            break;
          }
          bestRow = rowIndex;
          bestColumn = colIndex;
          --rowIndex;
        }
        if (bestRow !== null) {
          this.putItem(item, bestRow, bestColumn);
        }
      },

      /**
       * Update gridsters height
       *
       * @param {Number} plus (Optional) Additional height to add
       */
      updateHeightPlus(plus) {
        var maxHeight = this.minRows;
        plus = plus || 0;
        for (var rowIndex = this.grid.length; rowIndex >= 0; --rowIndex) {
          var columns = this.grid[rowIndex];
          if (!columns) {
            continue;
          }
          for (var colIndex = 0, len = columns.length; colIndex < len; ++colIndex) {
            if (columns[colIndex]) {
              maxHeight = Math.max(maxHeight, rowIndex + plus + columns[colIndex].sizeY);
            }
          }
        }
        this.gridHeight = this.maxRows - maxHeight > 0 ? Math.min(this.maxRows, maxHeight) : Math.max(this.maxRows, maxHeight);
      },

      /**
       * Returns the number of rows that will fit in given amount of pixels
       *
       * @param {Number} pixels
       * @param {Boolean} ceilOrFloor (Optional) Determines rounding method
       */
      pixelsToRows(pixels, ceilOrFloor) {
        if (!this.outerMargin) {
          pixels += this.margins[0] / 2;
        }

        if (ceilOrFloor === true) {
          return Math.ceil(pixels / this.curRowHeight);
        } else if (ceilOrFloor === false) {
          return Math.floor(pixels / this.curRowHeight);
        }

        return Math.round(pixels / this.curRowHeight);
      },

      /**
       * Returns the number of columns that will fit in a given amount of pixels
       *
       * @param {Number} pixels
       * @param {Boolean} ceilOrFloor (Optional) Determines rounding method
       * @returns {Number} The number of columns
       */
      pixelsToColumns(pixels, ceilOrFloor) {
        if (!this.outerMargin) {
          pixels += this.margins[1] / 2;
        }

        if (ceilOrFloor === true) {
          return Math.ceil(pixels / this.curColWidth);
        } else if (ceilOrFloor === false) {
          return Math.floor(pixels / this.curColWidth);
        }

        return Math.round(pixels / this.curColWidth);
      }
    },
    watch: {
      isLoaded() {
        if (this.isLoaded) {
          this.$el.classList.add("gridster-loaded");
          this.$emit('gridster-loaded', this);
        } else {
          this.$el.classList.remove("gridster-loaded");
        }
      },
      isMobile(){
        if (this.isMobile) {
          this.$el.classList.add('gridster-mobile');
          this.$el.classList.remove('gridster-desktop');
        } else {
          this.$el.classList.remove('gridster-mobile');
          this.$el.classList.add('gridster-desktop');
        }
        if (this.options.hasOwnProperty("isMobile") && this.options.isMobile !== this.isMobile) {
          this.options.isMobile = this.isMobile;
        }
        this.$emit('gridster-mobile-changed', this);
      },
      gridHeight() {
        this.updateHeight();
      },
      movingItem() {
        this.updateHeightPlus(this.movingItem ? this.movingItem.sizeY : 0)
      },
      floating() {
        if (this.floating) {
          this.floatItemsUp();
        }
      },
      options: {
        handler(){
          Object.keys(this.options).forEach(key => {
            switch (key) {
              case "margins":
                if (this.options.margins.length !== 2) {
                  this.margins = [10, 10];
                } else {
                  for (let x = 0, l = this.options.margins.length; x < l; ++x) {
                    let value = parseInt(this.options.margins[x], 10);
                    this.margins[x] = (isNaN(value) ? 10 : value);
                  }
                }
                break;
              case "resizable":
              case "draggable":
                Object.assign(this[key], this.options[key]);
                break;
              default:
                this[key] = this.options[key];
                break;
            }
          });
          this.refresh();
        },
        deep: true
      },
      draggable: {
        handler(){
          this.$emit('gridster-draggable-changed', this);
        },
        deep: true
      },
      resizable: {
        handler(){
          this.$emit('gridster-resizable-changed', this);
        },
        deep: true
      },
    },
    mounted(){
      let that = this;
      let width = parseInt(this.$el.style.width, 10);
      this.prevWidth = this.$el.offsetWidth || (isNaN(width) ? 0 : width);
      this.$nextTick(function () {
        that.isLoaded = true;
        that.refresh();
        window.addEventListener('resize', this.resize);
      });
    },
    destroyed(){
      if (this.grid) {
        this.grid = [];
      }
      if (this.allItems) {
        this.allItems.length = 0;
        this.allItems = null;
      }
      window.removeEventListener('resize', this.resize);
    }
  }
</script>
