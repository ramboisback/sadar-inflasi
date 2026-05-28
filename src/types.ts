export interface Market {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string;
}

export interface Commodity {
  id: string;
  name: string;
  unit: string;
  het_price: number;
  category: string;
  latest_price?: number;
  prev_price?: number;
  priceDiff?: number;
  percentChange?: number;
  latest_recorded_at?: string | null;
  isWarning?: boolean;
  hetViolationPercentage?: number;
  status?: 'UP' | 'DOWN' | 'STABLE';
}

export interface PriceLog {
  id: string;
  commodity_id: string;
  market_id: string;
  recorded_price: number;
  recorded_at: string;
  recorded_by: string;
}

export interface DashboardStats {
  totalProducts: number;
  alertProductsCount: number;
  lastUpdated: string;
}

export interface SummaryResponse {
  market: Market;
  commodities: Commodity[];
  stats: DashboardStats;
}

export interface UserSession {
  token: string;
  user: {
    id: string;
    username: string;
    role: 'admin' | 'surveyor';
    fullName: string;
  };
}
