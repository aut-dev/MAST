const common = require("./webpack.common.js")
const { merge } = require("webpack-merge")
const paths = require("./paths")
const webpack = require("webpack")
const MiniCssExtractPlugin = require("mini-css-extract-plugin")
const TerserPlugin = require("terser-webpack-plugin")
const { WebpackManifestPlugin } = require("webpack-manifest-plugin")
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin")

let optimization = {
  removeEmptyChunks: true,
  providedExports: true,
  usedExports: true,
  minimize: true,
  minimizer: [
    new CssMinimizerPlugin({
      minimizerOptions: {
        preset: [
          "default",
          {
            discardComments: { removeAll: true },
          },
        ],
      },
    }),
    new TerserPlugin({
      terserOptions: {
        format: {
          comments: false,
        },
      },
      extractComments: false,
    }),
  ],
};

// Use a common object between the bundles so we used the same
// generated CSS for both instead of making it twice.
let MANIFEST_SEED = {}

var legacyBundle = merge(common, {
  mode: "production",
  devtool: false,
  name: 'legacy-bundle',
  output: {
    clean: false,
    chunkLoading: false,
    environment: {
      module: false,
      arrowFunction: false,
      destructuring: false,
      optionalChaining: false,
      templateLiteral: false,
      forOf: false,
      const: false
    },
    filename: "js/[name].[chunkhash].es5.js",
    chunkFilename: "js/[name].[chunkhash].es5.js"
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue-loader'
      },
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
        exclude: /node_modules\/(?!(bootstrap)\/).*/,
        use: {
          loader: "babel-loader",
          options: {
            presets: [
              ["@babel/preset-env", {
                useBuiltIns: 'usage',
                bugfixes: true,
                corejs: 3,
                modules: false,
                targets: {
                  browsers: 'IE 11',
                },
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
  // optimization: optimization,
  plugins: [
    new WebpackManifestPlugin({
      fileName: "manifest-legacy.json",
      seed: MANIFEST_SEED,
    }),
  ]
});

var modernBundle = merge(common, {
  mode: "production",
  name: 'modern-bundle',
  devtool: false,
  optimization: optimization,
  output: {
    clean: false,
    environment: { module: false }
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        loader: 'vue-loader'
      },
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
                useBuiltIns: false,
                targets: { esmodules: true }, //For ES6 supporting browsers
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
    new WebpackManifestPlugin({
      fileName: "manifest.json",
      filter: ({name, path}) => !name.match(/es5/gi) || !path.match(/es5/gi),
    }),
  ]
});

module.exports = [legacyBundle, modernBundle];