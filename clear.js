const Configstore = require('configstore');
const Config = new Configstore('config.json');

Config.clear();
console.log('done');