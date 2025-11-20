// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../contracts/Token.sol";

contract TokenTest is Test {
    Token internal token;
    address internal owner = address(0xABCD);
    address internal user = address(0xBEEF);

    string constant NAME = "Cyber Token";
    string constant SYMBOL = "IGNT";

    uint8 constant DECIMALS = 18;
    uint256 constant INITIAL_SUPPLY_HUMAN = 1_000_000;
    uint256 constant INITIAL_SUPPLY = INITIAL_SUPPLY_HUMAN * 10 ** DECIMALS;

    function setUp() public {
        token = new Token(NAME, SYMBOL, INITIAL_SUPPLY);
        token.transfer(owner, INITIAL_SUPPLY);
    }

    function test_Metadata() public {
        assertEq(token.name(), NAME);
        assertEq(token.symbol(), SYMBOL);
        assertEq(token.decimals(), DECIMALS);
    }

    function test_TotalSupplyAndOwnerBalance() public {
        assertEq(token.totalSupply(), INITIAL_SUPPLY);
        assertEq(token.balanceOf(owner), INITIAL_SUPPLY);
    }

    function test_Transfer() public {
        uint256 amount = 100 * 10 ** DECIMALS;
        vm.prank(owner);
        token.transfer(user, amount);

        assertEq(token.balanceOf(owner), INITIAL_SUPPLY - amount);
        assertEq(token.balanceOf(user), amount);
    }

    function test_buyToken() public
    {
        uint256 buyAmount = 50 * 10 ** DECIMALS;
        uint256 etherSent = 5 ether; // 0.1 ether per token, so 5 ether buys 50 tokens

        vm.prank(user);
        token.buyTokens{value: etherSent}(buyAmount);

        assertEq(token.balanceOf(user), buyAmount);
        assertEq(token.totalSupply(), INITIAL_SUPPLY + buyAmount);
    }
}
