const path = require('path');
const fs = require('fs');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const DtsBundleWebpack = require('dts-bundle-webpack')

const appDir = './src/components';
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
}, {
  index: path.join(__dirname, 'src', 'index.ts'),
});

const outputDir = path.resolve(__dirname, 'dist');

const isProd = process.env.NODE_ENV === 'production';

const dtsBundles = apps.map(comp => {
  const compName = path.parse(comp).name;
  return new DtsBundleWebpack({
    name: `@webby/components/dist/${compName}`,
    main: path.resolve(__dirname, `dist/components/${compName}/index.d.ts`),
    out: path.resolve(__dirname, `dist/${compName}.d.ts`),
  })
});

module.exports = {
  mode: isProd ? 'production' : 'development',
  entry: entries,
  externals: {
    react: {
      commonjs: 'react',
    }
  },
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
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
        sideEffects: true,
      },
      {
        test: /\.module\.less$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader', options: {
              importLoaders: 1,
              modules: {
                mode: 'local',
                localIdentName: '[path]_[local]',
              },
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
  plugins: [new MiniCssExtractPlugin(), ...dtsBundles],
  optimization: {
    minimize: isProd ? true : false,
  },
  devtool: isProd ? false : 'inline-source-map',
  output: {
    filename: '[name].js',
    path: outputDir,
    library: {
      type: 'commonjs',
    }
  },
};
