<template>
  <div class="gridster-item"><slot></slot></div>
</template>
<script>
  import {GridsterDraggable, GridsterResizable} from "./vue-gridster-utils"
  export default {
    name: "gridster-item",
    props: {
      item: {type: Object, required: true}
    },
    data(){
      return {
        row: this.item.row,
        col: this.item.col,
        sizeX: this.item.sizeX || this.gridster.defaultSizeX,
        sizeY: this.item.sizeY || this.gridster.defaultSizeY,
        minSizeX: this.item.minSizeX || 0,
        minSizeY: this.item.minSizeY || 0,
        maxSizeX: this.item.maxSizeX || null,
        maxSizeY: this.item.maxSizeY || null,
      }
    },
    watch: {
      item: {
        handler(){
          this.aspects.forEach(key => {
            if (this.item.hasOwnProperty(key) && this.item[key] !== this[key]) {
              const value = parseInt(this.item[key], 10);
              if (!isNaN(value)) {
                this[key] = this.item[key];
              }
            }
          });
        },
        deep: true
      },
    },
    methods: {
      init() {
        this.aspects = ['minSizeX', 'maxSizeX', 'minSizeY', 'maxSizeY', 'sizeX', 'sizeY', 'row', 'col'];
        let watch = (props, watcher) => {
          const iterator = function (prop) {
            this.$watch(prop, watcher, {immediate: true});
          };
          props.forEach(iterator, this);
        };
        watch(['row', 'col'], this.positionChanged);
        watch(['sizeX', 'sizeY', 'minSizeX', 'minSizeY', 'maxSizeX', 'maxSizeY'], this.sizeChanged);

        const that = this;
        const draggable = new GridsterDraggable(this);
        const updateDraggable = function () {
          draggable.toggle(!that.gridster.isMobile && that.gridster.draggable && that.gridster.draggable.enabled);
        };
        updateDraggable();

        const resizable = new GridsterResizable(this);
        const updateResizable = function () {
          resizable.toggle(!that.gridster.isMobile && that.gridster.resizable && that.gridster.resizable.enabled);
        };
        updateResizable();

        this.gridster.$on('gridster-draggable-changed', updateDraggable);
        this.gridster.$on('gridster-resizable-changed', updateResizable);
        this.gridster.$on('gridster-resized', updateResizable);
        this.gridster.$on('gridster-mobile-changed', function () {
          updateResizable();
          updateDraggable();
        });

        this.$emit('gridster-item-initialized', this);
      },
      isMoving() {
        return this.gridster.movingItem === this;
      },
      sizeChanged() {
        let changedX = this.setSizeX(this.sizeX, true);
        if (changedX && this.sizeX !== this.item.sizeX) {
          this.item.sizeX = this.sizeX;
        }
        let changedY = this.setSizeY(this.sizeY, true);
        if (changedY && this.sizeY !== this.item.sizeY) {
          this.item.sizeY = this.sizeY;
        }
        if (changedX || changedY) {
          this.gridster.moveOverlappingItems(this);
          this.gridster.layoutChanged();
          this.$emit('gridster-item-resized', this);
        }
      },
      positionChanged() {
        this.setPosition(this.row, this.col);
        if (this.row !== this.item.row) {
          this.item.row = this.row;
        }
        if (this.col !== this.item.col) {
          this.item.col = this.col;
        }
      },
      setPosition(row, column) {
        this.gridster.putItem(this, row, column);

        if (!this.isMoving()) {
          this.setElementPosition();
        }
      },
      setSize(key, value, preventMove) {
        key = key.toUpperCase();
        var camelCase = 'size' + key,
          titleCase = 'Size' + key;
        if (value === '') {
          return;
        }
        value = parseInt(value, 10);
        if (isNaN(value) || value === 0) {
          value = this.gridster['default' + titleCase];
        }
        var max = key === 'X' ? this.gridster.columns : this.gridster.maxRows;
        if (this['max' + titleCase]) {
          max = Math.min(this['max' + titleCase], max);
        }
        if (this.gridster['max' + titleCase]) {
          max = Math.min(this.gridster['max' + titleCase], max);
        }
        if (key === 'X' && this.cols) {
          max -= this.cols;
        } else if (key === 'Y' && this.rows) {
          max -= this.rows;
        }

        var min = 0;
        if (this['min' + titleCase]) {
          min = Math.max(this['min' + titleCase], min);
        }
        if (this.gridster['min' + titleCase]) {
          min = Math.max(this.gridster['min' + titleCase], min);
        }

        value = Math.max(Math.min(value, max), min);

        var changed = (this[camelCase] !== value || (this['old' + titleCase] && this['old' + titleCase] !== value));
        this['old' + titleCase] = this[camelCase] = value;

        if (!this.isMoving()) {
          this['setElement' + titleCase]();
        }
        if (!preventMove && changed) {
          this.gridster.moveOverlappingItems(this);
          this.gridster.layoutChanged();
        }

        return changed;
      },
      setSizeY(rows, preventMove) {
        return this.setSize('Y', rows, preventMove);
      },
      setSizeX(columns, preventMove) {
        return this.setSize('X', columns, preventMove);
      },
      setElementPosition() {
        if (this.gridster.isMobile) {
          this.$el.style.top = null;
          this.$el.style.left = null;
          this.$el.style.marginTop = this.gridster.margins[1] + 'px';
          this.$el.style.marginRight = this.gridster.margins[0] + 'px';
          this.$el.style.marginBottom = this.gridster.margins[1] + 'px';
          this.$el.style.marginLeft = this.gridster.margins[0] + 'px';
        } else {
          this.$el.style.top = (this.row * this.gridster.curRowHeight + (this.gridster.outerMargin ? this.gridster.margins[0] : 0)) + 'px';
          this.$el.style.left = (this.col * this.gridster.curColWidth + (this.gridster.outerMargin ? this.gridster.margins[1] : 0)) + 'px';
          this.$el.style.margin = 0;
        }
      },
      setElementSizeY() {
        if (this.gridster.isMobile && !this.gridster.saveGridItemCalculatedHeightInMobile) {
          this.$el.style.height = null;
        } else {
          this.$el.style.height = (this.sizeY * this.gridster.curRowHeight - this.gridster.margins[0]) + 'px';
        }
      },
      setElementSizeX() {
        if (this.gridster.isMobile) {
          this.$el.style.width = null;
        } else {
          this.$el.style.width = (this.sizeX * this.gridster.curColWidth - this.gridster.margins[1]) + 'px';
        }
      }
    },
    mounted(){
      this.gridster = this.$parent;
      if (this.gridster.isLoaded) {
        this.init();
      } else {
        this.gridster.$on("gridster-loaded", this.init);
      }
    },
    destroyed(){
      if (this.gridster) {
        this.gridster = null;
      }
    }
  }
</script>
