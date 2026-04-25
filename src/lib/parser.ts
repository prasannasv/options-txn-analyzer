import { format, parse } from 'date-fns';
import { Transaction, TradeGroup, OptionLeg } from '../types';

function cleanFinancial(val: string | undefined): number {
  if (!val) return 0;
  let clean = val.replace(/[$,]/g, '').trim();
  if (clean.startsWith('(') && clean.endsWith(')')) {
    clean = '-' + clean.substring(1, clean.length - 1);
  }
  return parseFloat(clean) || 0;
}

export function parseCSV(csv: string): Transaction[] {
  const lines = csv.split('\n');
  if (lines.length < 2) return [];
  
  const headers = splitCSVLine(lines[0]).map(h => h.replace(/"/g, '').trim());
  const transactions: Transaction[] = [];

  // Parse in reverse to get chronological order (since CSV is reverse chronological)
  for (let i = lines.length - 1; i >= 1; i--) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = splitCSVLine(line).map(v => v.replace(/"/g, '').trim());
    const row: any = {};
    headers.forEach((header, index) => {
      const normalizedKey = header.toLowerCase();
      row[normalizedKey] = values[index];
    });

    // Fallback for missing Date header (sometimes people copy without headers)
    const dateVal = row['date'] || values[0]; 
    if (!dateVal || !dateVal.includes('/')) continue;
    
    const actionVal = row['action'] || values[1] || '';
    const isTradeAction = actionVal.includes('Open') || actionVal.includes('Close') || actionVal === 'Expired';
    const isOtherAction = actionVal.includes('Transfer') || actionVal.includes('Interest') || actionVal.includes('Journal');
    
    if (!isTradeAction && !isOtherAction) continue;

    const dateParts = dateVal.split(' as of ');
    const displayDate = dateParts[0].trim();
    const actualDate = (dateParts[1] || dateParts[0]).trim();
    let rawDate: Date;
    try {
      rawDate = parse(actualDate, 'MM/dd/yyyy', new Date());
    } catch (e) {
      continue;
    }

    transactions.push({
      date: displayDate,
      action: actionVal,
      symbol: row['symbol'] || values[2] || '',
      description: row['description'] || values[3] || '',
      quantity: cleanFinancial(row['quantity'] || values[4]),
      price: (row['price'] || values[5]) ? cleanFinancial(row['price'] || values[5]) : null,
      fees: cleanFinancial(row['fees & comm'] || values[6]),
      amount: cleanFinancial(row['amount'] || values[7]),
      rawDate,
      csvIndex: i
    });
  }

  return transactions;
}

function splitCSVLine(line: string): string[] {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  // Detection for tab-separated values
  if (!line.includes(',') && line.includes('\t')) {
    return line.split('\t');
  }

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export function parseOptionSymbol(symbol: string): OptionLeg | null {
  const parts = symbol.split(' ');
  if (parts.length < 4) return null;

  return {
    underlying: parts[0],
    expiry: parse(parts[1], 'MM/dd/yyyy', new Date()),
    strike: parseFloat(parts[2]),
    type: parts[3] === 'C' ? 'CALL' : 'PUT'
  };
}

function constructTradeSummary(txs: Transaction[], isOpening: boolean): string {
  const tradeTxs = txs.filter(t => isOpening ? t.action.includes('Open') : (t.action.includes('Close') || t.action === 'Expired'));
  if (tradeTxs.length === 0) return '';

  const leg = parseOptionSymbol(tradeTxs[0].symbol);
  if (!leg) return '';

  const shortLeg = tradeTxs.find(t => t.action.includes('Sell'));
  const longLeg = tradeTxs.find(t => t.action.includes('Buy'));
  
  const shortStrike = shortLeg ? parseOptionSymbol(shortLeg.symbol)?.strike : null;
  const longStrike = longLeg ? parseOptionSymbol(longLeg.symbol)?.strike : null;
  
  const qty = Math.abs(tradeTxs[0].quantity);
  const netAmount = tradeTxs.reduce((sum, t) => sum + t.amount, 0);
  const totalFees = tradeTxs.reduce((sum, t) => sum + t.fees, 0);
  const price = Math.abs(netAmount / (qty * 100));

  const actionPrefix = isOpening ? 'SOLD' : (tradeTxs.some(t => t.action === 'Expired') ? 'EXPIRED' : 'BOUGHT');
  const typeStr = leg.type === 'PUT' ? 'Put' : 'Call';
  
  if (shortStrike && longStrike) {
    return `${actionPrefix} ${leg.underlying} ${shortStrike}/${longStrike} ${typeStr} Spread Qty ${qty} @ $${price.toFixed(2)} [Prem: $${Math.abs(netAmount).toFixed(2)}, Fees: $${totalFees.toFixed(2)}]`;
  }

  return `${actionPrefix} ${tradeTxs.length} legs for ${leg.underlying} @ $${price.toFixed(2)}`;
}

export function groupTrades(transactions: Transaction[]): TradeGroup[] {
  const trades: TradeGroup[] = [];
  const processedTxIndices = new Set<number>();

  // Process opening transactions sequentially
  transactions.forEach((tx, idx) => {
    if (tx.action.includes('Open') && !processedTxIndices.has(tx.csvIndex)) {
      const leg = parseOptionSymbol(tx.symbol);
      if (!leg) return;

      // Find all partner legs for this group (same day, same underlying, same expiry)
      const groupTxs = [tx];
      transactions.forEach((t, tIdx) => {
        if (tIdx > idx && t.action.includes('Open') && !processedTxIndices.has(t.csvIndex)) {
          const tLeg = parseOptionSymbol(t.symbol);
          if (tLeg && 
              tLeg.underlying === leg.underlying && 
              format(tLeg.expiry, 'yyyy-MM-dd') === format(leg.expiry, 'yyyy-MM-dd') &&
              t.rawDate.getTime() === tx.rawDate.getTime()) {
            groupTxs.push(t);
          }
        }
      });

      groupTxs.forEach(t => processedTxIndices.add(t.csvIndex));

      const shortLeg = groupTxs.find(t => t.action.includes('Sell'));
      const longLeg = groupTxs.find(t => t.action.includes('Buy'));

      const trade: TradeGroup = {
        id: `${leg.underlying}-${format(leg.expiry, 'yyyy-MM-dd')}-${tx.csvIndex}`,
        symbol: leg.underlying,
        expiry: format(leg.expiry, 'yyyy-MM-dd'),
        type: groupTxs.every(t => parseOptionSymbol(t.symbol)?.type === 'PUT') ? 'PUT' : 
              groupTxs.every(t => parseOptionSymbol(t.symbol)?.type === 'CALL') ? 'CALL' : 'IRON CONDOR',
        status: 'OPEN',
        openDate: tx.rawDate,
        closeDate: null,
        transactions: [...groupTxs],
        netAmount: groupTxs.reduce((sum, t) => sum + t.amount, 0),
        profit: 0,
        contracts: Math.max(...groupTxs.map(t => Math.abs(t.quantity))),
        legs: groupTxs.map(t => t.symbol),
        shortStrike: shortLeg ? parseOptionSymbol(shortLeg.symbol)?.strike : undefined,
        longStrike: longLeg ? parseOptionSymbol(longLeg.symbol)?.strike : undefined
      };

      // Find matching closing/expired legs later in history
      transactions.forEach(t => {
        if (!t.action.includes('Open') && !processedTxIndices.has(t.csvIndex)) {
          if (t.rawDate >= trade.openDate && trade.legs.includes(t.symbol)) {
             trade.transactions.push(t);
             processedTxIndices.add(t.csvIndex);
          }
        }
      });

      // Status logic
      const legInventory = new Map<string, number>();
      trade.transactions.forEach(t => {
        let q = 0;
        if (t.action === 'Expired') {
          q = t.quantity;
        } else {
          q = t.action.includes('Sell') ? -Math.abs(t.quantity) : Math.abs(t.quantity);
        }
        legInventory.set(t.symbol, (legInventory.get(t.symbol) || 0) + q);
      });

      if (Array.from(legInventory.values()).every(q => q === 0)) {
        trade.status = trade.transactions.some(t => t.action === 'Expired') ? 'EXPIRED' : 'CLOSED';
        trade.closeDate = new Date(Math.max(...trade.transactions.map(t => t.rawDate.getTime())));
      }

      trade.openSummary = constructTradeSummary(groupTxs, true);
      const closeTxs = trade.transactions.filter(t => t.action.includes('Close') || t.action === 'Expired');
      if (closeTxs.length > 0) {
        trade.closeSummary = constructTradeSummary(closeTxs, false);
      }

      trade.profit = trade.transactions.reduce((sum, t) => sum + t.amount, 0);
      trades.push(trade);
    }
  });

  return trades.sort((a, b) => b.openDate.getTime() - a.openDate.getTime());
}
