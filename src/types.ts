export interface Transaction {
  date: string;
  action: string;
  symbol: string;
  description: string;
  quantity: number;
  price: number | null;
  fees: number;
  amount: number;
  rawDate: Date;
  csvIndex: number;
}

export interface OptionLeg {
  underlying: string;
  expiry: Date;
  strike: number;
  type: 'PUT' | 'CALL';
}

export interface TradeGroup {
  id: string;
  symbol: string; // Base symbol like XSP / SPXW
  expiry: string;
  type: 'PUT' | 'CALL' | 'IRON CONDOR' | 'UNKNOWN';
  status: 'OPEN' | 'CLOSED' | 'EXPIRED' | 'ROLLED';
  openDate: Date;
  closeDate: Date | null;
  transactions: Transaction[];
  netAmount: number;
  profit: number;
  contracts: number;
  legs: string[];
  openSummary?: string;
  closeSummary?: string;
  shortStrike?: number;
  longStrike?: number;
}

export interface DailyPerformance {
  date: string;
  profit: number;
  cumulative: number;
}
