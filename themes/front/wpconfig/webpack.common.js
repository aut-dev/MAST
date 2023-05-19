const paths = require("./paths")
const entries = require("./entries")
const webpack = require("webpack")
const MiniCssExtractPlugin = require("mini-css-extract-plugin")
var fs = require('fs');

class CleanDistPlugin {
  paths;
  done = 0;
  constructor (paths) {
    this.paths = paths;
  }
  deleteDist() {
    if (this.done > 0) {
      return;
    }
    this.done++;
    console.log("Deleting public assets : " + this.paths.public);
    fs.rmSync(this.paths.public, {recursive: true, force: true});
  }
  apply(compiler) {
    compiler.hooks.beforeRun.tap("CleanDistPlugin", stats => {
      this.deleteDist();
    });
  }
}

class RenameDistPlugin {
  done = 1;
  paths;
  constructor (paths) {
    this.paths = paths;
  }
  symlink() {
    let env = process.env.NODE_ENV;
    if (this.done == 1 || env != 'production') {
      this.done++;
      return;
    }
    console.log("Compiler is finished, moving " + this.paths.public + ' to ' + this.paths.finalPath);
    fs.rmSync(this.paths.finalPath, {recursive: true, force: true});
    fs.rename(this.paths.public, this.paths.finalPath, (err) => {
      if (err) throw err;
    });
  }
  apply(compiler) {
    compiler.hooks.shutdown.tap("RenameDistPlugin", stats => {
      this.symlink();
    });
  }
}


module.exports = {
  target: "web",

  infrastructureLogging: {
    colors: true,
    level: "verbose",
  },

  entry: entries,

  output: {
    path: paths.build,
    publicPath: paths.publicPath,
    filename: "js/[name].[chunkhash].js",
    chunkFilename: "js/[name].[chunkhash].js" 
  },

  resolve: {
    modules: [ "node_modules" ]
  },

  plugins: [
    new RenameDistPlugin(paths),
    new CleanDistPlugin(paths),
    new MiniCssExtractPlugin({
      filename: "css/[name].[chunkhash].css"
    }),
    // Provide jQuery in a custom plugin
    new webpack.ProvidePlugin({
      $: "jquery",
      jQuery: "jquery",
    }),
  ],

  optimization: {
    splitChunks: {
      maxSize: 200000
    }
  }
}