/* eslint-env node */
// import {readFile} from "fs";

// global.fetch = function(path) {
//   return {
//     arrayBuffer: function() {
//       return new Promise(function(resolve, reject) {
//         readFile(path, function(err, data) {
//           if (err) {
//             reject(err);
//           } else {
//             resolve(data);
//           }
//         });
//       });
//     }
//   };
// };

// global.window = {};
import {main} from "./src/top";
// global.window.onload();
main().then(() => {
  console.log("done");
}).catch((e) => {
  console.error(e);
});
