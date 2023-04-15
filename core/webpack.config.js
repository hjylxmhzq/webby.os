const path = require('path');
const fs = require('fs');

const modules = fs.readdirSync('./src');

module.exports = {
  mode: 'production',
  experiments: {
    outputModule: true,
  },
  entry: {
    index: './src/index.ts'
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
            options: {
              modules: true
            }
          },
          {
            loader: require.resolve('css-loader'),
            options: cssOptions,
          },
        ]
      },
    ],
  },
  optimization: {
    minimize: false
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    library: {
      name: 'core',
      type: 'commonjs',
    }
  },
};