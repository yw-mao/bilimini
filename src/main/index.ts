import { app, BrowserView, BrowserWindow, dialog, globalShortcut, ipcMain } from 'electron';
import is_dev from 'electron-is-dev';
import Store from 'electron-store';
import { join } from 'path';
import { Config } from './config';

// TODO: 崩溃日志自动反馈
// process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
// process.on('uncaughtException', (err) => {
//   console.error('主线程意外报错', err);
//   dialog.showErrorBox('肥肠抱歉', 
//     '好像似乎也许可能出现了意料之外的错误，我建议您现在关闭程序并到bilimini的根目录下找到一个名为bilimini.log的文件，并把这个文件通过电子邮件发送给我：i@thec.me。\n这份文件会帮助我了解您的程序在进行什么操作时出现了问题，因此它会包含您最近一次运行bilimini的浏览记录，如果您介意也可以选择不发送。_(:з」∠)_');
// });

let mainWindow: BrowserWindow | null = null;

const store = new Store<Config>()
ipcMain.on('store:set', async (e, args) => {
  store.set(args.key, args.value);
})
ipcMain.handle('store:get', async (e, args) => {
  const value = await store.get(args)
  return value;
})
ipcMain.on('store:delete', async (e, args) => {
  store.delete(args)
});
// 更新隐藏快捷键
ipcMain.on('hide-shortcut:update', (ev, args) => {
  globalShortcut.unregister(args);
  bindGlobalShortcut(true);
});

// 创建浏览器窗口
const createWindow = async () => {

  // 根据透明度设置决定是否要创建transparent窗口
  // 不论在windows还是在mac下，正常窗口都会比transparent窗口多一个好看的阴影
  // 所以我们不希望为了方便始终使用transparent
  const opacity = store.get('opacity'); // 获取透明度配置
  const windowParams = {
    width: 375,
    height: 500,
    frame: false,
    resizable: true,
    transparent: !!(opacity < 1),
    webPreferences: {
      webviewTag: true,
      contextIsolation: false,
      nodeIntegration: true,
      nodeIntegrationInWorker: true,
      nodeIntegrationInSubFrames: true,
      enableRemoteModule: true
    },
  };
  mainWindow = new BrowserWindow(windowParams);

  const URL = is_dev
      ? `http://localhost:${process.env.PORT}` // vite 启动的服务器地址
      : `file://${join(__dirname, '../../bundle/render/index.html')}` // vite 构建后的静态文件地址
  mainWindow.loadURL(URL);
  mainWindow.setAlwaysOnTop(true, 'torn-off-menu'); // 始终置于顶部
  // const view = new BrowserView({
  //   webPreferences: {
  //     preload: `file://${join(__dirname, '../../bundle/preload/build.js')}`
  //   }
  // })
  // mainWindow.setBrowserView(view);
  // view.setBounds({ x: 0, y: 0, width: 375, height: 500 });
  // view.setAutoResize({
  //   width: true,
  //   height: true,
  // })
  // view.webContents.loadURL('https://m.bilibili.com', {
  //   userAgent: 'bilimini Mobile like (iPhone or Android) whatever AppleWebKit/124.50 Mobile/BI233',
  // });
  // view.webContents.executeJavaScriptInIsolatedWorld(0, [{
  //   code: 'test',
  //   url: `file://${join(__dirname, '../../bundle/preload/build.js')}`
  // }])


  // TODO: 验证是否必要性
  // 主窗口关闭后如果3s都没有重新创建，就认为程序是被不正常退出了（例如windows下直接alt+f4），关闭整个程序
  // mainWindow.on('closed', () => {
  //   mainWindow = null;
  // });

  // 测试环境自动打开调试工具
  if (is_dev) {
    mainWindow.webContents.openDevTools();
    // view.webContents.openDevTools();
  }
  console.log('主窗口：已创建');
};

// 全局按键注册
const bindGlobalShortcut = (isUpdate: boolean = false) => {
  console.log(`老板键：开始注册，isUpdate: ${!!isUpdate}`);
  const shortcut = store.get('hideShortcut') || 'alt + w';
  const bindResult = globalShortcut.register(shortcut, () => {
    if (!mainWindow) {
      return createWindow();
    }

    if (mainWindow.isVisible()) {
      return mainWindow.hide();
    }
    return mainWindow.showInactive()
  });
  if (!bindResult) {
    console.log('老板键：注册失败');
    dialog.showErrorBox(`修改老板键失败，「${shortcut}」可能不能用作全局快捷键或已被其他程序占用`, '');
    return false;
  }
  if (isUpdate) {
    // 通过设置页面修改快捷键成功时弹个窗提示修改成功
    dialog.showMessageBox({
      type: 'info',
      message: `修改成功，老板键已替换为「${shortcut}」`
    });
  }
  console.log('老板键：注册成功');
  return true;
}

app.whenReady()
  // .then(() => bindGlobalShortcut()) // 注册按键
  .then(createWindow) // 创建主窗体
  .catch((e) => console.error('Failed create window:', e));

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
});