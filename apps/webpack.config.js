const path = require('path');
const fs = require('fs');

const apps = fs.readdirSync('./src');
const entries = apps.map((app) => {
  if (app.endsWith('js') || app.endsWith('tsx') || app.endsWith('ts')) {
    return [path.parse(app).name, path.join('./src', app)];
  }
  const fList = ['js', 'ts', 'tsx'].map(ext => path.join('./src', app, `index.${ext}`));
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