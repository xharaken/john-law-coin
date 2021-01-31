// Copyright 2021 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

exports.should_throw = async (callback, match) => {
  let threw = false;
  let exception;
  try {
    await callback();
  } catch (e) {
    exception = e;
    if (e.toString().indexOf(match) == -1) {
      console.log(e);
    } else {
      threw = true;
    }
  } finally {
    if (!threw) {
      console.log(exception);
    }
    assert.equal(threw, true);
  }
};

exports.mod = (i, j) => {
  return (i % j) < 0 ? (i % j) + 0 + (j < 0 ? -j : j) : (i % j + 0);
};

exports.print_contract_size = (instance, name) => {
  let bytecode = instance.constructor._json.bytecode;
  let deployed = instance.constructor._json.deployedBytecode;
  let bytecode_size  = bytecode.length / 2;
  let deployed_size  = deployed.length / 2;
  console.log(name + ": bytecode=" + bytecode_size +
              " deployed=" + deployed_size);
  return bytecode_size;
};

exports.randint = (a, b) => {
  assert.isTrue(a < b);
  let random = parseInt(Math.random() * (b - a - 1)) + a;
  assert.isTrue(a <= random && random <= b);
  return random;
};

function parseSpace(str) {
  while (str.length) {
    if (str[0] == ' ') {
      str = str.substr(1);
    } else {
      break;
    }
  }
  return str;
}

function parseNumber(str) {
  let number = 0;
  while (str.length) {
    if ('0' <= str[0] && str[0] <= '9') {
      number = number * 10 + (str[0] - '0');
      str = str.substr(1);
    } else {
      break;
    }
  }
  return [str, number];
}

function parseList(str) {
  let list = [];
  assert.equal(str[0], '[');
  str = str.substr(1);
  while (str.length) {
    str = parseSpace(str);
    if (str[0] == ']') {
      str = str.substr(1);
      break;
    } else if (str[0] == ',') {
      str = str.substr(1);
    } else {
      [str, number] = parseNumber(str);
      list.push(number);
    }
  }
  return [str, list];
}

exports.custom_arguments = () => {
  let result = [];
  let str = process.argv[process.argv.length - 1];
  while (str.length) {
    let value;
    str = parseSpace(str);
    if (str[0] == '[') {
      [str, value] = parseList(str);
    } else {
      [str, value] = parseNumber(str);
    }
    result.push(value);
  }
  return result;
};
