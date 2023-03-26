const path = require('path');
const fs = require('fs');

const apps = fs.readdirSync('./src');
const entries = apps.reduce((prev, app) => {
  return {
    ...prev,
    [app]: './' + path.join('src', app, 'index.tsx'),
  }
}, {});

module.exports = {
  mode: 'production',
  experiments: {
    outputModule: true,
  },
  entry: entries,
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, '../server/static/apps'),
    library: {
      type: 'module',
    }
  },
};