'use strict';

module.exports = {
  mode: 'development',
  devtool: 'inline-source-map',
  entry: './index.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader'
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js']
  },
  output: {
    filename: 'index.js'
  }
};
