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
const pages = fs.readdirSync('./src/components');
const outputDir = path.resolve(__dirname, 'dist');

const pageEntries = pages.reduce((prev, file) => {
  let entryName = file.split('.')[0];
  return {
    ...prev,
    [entryName]: path.join(__dirname, 'src/components', file, 'index.tsx'),
  };
}, {});

const entries = {
  ...pageEntries,
};

module.exports = {
  entry: entries,
  output: {
    filename: '[name].js',
    path: outputDir,
  },
  externals: {
    react: 'React',
  },
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
    define: {
      'import.meta.env': "{}",
      'process.env.APP_BASE_URL': JSON.stringify('/'),
    },
  },
  devtool: emitSourceMap,
};