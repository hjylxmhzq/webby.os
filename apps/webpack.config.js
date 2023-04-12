const path = require('path');
const fs = require('fs');
const CopyPlugin = require('copy-webpack-plugin');

const appDir = './src/apps';
const apps = fs.readdirSync(appDir);
const entries = apps.map((app) => {
  if (app.endsWith('js') || app.endsWith('tsx') || app.endsWith('ts')) {
    return [path.parse(app).name, path.join(appDir, app)];
  }
  const fList = ['js', 'ts', 'tsx'].map(ext => path.join(appDir, app, `index.${ext}`));
  for (let f of fList) {
    if (fs.existsSync(f)) {
      return [app, f];
    }
  }
}).filter(app => !!app).reduce((prev, [appName, appSrc]) => {
  console.log(appName, appSrc);
  return {
    ...prev,
    [appName]: './' + appSrc,
  }
}, {});

const outputDir = path.resolve(__dirname, '../server/static/apps');

const isProd = process.env.NODE_ENV === 'production';

module.exports = {
  mode: isProd ? 'production' : 'development',
  entry: entries,
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.(png|jpg|gif|ico|svg)$/i,
        use: [
          {
            loader: 'url-loader',
            options: {
              limit: 200_000,
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
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "../node_modules/pdfjs-dist/build/pdf.worker.min.js", to: path.join(outputDir, 'pdf-viewer') },
        { from: "../node_modules/pdfjs-dist/cmaps", to: path.join(outputDir, 'pdf-viewer', 'cmaps') },
        { from: "./src/apps/3d-editor/editor", to: path.join(outputDir, '3d-editor') },
        { from: "./src/apps/paint/jspaint", to: path.join(outputDir, 'paint') },
        { from: "./src/apps/vnc-viewer/novnc", to: path.join(outputDir, 'vnc-viewer') },
      ],
    }),
  ],
  optimization: {
    minimize: isProd ? true : false,
  },
  devtool: isProd ? false : 'inline-source-map',
  output: {
    filename: '[name].js',
    path: outputDir,
    publicPath: '/static/apps',
    library: {
      type: 'commonjs',
    }
  },
};