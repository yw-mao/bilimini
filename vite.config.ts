/**
 * 参考链接: https://vitejs.dev/config/
 */
import { join } from 'path'
import { UserConfig } from 'vite'
import dotenv from 'dotenv'
import vue from '@vitejs/plugin-vue'
import ViteComponents, { AntDesignVueResolver } from 'vite-plugin-components';

dotenv.config({ path: join(__dirname, '.env') })
const root = join(__dirname, 'src/render')

const config: UserConfig = {
  root,
  resolve: {
    alias: {
      '/@': root,
    },
  },
  css: {
    preprocessorOptions: {
      // 全站样式预处理
      less: {
        modifyVars: {
          'layout-header-background': '#FB7299',
          'primary-color': '#FB7299',
          'link-color': '#00A1D6',
        },
        javascriptEnabled: true,
      }
    }
  },
  base: './',
  build: {
    outDir: join('../../bundle/render'),
    emptyOutDir: true
  },
  server: {
    port: +(process.env.PORT || 8899),
  },
  plugins: [
    vue(),
    ViteComponents({
      customComponentResolvers: [AntDesignVueResolver()],
    }),
  ],
  optimizeDeps: {
    exclude: [
      'electron-is-dev',
      'electron-store',
    ]
  },
}

export default config
