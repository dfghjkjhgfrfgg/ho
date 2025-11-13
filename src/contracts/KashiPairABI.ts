/**
 * Kashi Pair Contract ABI
 * Contains essential functions for reading market data and executing trades
 */
export const KASHI_PAIR_ABI = [
  // Read functions
  {
    inputs: [],
    name: 'asset',
    outputs: [{ internalType: 'contract IERC20', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'collateral',
    outputs: [{ internalType: 'contract IERC20', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'totalAsset',
    outputs: [
      { internalType: 'uint128', name: 'elastic', type: 'uint128' },
      { internalType: 'uint128', name: 'base', type: 'uint128' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'totalBorrow',
    outputs: [
      { internalType: 'uint128', name: 'elastic', type: 'uint128' },
      { internalType: 'uint128', name: 'base', type: 'uint128' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'totalCollateralShare',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'interestPerSecond',
    outputs: [{ internalType: 'uint64', name: '', type: 'uint64' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'accrueInfo',
    outputs: [
      { internalType: 'uint64', name: 'interestPerSecond', type: 'uint64' },
      { internalType: 'uint64', name: 'lastAccrued', type: 'uint64' },
      { internalType: 'uint128', name: 'feesEarnedFraction', type: 'uint128' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'exchangeRate',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'oracle',
    outputs: [{ internalType: 'contract IOracle', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'oracleData',
    outputs: [{ internalType: 'bytes', name: '', type: 'bytes' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'userBorrowPart',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'userCollateralShare',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  // Write functions
  {
    inputs: [
      { internalType: 'int256', name: 'share', type: 'int256' },
      { internalType: 'address', name: 'to', type: 'address' }
    ],
    name: 'addCollateral',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'int256', name: 'amount', type: 'int256' }
    ],
    name: 'borrow',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'int256', name: 'part', type: 'int256' }
    ],
    name: 'repay',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'int256', name: 'share', type: 'int256' },
      { internalType: 'address', name: 'to', type: 'address' }
    ],
    name: 'removeCollateral',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'int256', name: 'fraction', type: 'int256' },
      { internalType: 'address', name: 'to', type: 'address' }
    ],
    name: 'addAsset',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'int256', name: 'fraction', type: 'int256' },
      { internalType: 'address', name: 'to', type: 'address' }
    ],
    name: 'removeAsset',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ internalType: 'bool', name: 'skim', type: 'bool' }],
    name: 'accrue',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
];

/**
 * ERC20 ABI (simplified)
 */
export const ERC20_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: 'spender', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'address', name: 'spender', type: 'address' }
    ],
    name: 'allowance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
];
