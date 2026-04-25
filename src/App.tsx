/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  PlusCircle, 
  FileText, 
  Calendar, 
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Clock,
  PieChart as PieChartIcon,
  ChevronDown,
  LayoutDashboard
} from 'lucide-react';
import { format, isWithinInterval, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { parseCSV, groupTrades } from './lib/parser';
import { Transaction, TradeGroup } from './types';
import { cn } from './lib/utils';

export default function App() {
  const [csvData, setCsvData] = useState<string>('');
  const [trades, setTrades] = useState<TradeGroup[]>([]);
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: subMonths(new Date(), 12),
    end: new Date()
  });

  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);

  const sampleCsv = `"Date","Action","Symbol","Description","Quantity","Price","Fees & Comm","Amount"
"04/24/2026","Buy to Open","SPXW 04/24/2026 7230.00 C","CALL S & P ...500 INDEX $7230 EXP 04/24/26","1","$0.12","$1.13","-$13.13"
"04/24/2026","Sell to Open","SPXW 04/24/2026 7180.00 C","CALL S & P ...500 INDEX $7180 EXP 04/24/26","1","$0.62","$1.13","$60.87"
"04/24/2026 as of 04/23/2026","Expired","SPXW 04/23/2026 7055.00 P","PUT S & P ...500 INDEX $7055 EXP 04/23/26","2","","",""
"04/24/2026 as of 04/23/2026","Expired","SPXW 04/23/2026 7040.00 P","PUT S & P ...500 INDEX $7040 EXP 04/23/26","-2","","",""
"04/23/2026","Sell to Open","SPXW 04/23/2026 7055.00 P","PUT S & P ...500 INDEX $7055 EXP 04/23/26","2","$0.82","$2.26","$161.74"
"04/23/2026","Buy to Open","SPXW 04/23/2026 7040.00 P","PUT S & P ...500 INDEX $7040 EXP 04/23/26","2","$0.57","$2.26","-$116.26"`;

  const processData = (val: string) => {
    if (val.trim()) {
      const transactions = parseCSV(val);
      if (transactions.length > 0) {
        const grouped = groupTrades(transactions);
        if (grouped.length > 0) {
          setTrades(grouped);
          // Adjust date range based on transactions
          const dates = transactions.map(t => t.rawDate.getTime());
          const minDate = new Date(Math.min(...dates));
          const maxDate = new Date(Math.max(...dates));
          setDateRange({ start: minDate, end: maxDate });
        } else {
          alert('Data parsed but no option trades were identified. Make sure the Action column contains "to Open" or "to Close".');
        }
      } else {
        alert('Could not parse any valid transaction rows. Please check the CSV format.');
      }
    }
  };

  const loadSampleData = () => {
    setCsvData(sampleCsv);
    processData(sampleCsv);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCsvData(val);
    processData(val);
  };

  const filteredTrades = useMemo(() => {
    return trades.filter(trade => 
      isWithinInterval(trade.openDate, { start: dateRange.start, end: dateRange.end })
    );
  }, [trades, dateRange]);

  const stats = useMemo(() => {
    const totalTrades = filteredTrades.length;
    
    if (totalTrades === 0) {
      return { totalTrades: 0, winRate: 0, totalProfit: 0, avgProfit: 0 };
    }

    const wins = filteredTrades.filter(t => t.profit > 0).length;
    const totalProfit = filteredTrades.reduce((sum, t) => sum + t.profit, 0);
    const winRate = (wins / totalTrades) * 100;
    const avgProfit = totalProfit / totalTrades;

    return { totalTrades, winRate, totalProfit, avgProfit };
  }, [filteredTrades]);

  const chartData = useMemo(() => {
    const sorted = [...filteredTrades].sort((a, b) => a.openDate.getTime() - b.openDate.getTime());
    let cumulative = 0;
    return sorted.map(t => {
      cumulative += t.profit;
      return {
        date: format(t.openDate, 'MM/dd'),
        profit: t.profit,
        cumulative: parseFloat(cumulative.toFixed(2))
      };
    });
  }, [filteredTrades]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col overflow-hidden font-sans text-slate-900">
      {/* Top Navigation */}
      <nav className="h-16 bg-slate-900 text-white flex items-center justify-between px-8 shrink-0 z-50">
        <div className="flex items-center space-x-4">
          <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center font-bold text-lg">Ω</div>
          <h1 className="text-xl font-semibold tracking-tight">OptionLogic <span className="text-slate-400 font-normal text-sm ml-2">Transaction Analyzer</span></h1>
        </div>
        <div className="flex items-center space-x-6 text-sm">
          <div className="flex flex-col items-end border-r border-slate-700 pr-6 mr-6 hidden md:flex">
            <span className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Analysis Focus</span>
            <span className="font-medium">All Identified Spreads</span>
          </div>
          {csvData && (
            <button 
              onClick={() => { setCsvData(''); setTrades([]); }}
              className="text-slate-400 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest mr-4"
            >
              Clear Data
            </button>
          )}
          <button className="bg-slate-800 hover:bg-slate-700 text-xs px-4 py-2 rounded-md border border-slate-700 transition-colors font-bold uppercase tracking-widest">
            Export History
          </button>
        </div>
      </nav>

      {!csvData ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-12 bg-slate-50 animate-in fade-in zoom-in duration-500">
          <div className="max-w-xl text-center space-y-4">
            <h2 className="text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.1]">Bridge the gap between data and edge.</h2>
            <p className="text-slate-500 text-lg leading-relaxed px-4">Paste your brokerage transaction log to reconstruct complex credit spread strategies.</p>
          </div>
          
          <div className="w-full max-w-2xl relative">
            <textarea
              placeholder="Paste CSV data from Schwab or TD here..."
              className="w-full h-56 p-8 bg-white border border-slate-200 rounded-3xl focus:outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all font-mono text-sm leading-relaxed shadow-xl shadow-slate-200/50"
              onChange={handleFileUpload}
            />
            <div className="absolute -bottom-16 left-0 right-0 flex justify-center">
              <button 
                onClick={loadSampleData}
                className="flex items-center gap-2 px-8 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm uppercase tracking-widest"
              >
                <Activity size={16} className="text-blue-500" />
                Analyze Sample Records
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col flex-1 overflow-hidden animate-in fade-in duration-700">
          {/* Key Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 p-0 shrink-0 bg-white border-b border-slate-200 shadow-sm divide-x divide-slate-100">
            {[
              { label: 'Net Profit / Loss', value: `$${stats.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, color: stats.totalProfit >= 0 ? 'text-emerald-600' : 'text-rose-600', border: 'border-emerald-500' },
              { label: 'Win Rate', value: `${stats.winRate.toFixed(1)}%`, border: 'border-blue-500' },
              { label: 'Strategy Sets', value: `${stats.totalTrades} Groups`, border: 'border-slate-400' },
              { label: 'Avg P/L Trade', value: `$${stats.avgProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, color: stats.avgProfit >= 0 ? 'text-emerald-600' : 'text-rose-600', border: 'border-amber-500' },
            ].map((metric, i) => (
              <div key={i} className={cn("px-8 py-5 border-l-4", metric.border)}>
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-[0.15em] mb-1">{metric.label}</p>
                <p className={cn("text-2xl font-mono font-bold tracking-tight", metric.color || "text-slate-900")}>
                  {metric.value}
                </p>
              </div>
            ))}
          </div>

          {/* Main Content Area */}
          <div className="flex flex-1 overflow-hidden p-6 gap-6 bg-slate-50">
            {/* Sidebar Filters */}
            <aside className="w-64 shrink-0 flex flex-col space-y-6 hidden lg:flex">
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-xs font-black text-slate-400 uppercase mb-5 tracking-widest">Inventory Filters</h3>
                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-tighter mb-2 block">Focus Symbol</label>
                    <select className="w-full text-sm font-bold border-slate-200 rounded-lg p-2.5 bg-slate-50 text-slate-700 focus:ring-2 focus:ring-blue-100">
                      <option>Composite View</option>
                      <option>SPXW / SPX</option>
                      <option>XSP Mini</option>
                    </select>
                  </div>
                  <div className="pt-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-tighter mb-3 block">Reporting Status</label>
                    <div className="space-y-3 mt-1">
                      {['Opened', 'Closed', 'Rolled', 'Expired'].map(st => (
                        <label key={st} className="flex items-center text-sm font-medium text-slate-600 cursor-pointer hover:text-blue-600 transition-colors">
                          <input type="checkbox" defaultChecked className="mr-3 w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500" />
                          {st} Transactions
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 shadow-sm shadow-blue-50/50">
                <h4 className="text-xs font-black text-blue-900 uppercase mb-2 tracking-widest">Trade Insight</h4>
                <p className="text-xs text-blue-700 leading-relaxed italic opacity-80">
                  Most of your identified credit spreads are {stats.winRate > 70 ? 'outperforming' : 'tracking'} institutional benchmarks. Monitoring rolling dates can further reduce fee-drag.
                </p>
              </div>
            </aside>

            {/* Content Region */}
            <div className="flex-1 flex flex-col space-y-6 overflow-hidden">
              {/* Chart Region */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm shrink-0">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Portfolio Equity Curve</h3>
                  <span className="text-[10px] font-bold text-indigo-500 px-2 py-1 bg-indigo-50 rounded uppercase">Real-time Parsing</span>
                </div>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="curveColor" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }} dx={-10} tickFormatter={(v) => `$${v}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                        itemStyle={{ color: '#60a5fa', fontWeight: 'bold' }}
                      />
                      <Area type="stepAfter" dataKey="cumulative" stroke="#3b82f6" strokeWidth={2.5} fill="url(#curveColor)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Transactions Table Container */}
              <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center shrink-0">
                  <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Analyzed Strategy Groups</h2>
                  <div className="flex space-x-2">
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-lg uppercase tracking-tightest">Auto-Grouped (2-4 legs)</span>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 text-slate-400 text-[10px] uppercase tracking-widest font-black border-b border-slate-200">
                      <tr>
                        <th className="px-8 py-4">Security / Expiry</th>
                        <th className="px-6 py-4">Strategy</th>
                        <th className="px-4 py-4 text-center">Qty</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-right">Net Res.</th>
                        <th className="px-8 py-4"></th>
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-100 font-mono">
                      {filteredTrades.map((trade) => (
                        <React.Fragment key={trade.id}>
                          <tr 
                            onClick={() => setExpandedTrade(expandedTrade === trade.id ? null : trade.id)}
                            className={cn(
                              "hover:bg-slate-50 group cursor-pointer transition-colors",
                              expandedTrade === trade.id ? "bg-blue-50/30" : ""
                            )}
                          >
                            <td className="px-8 py-5">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-900 uppercase tracking-tighter text-base">{trade.symbol}</span>
                                <span className="text-[10px] text-slate-400 uppercase font-sans font-bold tracking-tight">{format(trade.openDate, 'MMM dd, yyyy')}</span>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="font-sans text-[11px] leading-snug">
                                <span className="font-black text-slate-700 uppercase tracking-tighter">
                                  {trade.shortStrike && trade.longStrike ? `${trade.shortStrike}/${trade.longStrike} ` : ''}
                                  {trade.type} SPREAD
                                </span>
                                <p className="text-[10px] text-slate-400 italic font-medium">{trade.expiry}</p>
                              </div>
                            </td>
                            <td className="px-4 py-5 text-center">
                              <span className="text-xs font-black text-slate-600">
                                {trade.contracts}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-center">
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest",
                                trade.status === 'OPEN' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                                trade.status === 'EXPIRED' ? 'bg-slate-200 text-slate-600' :
                                trade.status === 'ROLLED' ? 'bg-amber-100 text-amber-700' :
                                'bg-emerald-100 text-emerald-700'
                              )}>
                                {trade.status}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-right font-bold">
                              <span className={trade.profit >= 0 ? "text-emerald-600" : "text-rose-600"}>
                                {trade.profit >= 0 ? '+$' : '-$'}{Math.abs(trade.profit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </td>
                            <td className="px-8 py-5 text-right">
                              <ChevronDown size={14} className={cn("text-slate-300 transition-transform duration-300 group-hover:text-blue-500", expandedTrade === trade.id ? "rotate-180 text-blue-500" : "")} />
                            </td>
                          </tr>
                          {expandedTrade === trade.id && (
                            <tr className="bg-slate-50/50">
                              <td colSpan={6} className="px-8 py-8 animate-in slide-in-from-top-4 duration-300">
                                <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-6">
                                  {/* Aggregated Summary View */}
                                  <div className="space-y-4">
                                    <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Execution Summary</h4>
                                      <span className="text-[10px] font-mono font-bold text-slate-400">UUID: {trade.id.split('-').pop()}</span>
                                    </div>
                                    <div className="space-y-3">
                                      {trade.openSummary && (
                                        <div className="flex items-start gap-4">
                                          <div className="p-1 px-1.5 bg-blue-50 text-blue-600 rounded text-[9px] font-black uppercase mt-0.5">OPEN</div>
                                          <p className="text-sm font-semibold text-slate-700 leading-tight">{trade.openSummary}</p>
                                        </div>
                                      )}
                                      {trade.closeSummary && (
                                        <div className="flex items-start gap-4">
                                          <div className="p-1 px-1.5 bg-emerald-50 text-emerald-600 rounded text-[9px] font-black uppercase mt-0.5">EXIT</div>
                                          <p className="text-sm font-semibold text-slate-700 leading-tight">{trade.closeSummary}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Detailed Leg Breakdown (Optional visibility/audit) */}
                                  <div className="space-y-3 pt-4 border-t border-slate-50">
                                    <h4 className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-2">Detailed Leg Audit Trail</h4>
                                    <div className="space-y-1">
                                      {trade.transactions.map((tx, idx) => (
                                        <div key={idx} className="flex items-center justify-between py-2.5 px-4 rounded-lg hover:bg-slate-50 font-mono text-xs border border-transparent transition-all group/aud">
                                          <div className="flex items-center gap-6">
                                            <span className="text-slate-400 w-24 uppercase font-sans font-bold text-[9px]">{format(tx.rawDate, 'MMM dd, HH:mm')}</span>
                                            <span className={cn(
                                              "w-24 font-black text-[9px] uppercase px-2 py-0.5 rounded text-center whitespace-nowrap",
                                              tx.action.includes('Sell') ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                                            )}>{tx.action}</span>
                                            <span className="text-slate-600 font-bold overflow-hidden text-ellipsis whitespace-nowrap max-w-[200px]">{tx.symbol}</span>
                                          </div>
                                          <div className="flex items-center gap-10">
                                            <div className="flex flex-col items-end">
                                              <span className="text-[9px] font-bold text-slate-300 uppercase leading-none mb-1">Impact</span>
                                              <span className={cn("font-bold text-[11px]", tx.amount >= 0 ? "text-emerald-600" : "text-rose-600")}>
                                                {tx.amount >= 0 ? '+$' : '-$'}{Math.abs(tx.amount).toFixed(2)}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="border-t border-slate-100 pt-4 flex justify-between items-center px-4 bg-slate-50/50 rounded-b-xl py-3 -mx-6 -mb-6">
                                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Net Performance Impact:</span>
                                     <span className={cn("text-xl font-bold font-mono tracking-tighter", trade.profit >= 0 ? "text-emerald-600" : "text-rose-600")}>
                                       {trade.profit >= 0 ? '+$' : '-$'}{Math.abs(trade.profit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                     </span>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Showing {filteredTrades.length} grouped series
                  </div>
                  <div className="flex space-x-6 list-none text-[10px] font-bold text-slate-400 uppercase list-inside italic">
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-slate-300 rounded-full"/> Consolidated USD Reporting</li>
                    <li className="flex items-center gap-2"><div className="w-1 h-1 bg-slate-300 rounded-full"/> FIFO Close Logic Managed</li>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
