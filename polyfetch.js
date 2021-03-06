const {readFile} = require("fs");

global.fetch = function(path) {
  return {
    arrayBuffer: function() {
      return new Promise(function(resolve, reject) {
        readFile(path, function(err, data) {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      });
    }
  };
};
