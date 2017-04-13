<template>
  <div class="demo">
    <div>
      <input type="checkbox" v-model="options.draggable.enabled"> 拖拽
        <input type="checkbox" v-model="options.resizable.enabled"> 缩放
        <input type="checkbox" v-model="options.pushing"> 推挤
        <input type="checkbox" v-model="options.floating"> 上浮
        <input type="checkbox" v-model="options.swapping"> 交换
        ；视图
        <select v-model="options.mobileBreakPoint">
      <option :value="600">自动</option>
      <option :value="Number.MAX_VALUE">移动</option>
      <option :value="Number.MIN_VALUE">桌面</option>
    </select>
      ；边距
      <input type="text" v-model.number="options.margins[0]" size="2"/>x
        <input type="text" v-model.number="options.margins[1]" size="2"/>
    </div>
    <gridster :options="options">
      <gridster-item v-for="(item, index) in items" :item="item" :key="index">
        <input type="text" v-model.number="item.row" size="1"/>,
        <input type="text" v-model.number="item.col" size="1"/>
        <br/>
        <input type="text" v-model.number="item.sizeX" size="1"/>x
        <input type="text" v-model.number="item.sizeY" size="1"/>
      </gridster-item>
    </gridster>
  </div>
</template>

<script>
  import "../components/vue-gridster.css"
  import Gridster from "../components/vue-gridster.vue"
  import GridsterItem from "../components/vue-gridster-item.vue"
  export default {
    name: 'demo',
    components: {Gridster,GridsterItem},
    data(){
      return {
        items: [
          {sizeX: 2, sizeY: 1, row: 0, col: 0},
          {sizeX: 2, sizeY: 2, row: 0, col: 2},
          {sizeX: 2, sizeY: 1, row: 2, col: 1},
          {sizeX: 1, sizeY: 1, row: 2, col: 3},
          {sizeX: 1, sizeY: 1, row: 2, col: 4},
          {sizeX: 1, sizeY: 1, row: 0, col: 4},
          {sizeX: 1, sizeY: 1, row: 0, col: 5},
          {sizeX: 2, sizeY: 1, row: 1, col: 0},
          {sizeX: 1, sizeY: 1, row: 1, col: 4},
          {sizeX: 1, sizeY: 2, row: 1, col: 5},
          {sizeX: 1, sizeY: 1, row: 2, col: 0}
        ],
        options: {
          margins: [10, 10],
          isMobile: false,
          pushing: true,
          floating: true,
          swapping: false,
          mobileBreakPoint: 600,
          draggable: {enabled: true},
          resizable: {enabled: true}
        }
      }
    }
  }
</script>
<style>
  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    background: #004756;
    color: #fff;
    margin: 100px;
  }

  .gridster .gridster-item {
    -webkit-box-shadow: 0 0 5px rgba(0, 0, 0, 0.3);
    -moz-box-shadow: 0 0 5px rgba(0, 0, 0, 0.3);
    box-shadow: 0 0 5px rgba(0, 0, 0, 0.3);
    color: #004756;
    background: #ffffff;
    padding: 10px;
  }
</style>
