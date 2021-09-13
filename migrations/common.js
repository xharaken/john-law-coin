// Copyright (c) 2021 Kentaro Hara
//
// This software is released under the MIT License.
// http://opensource.org/licenses/mit-license.php

exports.sleep = function (ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
