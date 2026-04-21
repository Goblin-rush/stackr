export interface LiveTrade {
  id: number;
  type: 'buy' | 'sell';
  account: string;
  ethAmount: number;
  tokenAmount: number;
  price: number;
  timestamp: number;
  txHash: string;
}

export interface LiveHolder {
  address: string;
  amount: number;
  percent: number;
  label?: string;
}
