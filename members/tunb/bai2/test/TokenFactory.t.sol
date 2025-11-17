// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../contracts/Token.sol";
import "../contracts/TokenFactory.sol";

contract TokenFactoryTest is Test {
    TokenFactory internal factory;

    string constant NAME = "Factory Token";
    string constant SYMBOL = "FCT";
    uint8 constant DECIMALS = 18;

    address internal creator = address(0xCAFE);

    function setUp() public {
        factory = new TokenFactory();
    }

    function test_CreateToken_EmitsEventAndStateIsCorrect() public {
        uint256 totalSupplyHuman = 1_000_000;
        uint256 totalSupplyWei = totalSupplyHuman * 10 ** DECIMALS;

        vm.expectEmit(true, false, false, true);
        emit TokenFactory.TokenCreated(address(0), NAME, SYMBOL, totalSupplyWei);

        vm.prank(creator);
        address tokenAddr = factory.createToken(NAME, SYMBOL, totalSupplyWei);
        assertTrue(tokenAddr != address(0), "token address is zero");
        Token token = Token(tokenAddr);
        assertEq(token.name(), NAME);
        assertEq(token.symbol(), SYMBOL);
        assertEq(token.decimals(), DECIMALS);
        assertEq(token.totalSupply(), totalSupplyWei);
        assertEq(token.owner(), address(factory));
        assertEq(token.balanceOf(address(factory)), totalSupplyWei);
    }
}
