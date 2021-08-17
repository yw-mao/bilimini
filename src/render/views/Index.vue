
<template>
  <a-layout>
    <a-layout-header
      :class="{ active: isMeunActive }"
    >bilimini</a-layout-header>
    <a-layout-content>
      <a-spin :spinning="loading">
      <webview
        id="wv"
        ref="wv"
        :src="initUrl"
        :useragent="userAgent.mobile"
        nodeintegration
        disablewebsecurity
      ></webview>
      </a-spin>
    </a-layout-content>
  </a-layout>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { Layout } from 'ant-design-vue';
const { ipcRenderer } = require('electron');
// const path = require('path');
const { screen, getCurrentWindow } = require('electron').remote;

interface IndexDataType {
  loading: boolean;
  isMeunActive: boolean;
  currentWindowType: string;
  enableGoBack: boolean;
  enableGoForward: boolean;
  mouseStateDirtyCheckInterval?: NodeJS.Timeout;
  userAgent: {
    desktop: string;
    mobile: string;
  },
  webview?: Electron.WebviewTag,
  initUrl: string;
  history: {
    stack: string[],
    pos: number,
    lastTarget: string;
    lastLoadedUrl?: string;
  };
}

export default defineComponent({
	name: "Index",
	components: {
    Layout,
	},
  data(): IndexDataType {
    return {
      isMeunActive: false,
      loading: true,
      currentWindowType: 'default',
      enableGoBack: false,
      enableGoForward: true,
      mouseStateDirtyCheckInterval: undefined,
      userAgent: {
        desktop: 'bilimini Desktop like Mozilla/233 (Windows NT or OSX) AppleWebKit like Gecko or not (Chrome and Safari both OK)',
        mobile: 'bilimini Mobile like (iPhone or Android) whatever AppleWebKit/124.50 Mobile/BI233'
      },
      initUrl: 'https://m.bilibili.com/index.html',
      history: {
        stack: [ 'https://m.bilibili.com/index.html' ],
        pos: 0,
        lastTarget: '', // 这是最后一次传入go方法的url
        lastLoadedUrl: '', // 这是最后一次webview实际加载完成的url，这个是在下面webview的did-finish-load事件的时候更新的
      }
    };
  },
  mounted() {
    this.initActionOnWebviewNavigate();
    this.initMouseStateDirtyCheck();
  },
  beforeUnmount() {
    // 写在组件清除定时器
    if (this.mouseStateDirtyCheckInterval) {
      clearInterval(this.mouseStateDirtyCheckInterval);
    }
  },
  methods: {
    // 浏览器初始化
    initActionOnWebviewNavigate() {
      this.webview = this.$refs.wv as Electron.WebviewTag

      // 判断是否能前进/后退
      this.webview.addEventListener('did-finish-load', () => {
        const url = this.webview?.getURL();
        if (!url) {
          return;
        }
        console.log(`触发 did-finish-load 事件，当前url是: ${url}`)
        this.enableGoBack = this.canGoBack();
        this.enableGoForward = this.canGoForward();
        // 改变窗口尺寸
        this.resizeMainWindow(url);
        // 把当前webview的实际url记录下来
        this.history.lastLoadedUrl = url;
        // 关闭loading遮罩
        this.loading = false;
      });

      // this.webview.addEventListener('dom-ready', () => {
      //   if (!this.webview) {
      //     return;
      //   }
      //   // TODO: 开发环境临时处理，待优化
      //   const preloadFile = path.join(global.__dirname, '../../../../../../../../bundle/preload/build.js');
      //   // this.webview.loadURL('https://m.bilibili.com', {
      //   //   userAgent: this.userAgent.mobile,
      //   // });
      //   this.webview.setAttribute('preload', `file://${preloadFile}`);
      // });
      // this.webview.addEventListener('did-finish-load', (e) => {
      //   // webview.openDevTools();
      // });
    },
    push(target: string, noNewHistory: any) {
      // 防止重复加载同页面
      if (target == this.history.lastTarget ) {
        return false;
      }
      this.history.lastTarget = target;
      // 显示loading mask

      return true;
    },
    canGoBack() {
      return this.history.pos > 0;
    },
    canGoForward() {
      return this.history.pos + 1 < this.history.stack.length;
    },
    async resizeMainWindow(url: string) {
      let targetWindowType;
      if (url.indexOf('/video/') > -1 || url.indexOf('html5player.html') > -1 ||
        /\/\/live\.bilibili\.com\/blanc\/\d+/.test(url) || url.indexOf('bangumi/play/') > -1
      ) {
        targetWindowType = 'windowSizeMini';
      } else if( url.indexOf('t.bilibili.com/?tab=8') > -1 ) {
        targetWindowType = 'windowSizeFeed';
      } else {
        targetWindowType = 'windowSizeDefault';
      }
      if (targetWindowType != this.currentWindowType ) {
        const mw = getCurrentWindow();
        const currentSize = mw.getSize();
        const leftTopPosition = mw.getPosition();
        const rightBottomPosition = [leftTopPosition[0] + currentSize[0], leftTopPosition[1] + currentSize[1]];
        const targetSize = await ipcRenderer.invoke('store:get', targetWindowType) || [300, 187];
        const targetPosition = [rightBottomPosition[0] - targetSize[0], rightBottomPosition[1] - targetSize[1]];
        
        // 以窗口右下角为基点变换尺寸，但是要保证左上角不会到屏幕外去
        targetPosition[0] = targetPosition[0] > 10 ? targetPosition[0] : 10;
        targetPosition[1] = targetPosition[1] > 10 ? targetPosition[1] : 10;

        mw.setBounds({
          x: targetPosition[0],
          y: targetPosition[1],
          width: targetSize[0],
          height: targetSize[1]
        }, true);

        this.currentWindowType = targetWindowType;

        // 通知设置窗口改变位置
        ipcRenderer.send('main-window:resized', targetPosition, targetSize);
      }
    },
    getTriggerAreaWidth(lastStatus: 'IN' | 'OUT') {
      return lastStatus === 'IN' ? 0 : 16;
    },
    // 如果topbar已经下来了，就主动把触发区域变高一点，防止鼠标稍微向下滑动就触发收起
    getTriggerAreaHeight(lastStatus: 'IN' | 'OUT', windowHeight: number) {
      const h = 0.1 * windowHeight;
      const  minHeight = lastStatus === 'IN' ? 120 : 36; 
      return h > minHeight ? h : minHeight;
    },
    // windows下frameless window没法正确检测到mouseout事件，只能根据光标位置做个dirtyCheck了
    initMouseStateDirtyCheck() {
      // 统一改为由js判断，一旦鼠标进入主窗口的上较近才显示topbar
      const getMousePosition = screen.getCursorScreenPoint;
      const mw = getCurrentWindow();
      let lastStatus: 'IN' | 'OUT' = 'OUT';

      this.mouseStateDirtyCheckInterval = setInterval(() => {
        const mousePos = getMousePosition();
        const windowPos = mw.getPosition();
        const windowSize = mw.getSize();
        // 在窗口最右边留出滚动条的宽度，用户操作滚动条时不会触发showTopbar；
        // 但是如果showTopbar已经触发，即用户已经在操作工具栏了，那么就暂时屏蔽这个规则
        if ((mousePos.x > windowPos[0]) && (mousePos.x < windowPos[0] + windowSize[0] - this.getTriggerAreaWidth(lastStatus)) &&
        (mousePos.y > windowPos[1]) && (mousePos.y < windowPos[1] + this.getTriggerAreaHeight(lastStatus, windowSize[1])) ) {
          if (lastStatus === 'OUT') {
            this.isMeunActive = true;
            lastStatus = 'IN';
          }
        } else if (lastStatus === 'IN') {
          lastStatus = 'OUT';
          this.isMeunActive = false;
        }
      }, 200);
    }
  }
})
</script>

<style lang="less">
.ant-layout,
.ant-spin-nested-loading,
.ant-spin-container {
  height: 100%;
}
.ant-layout-header {
  width: 100%;
  background: #FB7299;
  height: 0;
  line-height: 32px;
  color: #fff;
  transition: height 0.4s ease;
  -webkit-app-region: drag;
  overflow: hidden;
  &.active {
    height: 32px;
  }
}
.ant-layout-content {
  height: 100%;
}
#wv {
  height: 100%;
}
</style>