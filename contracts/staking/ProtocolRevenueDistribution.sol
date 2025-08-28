// SPDX-License-Identifier: MIT

pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import {OwnableUpgradable} from '../misc/OwnableUpgradable.sol';
import {IERC20} from '../dependencies/openzeppelin/contracts/IERC20.sol';
import {SafeERC20} from '../dependencies/openzeppelin/contracts/SafeERC20.sol';

import {ILendingPool} from '../interfaces/ILendingPool.sol';
import {IAToken} from '../interfaces/IAToken.sol';
import {IOdosRouter} from '../interfaces/IOdosRouter.sol';

contract ProtocolRevenueDistribution is OwnableUpgradable {
  using SafeERC20 for IERC20;

  uint256 public constant VERSION = 0x2;

  ILendingPool public lendingPool;
  address public router;
  address public distributor;

  bool public initializedAddresses;

  event Distributed();
  event InitAddresses(address lendingPool, address router);
  event SetDistributor(address distributor);
  event Withdraw(address token, uint256 amount);
 
  /* ========== INITIALIZER ========== */
  function initialize(address owner) external initializer {
    _transferOwnership(owner);
  }

  function initAddresses(address _lendingPool, address _router) external {
    require(!initializedAddresses, 'Already initialized');

    lendingPool = ILendingPool(_lendingPool);
    router = _router;

    initializedAddresses = true;

    emit InitAddresses(_lendingPool, _router);
  }

  function setDistributor(address _distributor) external onlyOwner {
    distributor = _distributor;

    emit SetDistributor(_distributor);
  }

  function distribute(address[] calldata _aTokens, bytes[] calldata _swapPaths) external { 
    require(msg.sender == distributor, 'Unauthorized caller');
    uint256 _length = _aTokens.length;
    require(_length == _swapPaths.length, 'Length mismatch');

    uint256 _balance;
    address _underlyingAsset;

    for (uint256 i = 0; i < _length; i++) {
      _balance = IERC20(_aTokens[i]).balanceOf(address(this));
      _underlyingAsset = IAToken(_aTokens[i]).UNDERLYING_ASSET_ADDRESS();
      lendingPool.withdraw(_underlyingAsset, _balance, address(this));

      // Transfer half balance to the owner
      uint256 halfBalance = _balance / 2;
      IERC20(_underlyingAsset).safeTransfer(owner(), halfBalance); // half to the owner

      // Use the remaining half for buyback LEND
      IERC20(_underlyingAsset).safeApprove(router, _balance - halfBalance);

      (bool success, ) = router.call{value: 0}(_swapPaths[i]);
      require(success, "Odos swapCompact failed");
    }

    emit Distributed();
  }

  function withdraw(address token, uint256 amount) external onlyOwner {
    IERC20(token).safeTransfer(owner(), amount);

    emit Withdraw(token, amount);
  }
}