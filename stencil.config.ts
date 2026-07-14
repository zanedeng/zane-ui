import { Config } from '@stencil/core';
import { sass } from '@stencil/sass';
import nodePolyfills from 'rollup-plugin-node-polyfills';

export const config: Config = {
  buildEs5: false,
  devServer: {
    openBrowser: false,
  },
  sourceMap: true,
  // 启用动态导入
  enableCache: true,
  extras: {
    // fixes VitePress doc build
    enableImportInjection: true,
  },
  globalScript: 'src/global.ts',
  globalStyle: 'src/global/theme/index.scss',
  namespace: 'zane-ui',
  outputTargets: [
    {
      copy: [{ src: 'assets' }],
      esmLoaderPath: '../loader',
      type: 'dist',
    },
    {
      customElementsExportBehavior: 'auto-define-custom-elements',
      generateTypeDeclarations: false,
      type: 'dist-custom-elements',
    },
    {
      serviceWorker: null, // disable service workers
      type: 'www',
    },
  ],
  plugins: [sass(), nodePolyfills()],
  rollupConfig: {
    inputOptions: {
      external: ['@zanejs/icons'], // 将外部包标记为外部依赖
    },
  },
  taskQueue: 'async',
  testing: {
    browserHeadless: 'shell',
  },
};
