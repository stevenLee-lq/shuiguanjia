import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    // 适配 GitHub Pages 的基础路径（须与仓库名一致，前后斜杠不可省略）
    base: '/shuiguanjia/',
    plugins: [react(), tailwindcss()],
    define: {
      // 未设置时须为 ""，避免 JSON.stringify(undefined) 导致运行时代码异常 + SDK 在浏览器中无 key 时抛错白屏
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY ?? ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      /** 监听 0.0.0.0：同局域网内其它设备可通过「本机局域网 IP:端口」访问（不等于公网） */
      host: true,
      port: 3001,
      strictPort: false,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
