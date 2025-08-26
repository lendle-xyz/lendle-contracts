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

  ILendingPool internal lendingPool;
  IOdosRouter internal router;
  address internal lendToken;

  mapping(address => bytes) internal paths; // asset => odos path to get LEND

  event Withdraw(address token, uint256 amount);
  event SwapAll();
  event InitAddresses(address lendingPool, address router, address lendToken);
 
  /* ========== INITIALIZER ========== */
  function initialize(address owner) external initializer {
    _transferOwnership(owner);
  }

  function initAddresses(address _lendingPool, address _router, address _lendToken) external onlyOwner {
    lendingPool = ILendingPool(_lendingPool);
    router = IOdosRouter(_router);
    lendToken = _lendToken;

    emit InitAddresses(_lendingPool, _router, _lendToken);
  }

  function addPaths(address[] memory _tokens, bytes[] memory _paths) external onlyOwner {
    require(_tokens.length == _paths.length, 'Length mismatch');

    uint256 _length = _tokens.length;
    for (uint256 i = 0; i < _length; i++) {
      paths[_tokens[i]] = _paths[i];
    }
  }

  function swapAll() external {    
    address[] memory _reserves = lendingPool.getReservesList();
    uint256 _length = _reserves.length;

    IOdosRouter.SwapTokenInfo memory _tokenInfo;
    uint256 _balance;
    address _underlyingAsset;

    for (uint256 i = 0; i < _length; i++) {
      _balance = IERC20(_reserves[i]).balanceOf(address(this));
      if (_balance > 0) {
        _underlyingAsset = IAToken(_reserves[i]).UNDERLYING_ASSET_ADDRESS();
        ILendingPool(lendingPool).withdraw(_underlyingAsset, _balance, address(this));

        IERC20(_underlyingAsset).safeTransfer(owner(), _balance / 2); // half to the owner // FIXME: add receiver
        _balance = IERC20(_reserves[i]).balanceOf(address(this)); // another half to buyback LEND

        _tokenInfo = IOdosRouter.SwapTokenInfo({
          inputToken: _underlyingAsset,
          inputAmount: _balance,
          inputReceiver: address(this),
          outputToken: lendToken,
          outputQuote: 0,
          outputMin: 0,
          outputReceiver: address(this) // FIXME: define the receiver
        });

        router.swap(
          _tokenInfo,
          paths[_underlyingAsset],
          address(this),
          0
        );
      }
    }

    emit SwapAll();
  }

  function withdraw(address token, uint256 amount) external onlyOwner {
    IERC20(token).safeTransfer(owner(), amount);

    emit Withdraw(token, amount);
  }
}