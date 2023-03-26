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
    [entryName]: path.join('./src/isolate-pages', file),
  }
}, {
  index: './src/index.tsx',
});

const htmlWithChuncks = Object.keys(pageEntries).map(name => {
  return {
    chunks: [name],
    filename: `${name}.html`,
    template: './public/index.html'
  };
});

const entries = {
  ...pageEntries,
}

module.exports = {
  entry: entries,
  output: {
    filename: '[name]_[hash].js',
    path: outputDir,
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
    html: htmlWithChuncks,
    define: {
      'import.meta.env': "{}",
      'process.env.APP_BASE_URL': JSON.stringify('/'),
    },
  },
  devtool: emitSourceMap,
  devServer: {
    proxy: {
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
      '/auth': {
        target: 'http://127.0.0.1:7001',
        changeOrigin: true,
      },
    },
  },
};