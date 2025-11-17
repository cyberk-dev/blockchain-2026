pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./Token.sol";

contract TokenFactoryV2 is UUPSUpgradeable, OwnableUpgradeable {
    uint256 tokenCount = 0;
    mapping(address => Token) public tokenMap;
    address tokenImpl;

    event TokenCreated(
        address indexed tokenAddress,
        string name,
        string symbol,
        address owner
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __UUPSUpgradeable_init();
        __Ownable_init(msg.sender);
        tokenImpl = address(new Token());
    }

    function createToken(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) public returns (address) {
        ERC1967Proxy proxy = new ERC1967Proxy(
            tokenImpl,
            abi.encodeWithSelector(
                Token.initialize.selector,
                name,
                symbol,
                initialSupply,
                msg.sender
            )
        );
        address tokenAddress = address(proxy);
        tokenMap[tokenAddress] = Token(tokenAddress);
        tokenCount++;
        emit TokenCreated(tokenAddress, name, symbol, msg.sender);
        return tokenAddress;
    }

    function getToken(address tokenAddress) public view returns (Token) {
        return tokenMap[tokenAddress];
    }

    function getTokenCount() public view returns (uint256) {
        return tokenCount;
    }

    function getVersion() public pure returns (uint256) {
        return 2;
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal virtual override {}
}
