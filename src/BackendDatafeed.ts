import { KLineData } from "klinecharts";
import { SymbolInfo, Period } from "./types";
import axios from "axios";

export default class BackendDatafeed {
  constructor(apiKey: string) {
    this._apiKey = apiKey;
  }

  private _apiKey: string;

  // Helper function to convert period to CCXT timeframe
  convertPeriodToTimeframe(period: Period): string {
    const { multiplier, timespan } = period;
    if (timespan === 'minute') {
      return `${multiplier}m`;
    } else if (timespan === 'hour') {
      return `${multiplier}h`;
    } else if (timespan === 'day') {
      return '1d';
    } else if (timespan === 'week') {
      return '1w';
    } else if (timespan === 'month') {
      return '1M';
    } else if (timespan === 'year') {
      return '1y';
    } else {
      throw new Error('Invalid period timespan');
    }
  }

  async getHistoryKLineData(symbol: SymbolInfo, period: Period, from: number, to: number): Promise<KLineData[]> {
    console.log("period", period, 'symbol', symbol, 'from',from, 'to', to);
    try {
      const timeframe = this.convertPeriodToTimeframe(period);

      const url = `${this._apiKey}/coinPriceData`;
      const params = {
        BaseCurrency: symbol.name.split('/')[0], // Extract BaseCurrency from ticker
        QuoteCurrency: symbol.name.split('/')[1], // Extract QuoteCurrency from ticker
        Timeframe: timeframe,
        From: new Date(from).toISOString(),
        To: new Date(to).toISOString(),
        Exchange: symbol.exchange, // Use exchange if available
      };

      const response = await axios.get(url, { params });
      const result = response.data;
      console.log("result", result);
      return result.map(
        (data: {
          timestamp: number;
          open: number;
          high: number;
          low: number;
          close: number;
          volume: number;
          vw: number;
        }) => ({
          timestamp: data.timestamp,
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
          volume: data.volume,
        })
      );
    } catch (error) {
      console.error("Error fetching data:", error);
      throw error;
    }
  }
}
