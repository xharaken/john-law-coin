#!/usr/bin/env python3
#
# Copyright 2021 Kentaro Hara
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import os, subprocess, sys, time

def kill_ganache():
    kill_command = [
        "ps axf | grep ganache | grep -v grep |" +
        "awk '{ print $1 }' | xargs kill -9"]
    kill_proc = subprocess.Popen(
        kill_command, shell=True, stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    kill_proc.communicate()
    command = "sudo rm -rf /tmp/tmp-*"
    subprocess.run(command, shell=True)

def reset_network(voters):
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    kill_ganache()
    time.sleep(2)
    network = subprocess.Popen(
        "ganache-cli -l 1200000000 -a " + str(voters), shell=True,
        stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL)
    time.sleep(4)

def run_test(command):
    print(command, file=sys.stderr)
    subprocess.run(command, shell=True)
    sys.stdout.flush()
    kill_ganache()
