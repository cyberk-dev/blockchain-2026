pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import { Bai1 } from "../contracts/Bai1.sol";

contract Bai1Test is Test
{
    Bai1 bai1;
    address owner;
    address tunb;

    function setUp() public {
        owner = address(this);
        tunb = makeAddr("tunb token");
        bai1 = new Bai1("Bai 1 Token", "CYBERK");
    }

    function test_token() public {
        assertEq(bai1.name(), "Bai 1 Token");
        assertEq(bai1.symbol(), "CYBERK");
        assertEq(bai1.decimals(), 18);
        assertEq(bai1.totalSupply(), 0);
    }

    function test_mint() public {
        uint256 amount = 1000 ether;
        bai1.mint(tunb, amount);
        
        assertEq(bai1.balanceOf(tunb), amount);
        assertEq(bai1.totalSupply(), amount);
    }
}