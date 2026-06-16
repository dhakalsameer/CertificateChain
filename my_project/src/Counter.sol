// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.27;

contract Counter {
    uint256 public number;
    string public name = "Hello";


    function setNumber(uint256 newNumber) public {
        number = newNumber;
    }

    function increment() public {
        number++;
    }
}
