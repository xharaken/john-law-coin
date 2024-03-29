#!/usr/bin/env python3
#
# Copyright (c) 2021 Kentaro Hara
#
# This software is released under the MIT License.
# http://opensource.org/licenses/mit-license.php

import glob, os, subprocess, sys, time

def kill_ganache():
    kill_command = [
        "ps axf | grep ganache | grep -v grep |" +
        "awk '{ print $1 }' | xargs kill -9"]
    kill_proc = subprocess.Popen(
        kill_command, shell=True, stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    kill_proc.communicate()
    # Remove tmp files generated by Truffle.
    command = "rm -rf /tmp/tmp-*/* 2> /dev/null"
    subprocess.run(command, shell=True)
    command = "rm -rf /tmp/tmp-* 2> /dev/null"
    subprocess.run(command, shell=True)
    for file in glob.glob("/tmp/tmp-*/*"):
        command = "rm -rf " + file + " 2> /dev/null"
    subprocess.run(command, shell=True)
    for file in glob.glob("/tmp/tmp-*"):
        command = "rm -rf " + file + " 2> /dev/null"
        subprocess.run(command, shell=True)

def reset_network(voters):
    # os.chdir(os.path.dirname(os.path.abspath(__file__)))
    kill_ganache()
    time.sleep(6)
    network = subprocess.Popen(
        "ganache-cli --port 8546 -l 1200000000 -a" + str(voters), shell=True,
        stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL)
    time.sleep(6)

def run_test(command):
    print(command, file=sys.stderr)
    subprocess.run(command, shell=True)
    sys.stdout.flush()
    kill_ganache()
