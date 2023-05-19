const path = require('path')
const env = process.env.NODE_ENV;
let json = require('../composer.json');
let handle = json.extra.handle;
let node_env = process.env.NODE_ENV;

let public_dir = path.resolve(__dirname, '../../../web/themes/');
let public_handle = handle + (node_env == 'production' ? '_tmp' : '');

module.exports = {
  finalPath: public_dir + '/' + handle,
  // Source files
  src: path.resolve(__dirname, '../src'),

  pages: path.resolve(__dirname, '../src/js/pages'),

  // Production build files
  build: path.resolve(public_dir + '/' + public_handle),

  // Static files that get copied to build folder
  public: path.resolve(public_dir + '/' + public_handle),

  publicPath: '/themes/' + handle + '/',

  templates: path.resolve(__dirname, '../templates'),

  storage: path.resolve(__dirname, '../storage/webpack'),

  webpack: path.resolve(__dirname)
}
