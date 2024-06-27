/* globals Craft */

const Translate = {
  install(app) {
    app.config.globalProperties.t = (message, params, category) => {
      return Craft.t(message, params, category);
    };
  },
};

export { Translate };
