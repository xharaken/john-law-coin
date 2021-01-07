#!/usr/bin/env python3
from jlc import *
import unittest

class TokenUnitTest(unittest.TestCase):
    def __init__(self):
        super().__init__()

    def teardown(self):
        pass

    def run(self):
        supply = TokenSupply()
        self.assertEqual(supply.amount, 0)

        holder1 = TokenHolder()
        self.assertEqual(holder1.amount, 0)

        # mint
        supply.mint(holder1, 10)
        self.assertEqual(supply.amount, 10)
        self.assertEqual(holder1.amount, 10)

        supply.mint(holder1, 20)
        self.assertEqual(supply.amount, 30)
        self.assertEqual(holder1.amount, 30)

        supply.mint(holder1, 0)
        self.assertEqual(supply.amount, 30)
        self.assertEqual(holder1.amount, 30)

        with self.assertRaises(Exception):
            supply.mint(holder1, -1)

        # burn
        supply.burn(holder1, holder1.amount)
        self.assertEqual(supply.amount, 0)
        self.assertEqual(holder1.amount, 0)

        supply.burn(holder1, holder1.amount)
        self.assertEqual(supply.amount, 0)
        self.assertEqual(holder1.amount, 0)

        supply.mint(holder1, 10)
        self.assertEqual(supply.amount, 10)
        self.assertEqual(holder1.amount, 10)

        supply.burn(holder1, 1)
        self.assertEqual(supply.amount, 9)
        self.assertEqual(holder1.amount, 9)

        supply.burn(holder1, 5)
        self.assertEqual(supply.amount, 4)
        self.assertEqual(holder1.amount, 4)

        supply.burn(holder1, 0)
        self.assertEqual(supply.amount, 4)
        self.assertEqual(holder1.amount, 4)

        with self.assertRaises(Exception):
            supply.burn(holder1, 5)
        with self.assertRaises(Exception):
            supply.burn(holder1, -1)

        supply.burn(holder1, 4)
        self.assertEqual(supply.amount, 0)
        self.assertEqual(holder1.amount, 0)

        supply.burn(holder1, 0)
        self.assertEqual(supply.amount, 0)
        self.assertEqual(holder1.amount, 0)

        with self.assertRaises(Exception):
            supply.burn(holder1, 1)

        # send_to
        holder1 = TokenHolder()
        holder2 = TokenHolder()
        supply.mint(holder1, 100)
        supply.mint(holder2, 100)
        self.assertEqual(supply.amount, 200)
        self.assertEqual(holder1.amount, 100)
        self.assertEqual(holder2.amount, 100)

        supply.send_to(holder2, holder1, 50)
        self.assertEqual(supply.amount, 200)
        self.assertEqual(holder1.amount, 150)
        self.assertEqual(holder2.amount, 50)

        supply.send_to(holder2, holder1, 0)
        self.assertEqual(supply.amount, 200)
        self.assertEqual(holder1.amount, 150)
        self.assertEqual(holder2.amount, 50)

        supply.send_to(holder2, holder1, 50)
        self.assertEqual(supply.amount, 200)
        self.assertEqual(holder1.amount, 200)
        self.assertEqual(holder2.amount, 0)

        supply.send_to(holder1, holder2, 50)
        self.assertEqual(supply.amount, 200)
        self.assertEqual(holder1.amount, 150)
        self.assertEqual(holder2.amount, 50)

        with self.assertRaises(Exception):
            supply.send_to(holder2, holder1, -1)
        with self.assertRaises(Exception):
            supply.send_to(holder2, holder1, 51)

        with self.assertRaises(Exception):
            supply.send_to(holder1, holder1, 10)
        with self.assertRaises(Exception):
            supply.send_to(holder2, holder2, 10)


def main():
    test = TokenUnitTest()
    test.run()
    test.teardown()

if __name__ == "__main__":
    main()
