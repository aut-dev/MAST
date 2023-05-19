const common = require("./webpack.common.js");
const paths = require("./paths")
const { merge } = require("webpack-merge");
var WebpackNotifierPlugin = require('webpack-notifier');
const StylelintPlugin = require('stylelint-webpack-plugin');
const ESLintPlugin = require('eslint-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const { WebpackManifestPlugin } = require("webpack-manifest-plugin")
const WebpackBar = require("webpackbar")
const MiniCssExtractPlugin = require("mini-css-extract-plugin")

module.exports = merge(common, {
  mode: "development",
  devtool: "source-map",
  stats: "normal",
  
  module: {
    rules: [
      {
        test: require.resolve("jquery"),
        loader: "expose-loader",
        options: {
          exposes: {
            globalName: "$",
            override: true,
          },
        },
      },
      {
        test: /\.js$/,
        exclude: /(node_modules)/,
        use: {
          loader: "babel-loader",
          options: {
            presets: [
              ["@babel/preset-env", {
                useBuiltIns: 'entry',
                corejs: 3,
              }],
            ],
            plugins: [
              ["@babel/plugin-proposal-class-properties"],
              ["@babel/plugin-transform-runtime", { "corejs": 3 }],
              ["@babel/plugin-syntax-dynamic-import"]
            ],
          },
        }
      },
      {
        test: /\.svg(\?.*)?$/,
        use: [
          "svg-url-loader",
          "svg-transform-loader"
        ]
      },
      {
        test: /\.(scss|css)$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
            options: {
              emit: true
            }
          },
          // {
          //   loader: "style-loader"
          // },
          {
            loader: "css-loader",
            options: {
              importLoaders: 2,
            }
          },
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: function () {
                  return [
                    require('autoprefixer')
                  ];
                }
              }
            }
          },
          { loader: "svg-transform-loader/encode-query" },
          {
            loader: "sass-loader",
            options: {
              sourceMap: true,
              implementation: require("sass"),
            }
          },
          {
            loader: 'sass-resources-loader',
            options: {
              // Provide path to the file with resources
              resources: [
                paths.src + '/css/resources/variables.scss',
                paths.src + '/css/resources/mixins.scss',
                'node_modules/bootstrap/scss/_functions.scss',
                'node_modules/bootstrap/scss/_variables.scss',
                'node_modules/bootstrap/scss/_mixins.scss',
              ]
            },
          }
        ],
      },
      {
        test: /\.(?:ico|gif|png|jpg|jpeg)$/i,
        type: "asset/inline",
        loader: "file-loader",
        options: {
          outputPath: "images",
        },
      },
      {
        test: /\.(woff(2)?|eot|ttf|otf)$/,
        type: "asset/inline"
      },
    ],
  },

  plugins: [
    new WebpackNotifierPlugin({
      alwaysNotify: true
    }),
    new StylelintPlugin({
      exclude: ['node_modules', 'templates'],
      customSyntax: 'postcss-scss'
    }),
    new ESLintPlugin(),
    new CleanWebpackPlugin(),
    new WebpackBar({ fancy: true, profile: true }),
    new WebpackManifestPlugin({
      fileName: "manifest.json",
    }),
  ]
})