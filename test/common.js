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
}

exports.mod = (i, j) => {
  return (i % j) < 0 ? (i % j) + 0 + (j < 0 ? -j : j) : (i % j + 0);
}

exports.print_contract_size = (instance, name) => {
  let bytecode = instance.constructor._json.bytecode;
  let deployed = instance.constructor._json.deployedBytecode;
  let sizeOfB  = bytecode.length / 2;
  let sizeOfD  = deployed.length / 2;
  console.log(name + ": bytecode=" + sizeOfB + " deployed=" + sizeOfD);
}

exports.randint = (a, b) => {
  assert.isTrue(a < b);
  let random = Math.floor(Math.random() * (b - a - 1)) + a;
  assert.isTrue(a <= random && random <= b);
  return random;
}
