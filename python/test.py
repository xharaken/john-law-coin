#!/usr/bin/env python3

class Test:
    def func(self):
        Test.A = 1
        Test.B = 2

test = Test()
test.func()
print(Test.A)
