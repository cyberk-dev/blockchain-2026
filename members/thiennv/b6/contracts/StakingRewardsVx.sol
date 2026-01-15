// SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract StakingRewardsVx is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable tokenS;
    IERC20 public immutable tokenR;
    uint256 public timeDur;
    uint256 public startTime;

    uint256 public rewardPerSec;
    uint256 public totalStaked;
    uint256 public accumulatedRewardPerShare; // * 1e18
    uint256 public lastCheckPointTime;

    // user state
    mapping(address => uint256) public stakedAmount;
    mapping(address => uint256) public pendingRewards;
    mapping(address => uint256) public lastUserAccRPS;

    // Events
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardClaimed(address indexed user, uint256 reward);
    event RewardPerSecUpdated(uint256 newRewardPerSec);

    constructor(
        address _stakingToken,
        address _rewardsToken,
        uint256 _duration
    ) Ownable(msg.sender) {
        tokenS = IERC20(_stakingToken);
        tokenR = IERC20(_rewardsToken);
        timeDur = _duration;
        startTime = block.timestamp;
        lastCheckPointTime = block.timestamp;
    }

    modifier updateReward(address account) {
        // implement reward update logic
        // time logic
        uint256 timeDiff = block.timestamp - lastCheckPointTime;

        if (timeDiff == 0) {
            _;
            return;
        }

        // 1.Global accumulatedRewardPerShare update
        uint256 rewardAdded = timeDiff * rewardPerSec;
        uint256 rewardPerToken = rewardAdded / totalStaked;
        accumulatedRewardPerShare += rewardPerToken;

        lastCheckPointTime = block.timestamp;

        // 2.User pendingRewards update
        uint256 earned = stakedAmount[account] *
            (accumulatedRewardPerShare - lastUserAccRPS[account]) / 1e18;
        pendingRewards[account] += earned;
        lastUserAccRPS[account] = accumulatedRewardPerShare;
        _;
    }

    function stake(uint amount) external updateReward(msg.sender) {
        totalStaked += amount;
        stakedAmount[msg.sender] += amount;

        // TODO: send staking tokens from user to contract
        tokenS.safeTransferFrom(msg.sender, address(this), amount);
        // emit event
        emit Staked(msg.sender, amount);
    }

    function unstake(uint amount) external updateReward(msg.sender) {
        totalStaked -= amount;
        stakedAmount[msg.sender] -= amount;

        tokenS.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    function claim() external updateReward(msg.sender) {
        uint256 reward = pendingRewards[msg.sender];
        if (reward == 0) {
            return;
        }

        pendingRewards[msg.sender] = 0;
        // TODO: transfer pending rewards to user
        tokenR.safeTransfer(msg.sender, reward);

        emit RewardClaimed(msg.sender, reward);
    }

    function setRewardPerSec(uint256 newRewardPerSec) external onlyOwner {
        rewardPerSec = newRewardPerSec;
        emit RewardPerSecUpdated(newRewardPerSec);
    }
}
