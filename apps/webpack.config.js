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
      {
        test: /\.(png|jpg|gif|svg)$/i,
        use: [
          {
            loader: 'url-loader',
            options: {
              limit: 8192,
            },
          },
        ],
      },
      {
        test: /\.less$/,
        exclude: /\.module\.less$/,
        use: ['style-loader', 'css-loader', 'less-loader'],
        sideEffects: true,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
        sideEffects: true,
      },
      {
        test: /\.module\.less$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader', options: {
              modules: true,
            }
          },
          'less-loader'
        ],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  optimization: {
    minimize: false,
  },
  devtool: 'inline-source-map',
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, '../server/static/apps'),
    library: {
      type: 'commonjs',
    }
  },
};