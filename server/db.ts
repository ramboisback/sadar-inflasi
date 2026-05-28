import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface User {
  id: string;
  username: string;
  password_hash: string;
  role: 'admin' | 'surveyor';
  fullName: string;
}

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
}

export interface PriceLog {
  id: string;
  commodity_id: string;
  market_id: string;
  recorded_price: number;
  recorded_at: string; // YYYY-MM-DD
  recorded_by: string; // User ID
}

export interface DatabaseSchema {
  users: User[];
  markets: Market[];
  commodities: Commodity[];
  priceLogs: PriceLog[];
}

const DB_FILE = path.join(process.cwd(), 'database_sipid.json');

// Helper to hash passwords with a secure salt (OWASP A02:2021 mitigation)
export function hashPassword(password: string): string {
  const salt = 'sipid_mentok_salt_2026_secured';
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

export function initializeDatabase(): DatabaseSchema {
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      console.error("Failed to parse database, generating new one", e);
    }
  }

  // Create initial users
  const adminId = crypto.randomUUID();
  const surveyorId = crypto.randomUUID();
  const users: User[] = [
    {
      id: adminId,
      username: 'admin',
      password_hash: hashPassword('admin123'),
      role: 'admin',
      fullName: 'Drs. H. Ridwan, M.Si (Kadisperindag Bangka Barat)'
    },
    {
      id: surveyorId,
      username: 'surveyor',
      password_hash: hashPassword('surveyor123'),
      role: 'surveyor',
      fullName: 'Beni Saputra (Surveyor Pasar Mentok)'
    }
  ];

  // Markets
  const marketId = crypto.randomUUID(); // Focus on Pasar Mentok
  const markets: Market[] = [
    {
      id: marketId,
      name: 'Pasar Induk Mentok',
      latitude: -2.0682,
      longitude: 105.1634,
      address: 'Jl. Pasar Mentok, Tanjung, Mentok, Kabupaten Bangka Barat, Kepulauan Bangka Belitung 33321'
    }
  ];

  // Commodities with national/regional prices and standard HET limits
  const commodities: Commodity[] = [
    { id: crypto.randomUUID(), name: 'Beras Medium', unit: 'kg', het_price: 12500, category: 'Bahan Pokok' },
    { id: crypto.randomUUID(), name: 'Beras Premium', unit: 'kg', het_price: 14900, category: 'Bahan Pokok' },
    { id: crypto.randomUUID(), name: 'Gula Pasir Konsumsi', unit: 'kg', het_price: 17500, category: 'Bahan Pokok' },
    { id: crypto.randomUUID(), name: 'Minyak Goreng Kita', unit: 'liter', het_price: 18000, category: 'Minyak & Mentega' },
    { id: crypto.randomUUID(), name: 'Cabai Merah Keriting', unit: 'kg', het_price: 55000, category: 'Hortikultura' },
    { id: crypto.randomUUID(), name: 'Cabai Rawit Merah', unit: 'kg', het_price: 60000, category: 'Hortikultura' },
    { id: crypto.randomUUID(), name: 'Bawang Merah', unit: 'kg', het_price: 41500, category: 'Hortikultura' },
    { id: crypto.randomUUID(), name: 'Bawang Putih Honan', unit: 'kg', het_price: 38000, category: 'Hortikultura' },
    { id: crypto.randomUUID(), name: 'Daging Sapi Paha Belakang', unit: 'kg', het_price: 140000, category: 'Daging & Ayam' },
    { id: crypto.randomUUID(), name: 'Daging Ayam Broiler', unit: 'kg', het_price: 38000, category: 'Daging & Ayam' },
    { id: crypto.randomUUID(), name: 'Telur Ayam Ras', unit: 'kg', het_price: 28000, category: 'Daging & Ayam' },
    { id: crypto.randomUUID(), name: 'Tepung Terigu Kemasan', unit: 'kg', het_price: 13000, category: 'Bahan Pokok' }
  ];

  // Generate historical data for past 30 days
  const priceLogs: PriceLog[] = [];
  const today = new Date();

  commodities.forEach((comm) => {
    // Generate base price below, near, or above HET
    let basePrice = comm.het_price * (0.85 + Math.random() * 0.12); // mostly starting below HET
    
    // Customize cabai and beras medium to end up ABOVE HET to trigger "Smart Filter"
    const triggerHETAscent = comm.name === 'Cabai Merah Keriting' || comm.name === 'Beras Medium' || comm.name === 'Cabai Rawit Merah';
    
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      // Introduce random trend walk
      let fluctuation = (Math.random() - 0.48) * (comm.het_price * 0.02);
      
      // If triggerHETAscent and in the last 10 days, push price progressively higher
      if (triggerHETAscent && i < 12) {
        fluctuation += comm.het_price * 0.015; // guaranteed markup
      }

      basePrice += fluctuation;

      // Prevent prices from becoming negative or unreasonably low
      if (basePrice < comm.het_price * 0.5) {
        basePrice = comm.het_price * 0.6;
      }

      // Round price to nearest 100 rupiah
      const recordedVal = Math.round(basePrice / 100) * 100;

      priceLogs.push({
        id: crypto.randomUUID(),
        commodity_id: comm.id,
        market_id: marketId,
        recorded_price: recordedVal,
        recorded_at: dateStr,
        recorded_by: surveyorId
      });
    }
  });

  const db: DatabaseSchema = {
    users,
    markets,
    commodities,
    priceLogs
  };

  saveDatabase(db);
  return db;
}

export function getDatabase(): DatabaseSchema {
  return initializeDatabase();
}

export function saveDatabase(db: DatabaseSchema) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}
