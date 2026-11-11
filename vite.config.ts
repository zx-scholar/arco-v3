import { resolve } from 'path';
import { pluginsList } from './config';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const { VITE_PORT, VITE_BASE, VITE_LEGACY_BASE_URL, LEGACY_COOKIE } = loadEnv(
    mode,
    process.cwd(),
    ['VITE_', 'LEGACY_']
  );

  return {
    base: VITE_BASE,
    // 路径别名
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        'assets': resolve(__dirname, 'src/assets'),
        'vue': 'vue/dist/vue.esm-bundler.js' // compile template
      }
    },
    css: {
      preprocessorOptions: {
        less: {
          modifyVars: {
            hack: `true; @import (reference) "${resolve('src/assets/style/variables.less')}";`
          },
          // https://lesscss.org/usage/#less-options
          math: 'parens-division',
          javascriptEnabled: true
        }
      }
    },
    plugins: [pluginsList()],
    // 依赖预构建-> https://cn.vitejs.dev/config/dep-optimization-options#dep-optimization-options
    optimizeDeps: {
      include: ['mitt', 'dayjs', 'axios', 'pinia', '@vueuse/core'],
      exclude: ['@iconify-icons/lets-icons']
    },
    server: {
      // 允许跨域
      cors: true,
      // 监听所有地址
      host: '0.0.0.0',
      // 服务启动时是否自动打开浏览器
      open: true,
      // 端口号（这里使用了变量 VITE_PORT）
      port: Number(VITE_PORT),
      // 本地跨域代理-> 代理到服务器的接口地址
      proxy: {
        // 老系统（aisports-web）未开启 CORS，开发环境统一走本地代理
        '/legacy-api': {
          target: VITE_LEGACY_BASE_URL,
          changeOrigin: true,
          rewrite: path => path.replace(/^\/legacy-api/, ''),
          // 老系统鉴权依赖 SESSION Cookie，浏览器不会把 webtest 域的 Cookie 带到 localhost，
          // 这里从 .env 注入一份（仅本地开发用，值需自行从 DevTools 复制）
          configure: proxy => {
            proxy.on('proxyReq', proxyReq => {
              // 保留浏览器发往 localhost 的 Cookie，再叠加 .env 注入的那份
              const incoming = proxyReq.getHeader('cookie');
              const cookie = [LEGACY_COOKIE, incoming].filter(Boolean).join('; ');
              if (cookie) proxyReq.setHeader('cookie', cookie);
            });
          }
        }
      },
      // 预热文件以降低启动期间的初始页面加载时长
      warmup: {
        // 预热的客户端文件：首页、views、 components
        clientFiles: ['./index.html', './src/{views,components}/*']
      }
    },
    build: {
      // 浏览器兼容目标
      target: 'es2015',
      // 是否生成 source map 文件
      sourcemap: false,
      rollupOptions: {
        output: {
          entryFileNames: 'static/js/[name]-[hash].js',
          chunkFileNames: 'static/js/[name]-[hash].js',
          assetFileNames: 'static/[ext]/[name]-[hash].[ext]',
          compact: true,
          // 自定义 chunk
          manualChunks: {
            arco: ['@arco-design/web-vue'],
            chart: ['@visactor/vchart'],
            vue: ['vue', 'vue-router', 'pinia', '@vueuse/core']
          }
        }
      },
      // chunk 大小警告的限制
      chunkSizeWarningLimit: 2000
    }
  };
});
