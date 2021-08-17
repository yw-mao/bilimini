
<template>
  <a-layout>
    <a-layout-header
      :class="{ active: isMeunActive }"
    >bilimini</a-layout-header>
    <a-layout-content>
      <webview id="wv" ref="wv" src="https://m.bilibili.com/index.html" useragent="bilimini Mobile like (iPhone or Android) whatever AppleWebKit/124.50 Mobile/BI233" nodeintegration disablewebsecurity
      ></webview>
    </a-layout-content>
  </a-layout>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { Layout } from 'ant-design-vue';
const path = require('path');
export default defineComponent({
	name: "Index",
	components: {
    Layout,
	},
  data() {
    return {
      isMeunActive: false,
    };
  },
  mounted() {
    const webview = this.$refs.wv as Electron.WebviewTag
    // TODO: 开发环境临时处理，待优化
    const preloadFile = path.join(global.__dirname, '../../../../../../../../bundle/preload/build.js');
    webview.setAttribute('preload', `file://${preloadFile}`);
    webview.addEventListener('did-finish-load', (e) => {
      webview.openDevTools();
    });
    webview.addEventListener('ipc-message', (event) => {
      if (event.channel === 'isMeunActive') {
        this.isMeunActive = event.args[0];
        return;
      }
    })
  },
  methods: {
    enter() {
      console.log(1);
      this.isMeunActive = true;
    },
    leave() {
      console.log(2);
      this.isMeunActive = false;
    },
    updatexy(event: { offsetY: any; }) {
      console.log(event.offsetY)
    }
  }
})
</script>

<style lang="less">
.ant-layout {
  height: 100%;
}
.ant-layout-header {
  width: 100%;
  background: #FB7299;
  height: 0;
  line-height: 32px;
  color: #fff;
  transition: height 0.4s ease;

  &.active {
    height: 32px;
  }
}
.ant-layout-content {
  height: 100%;
}
#wv {
  -webkit-app-region: drag;
  height: 100%;
}
</style>