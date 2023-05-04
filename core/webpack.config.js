const path = require('path');
const fs = require('fs');

const modules = fs.readdirSync('./src');

const entries = modules.reduce((prev, m) => {
  return {
    ...prev,
    [m]: './' + path.join('src', m, 'index.ts'),
  }
}, {});

module.exports = {
  mode: 'production',
  entry: {
    ...entries
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.module.less?$/,
        use: [
          {
            loader: 'style-loader',
          },
          {
            loader: require.resolve('css-loader'),
            options: {
              modules: true,
            }
          },
          {
            loader: 'less-loader',
          }
        ]
      },
    ],
  },
  optimization: {
    minimize: process.env.NODE_ENV?.includes('dev') ? false : true
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.less'],
  },
  output: {
    filename: './[name]/index.js',
    path: path.resolve(__dirname, 'dist'),
    library: {
      type: 'commonjs',
    }
  },
};