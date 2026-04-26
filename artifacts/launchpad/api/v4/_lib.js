import { neon } from '@neondatabase/serverless';

let _sql = null;

export function getSql() {
  if (_sql) return _sql;
  const url = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('NEON_DATABASE_URL not configured');
  _sql = neon(url);
  return _sql;
}

export function rowToTokenRecord(r) {
  if (!r) return null;
  return {
    address: r.address,
    curveAddress: r.curve_address,
    creator: r.creator,
    name: r.name,
    symbol: r.symbol,
    metadataURI: r.metadata_uri,
    deployedAt: Number(r.deployed_at),
    blockNumber: Number(r.block_number),
    ethUsdPrice8: r.eth_usd_price_8,
    virtualEthReserve: r.virtual_eth_reserve,
    graduated: Number(r.graduated),
    cancelled: Number(r.cancelled),
    v2Pair: r.v2_pair,
    realEth: r.real_eth,
    tokensSold: r.tokens_sold,
    lastTradeAt: r.last_trade_at == null ? null : Number(r.last_trade_at),
    indexedAt: Number(r.indexed_at),
    chainId: Number(r.chain_id),
  };
}

export function rowToTrade(r) {
  return {
    id: Number(r.id),
    tokenAddress: r.token_address,
    curveAddress: r.curve_address,
    trader: r.trader,
    type: r.type,
    ethAmount: r.eth_amount,
    fee: r.fee,
    tokenAmount: r.token_amount,
    totalBondedAfter: r.total_bonded_after,
    priceWeiPerToken: r.price_wei_per_token,
    txHash: r.tx_hash,
    blockNumber: Number(r.block_number),
    logIndex: Number(r.log_index),
    timestamp: Number(r.timestamp),
  };
}

export const ADDR_RE = /^0x[0-9a-f]{40}$/;
