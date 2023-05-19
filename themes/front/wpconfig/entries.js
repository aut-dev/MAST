const paths = require("./paths");
const fs = require('fs');

var entries = {
    index: [paths.src + "/index.js"]
};

fs.readdirSync(paths.pages).forEach(file => {
    entries['pages/' + file.replace('.js', '')] = paths.pages + '/' + file;
});

module.exports = entries;