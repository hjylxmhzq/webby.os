const path = require('path');
const fs = require('fs');

const srcAlias = {
  "src": path.resolve(__dirname, './src'),
};

const dirs = fs.readdirSync('./src');
dirs.forEach(dir => {
  srcAlias['@' + dir] = path.resolve(__dirname, './src', dir);
});

const isProd = process.env.NODE_ENV === 'production';
const emitSourceMap = isProd ? false : 'source-map';
const pages = fs.readdirSync('./src/isolate-pages');
const outputDir = path.resolve(__dirname, '../server/static');

if (isProd && fs.existsSync(outputDir)) {
  fs.rmSync(outputDir, { recursive: true, force: true });
}

const pageEntries = pages.reduce((prev, file) => {
  let entryName = file.split('.')[0];
  return {
    ...prev,
    [entryName]: path.join(__dirname, 'src/isolate-pages', file),
  }
}, {
  index: path.join(__dirname, 'src/index.tsx'),
});

const htmlWithChuncks = Object.keys(pageEntries).map(name => {
  return {
    chunks: [name],
    filename: `${name}.html`,
    template: path.join(__dirname, 'public/index.html')
  };
});

const entries = {
  ...pageEntries,
}

module.exports = {
  entry: entries,
  output: {
    filename: 'assets/[name]_[hash].js',
    path: outputDir,
    publicPath: '/',
  },
  // externals: {
  //   react: 'React',
  // },
  resolve: {
    alias: {
      ...srcAlias
    }
  },
  module: {
    rules: [
      {
        test: /\.module\.less$/,
        type: "css/module",
        use: [
          {
            loader: 'less-loader',
            options: {
              lessOptions: {

              },
            },
          },
        ],
      },
      {
        test: /\.less$/,
        exclude: /\.module\.less$/,
        use: [
          {
            loader: 'less-loader',
            options: {
              lessOptions: {

              },
            },
          },
        ],
        type: 'css',
      },
    ],
  },
  builtins: {
    copy: {
      patterns: [
        {
          from: './public/favicon.ico',
        },
        {
          from: './public/manifest.json',
        },
        {
          from: './public/robots.txt',
        },
      ],
    },
    html: htmlWithChuncks,
    define: {
      'import.meta.env': "{}",
      'process.env.APP_BASE_URL': JSON.stringify('/'),
    },
  },
  devtool: emitSourceMap,
  devServer: {
    proxy: {
      '/kv_storage': {
        target: 'http://127.0.0.1:7001',
        changeOrigin: true,
      },
      '/login': {
        target: 'http://127.0.0.1:7001',
        changeOrigin: true,
      },
      '/system_info': {
        target: 'http://127.0.0.1:7001',
        changeOrigin: true,
      },
      '/shell/start': {
        target: 'ws://127.0.0.1:7001',
        changeOrigin: true,
        ws: true,
      },
      '/kv_storage/subscribe': {
        target: 'ws://127.0.0.1:7001',
        changeOrigin: true,
        ws: true,
      },
      '/websocket/*': {
        target: 'ws://127.0.0.1:7001',
        changeOrigin: true,
        ws: true,
      },
      '/log': {
        target: 'http://127.0.0.1:7001',
        changeOrigin: true,
      },
      '/file': {
        target: 'http://127.0.0.1:7001',
        changeOrigin: true,
      },
      '/tunnel': {
        target: 'http://127.0.0.1:7001',
        changeOrigin: true,
      },
      '/apps': {
        target: 'http://127.0.0.1:7001',
        changeOrigin: true,
      },
      '/assets': {
        target: 'http://127.0.0.1:7001',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://127.0.0.1:7001',
        changeOrigin: true,
      },
    },
  },
};