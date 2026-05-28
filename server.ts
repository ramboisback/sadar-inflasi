import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { 
  getDatabase, 
  saveDatabase, 
  hashPassword, 
  initializeDatabase,
  User, 
  Commodity, 
  PriceLog, 
  Market 
} from './server/db.js';

// Setup type declarations if necessary
const PORT = 3000;

async function startServer() {
  const app = express();
  
  // OWASP A08:2021 Mitigate denial-of-service vector by setting a strict JSON size limit
  app.use(express.json({ limit: '10kb' }));

  // OWASP A05:2021 Security Misconfiguration defense HTTP headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN'); // Required to support safe development preview iframe
    next();
  });

  // Startup cryptographically safe token signing secret key (OWASP A02:2021)
  const TOKEN_SIGNING_SECRET = process.env.TOKEN_SIGNING_SECRET || crypto.randomBytes(32).toString('hex');

  // OWASP A09:2021 Central Enterprise Audit Logger
  const writeAuditLog = (action: string, actor: string, status: 'SUCCESS' | 'FAILURE' | 'WARNING', details: string) => {
    const timestamp = new Date().toISOString();
    console.log(`[SIPID SECURITY AUDIT] [${timestamp}] [${status}] Actor: ${actor} | Action: ${action} | Details: ${details}`);
  };

  // OWASP A07:2021 Login brute force security map
  const loginAttemptsTracker = new Map<string, { count: number; blockedUntil: number }>();

  const checkLoginRateLimit = (ip: string): { allowed: boolean; waitSeconds?: number } => {
    const now = Date.now();
    const record = loginAttemptsTracker.get(ip);
    if (record && record.blockedUntil > now) {
      return { allowed: false, waitSeconds: Math.ceil((record.blockedUntil - now) / 1000) };
    }
    return { allowed: true };
  };

  const logFailedLoginAttempt = (ip: string) => {
    const now = Date.now();
    const record = loginAttemptsTracker.get(ip) || { count: 0, blockedUntil: 0 };
    record.count += 1;
    if (record.count >= 5) {
      record.blockedUntil = now + 90 * 1000; // 90 seconds temporary lockout
      record.count = 0; // reset
      writeAuditLog('BRUTE_FORCE_LOCKOUT', ip, 'WARNING', 'Blocked repeated failing login attempts.');
    }
    loginAttemptsTracker.set(ip, record);
  };

  const clearFailedAttempts = (ip: string) => {
    loginAttemptsTracker.delete(ip);
  };

  // OWASP A02:2021 Secure token generator utilizing HMAC cryptographic verification
  const generateCryptographicToken = (userId: string, role: string): string => {
    const expires = Date.now() + 24 * 60 * 60 * 1000; // Valid for 24 hours
    const rawPayload = `${userId}:${role}:${expires}`;
    const hmac = crypto.createHmac('sha256', TOKEN_SIGNING_SECRET).update(rawPayload).digest('hex');
    return Buffer.from(`${rawPayload}:${hmac}`).toString('base64');
  };

  const verifyCryptographicToken = (token: string): { userId: string; role: string } | null => {
    try {
      const decoded = Buffer.from(token, 'base64').toString('ascii');
      const segments = decoded.split(':');
      if (segments.length !== 4) return null;

      const [userId, role, expiresStr, clientSignature] = segments;
      const expires = parseInt(expiresStr, 10);

      if (isNaN(expires) || Date.now() > expires) {
        return null; // Expired
      }

      const rawPayload = `${userId}:${role}:${expires}`;
      const expectedSignature = crypto.createHmac('sha256', TOKEN_SIGNING_SECRET).update(rawPayload).digest('hex');

      // Defend against timing attacks using verification timingSafeEqual
      if (clientSignature.length === expectedSignature.length &&
          crypto.timingSafeEqual(Buffer.from(clientSignature), Buffer.from(expectedSignature))) {
        return { userId, role };
      }
      return null;
    } catch {
      return null;
    }
  };

  // OWASP A03:2021 Input Injection checker (Anti XSS)
  const isInputUnsafe = (text: any): boolean => {
    if (typeof text !== 'string') return false;
    const maliciousPatterns = [/<script/i, /javascript:/i, /onload/i, /onerror/i, /<svg/i, /<img/i, /<body/i, /<iframe/i];
    return maliciousPatterns.some(pattern => pattern.test(text)) || text.includes('<') || text.includes('>');
  };

  // Initialize DB once on start
  let dbObj = initializeDatabase();

  // Middleware to authenticate admin/surveyor by token (OWASP A01:2021)
  const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'Akses ditolak. Token tidak ditemukan.' });
    }

    const token = authHeader.toString().replace('Bearer ', '');
    const verified = verifyCryptographicToken(token);
    if (!verified) {
      writeAuditLog('EXPIRED_OR_FORGED_TOKEN', req.ip || 'unknown', 'WARNING', 'Client supplied an invalid or modified token payload.');
      return res.status(401).json({ error: 'Sesi Anda tidak valid atau telah kedaluwarsa. Harap masuk kembali.' });
    }

    const user = dbObj.users.find(u => u.id === verified.userId);
    if (!user) {
      return res.status(403).json({ error: 'Pengguna tidak terdaftar.' });
    }

    // Attach user to request
    (req as any).user = user;
    next();
  };

  // Helper helper to calculate percentage and compare price
  function getCommoditiesSummary() {
    dbObj = getDatabase(); // sync freshest data
    const market = dbObj.markets[0]; // focus on Pasar Mentok
    
    return dbObj.commodities.map((comm) => {
      // Find logs for this commodity and market
      const logs = dbObj.priceLogs
        .filter(log => log.commodity_id === comm.id && log.market_id === market.id)
        .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());

      const latestLog = logs[0] || null;
      const prevLog = logs[1] || null;

      let latest_price = latestLog ? latestLog.recorded_price : 0;
      let prev_price = prevLog ? prevLog.recorded_price : latest_price;

      const priceDiff = latest_price - prev_price;
      const percentChange = prev_price > 0 ? (priceDiff / prev_price) * 100 : 0;
      
      const isWarning = latest_price > comm.het_price;
      const hetViolationPercentage = isWarning ? ((latest_price - comm.het_price) / comm.het_price) * 100 : 0;

      return {
        ...comm,
        latest_price,
        prev_price,
        priceDiff,
        percentChange: Number(percentChange.toFixed(2)),
        latest_recorded_at: latestLog ? latestLog.recorded_at : null,
        isWarning,
        hetViolationPercentage: Number(hetViolationPercentage.toFixed(2)),
        status: priceDiff > 0 ? 'UP' : priceDiff < 0 ? 'DOWN' : 'STABLE'
      };
    });
  }

  // API 1: Public Summary
  app.get('/api/public/summary', (req, res) => {
    try {
      const market = dbObj.markets[0];
      const commodities = getCommoditiesSummary();
      const alertCount = commodities.filter(c => c.isWarning).length;

      res.json({
        market,
        commodities,
        stats: {
          totalProducts: commodities.length,
          alertProductsCount: alertCount,
          lastUpdated: commodities.reduce((acc, curr) => {
            if (!acc) return curr.latest_recorded_at;
            if (!curr.latest_recorded_at) return acc;
            return new Date(curr.latest_recorded_at).getTime() > new Date(acc).getTime() ? curr.latest_recorded_at : acc;
          }, '')
        }
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API 2: Public Commodity History
  app.get('/api/public/commodity/:id/history', (req, res) => {
    try {
      dbObj = getDatabase();
      const { id } = req.params;
      const comm = dbObj.commodities.find(c => c.id === id);
      if (!comm) {
        return res.status(404).json({ error: 'Komoditi tidak ditemukan.' });
      }

      const market = dbObj.markets[0];
      const logs = dbObj.priceLogs
        .filter(log => log.commodity_id === id && log.market_id === market.id)
        .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
        .slice(-30); // Last 30 coordinates

      res.json({
        commodity: comm,
        history: logs
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // API 3: Auth Login with OWASP Hardening
  app.post('/api/auth/login', (req, res) => {
    const ip = req.ip || '127.0.0.1';
    try {
      // 1. Check Rate Limiter (OWASP A07:2021)
      const rateLimitCheck = checkLoginRateLimit(ip);
      if (!rateLimitCheck.allowed) {
        return res.status(429).json({ 
          error: `Terlahu banyak percobaan masuk. IP Anda diblokir sementara. Coba lagi dalam ${rateLimitCheck.waitSeconds} detik.` 
        });
      }

      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: 'Username dan Password wajib diisi.' });
      }

      // 2. Validate string inputs (Anti XSS / Injection)
      if (isInputUnsafe(username)) {
        logFailedLoginAttempt(ip);
        writeAuditLog('LOGIN', 'SUSPICIOUS_INPUT', 'WARNING', `Suspicious blocklist characters inside login inputs from IP: ${ip}`);
        return res.status(400).json({ error: 'Karakter input tidak valid deteksi.' });
      }

      const user = dbObj.users.find(u => u.username.toLowerCase() === username.toLowerCase());
      if (!user) {
        logFailedLoginAttempt(ip);
        // Generic response avoiding descriptive user enumeration (OWASP A07)
        return res.status(401).json({ error: 'Username atau Password salah.' });
      }

      // 3. Verify salted hash with transition legacy support (OWASP A02:2021)
      const hashedInput = hashPassword(password);
      // Legacy un-salted sha256 hash calculation
      const legacyHashedInput = crypto.createHash('sha256').update(password).digest('hex');

      const isLegacyMatch = user.password_hash === legacyHashedInput;
      const isSaltedMatch = user.password_hash === hashedInput;

      if (!isSaltedMatch && !isLegacyMatch) {
        logFailedLoginAttempt(ip);
        writeAuditLog('LOGIN_FAILED', username, 'FAILURE', `Failed login attempt from IP ${ip}`);
        return res.status(401).json({ error: 'Username atau Password salah.' });
      }

      // Auto upgrade legacy hashes on successful authentication!
      if (isLegacyMatch && !isSaltedMatch) {
        user.password_hash = hashedInput;
        saveDatabase(dbObj);
        writeAuditLog('PASSWORD_HASH_UPGRADE', username, 'SUCCESS', `User password hash upgraded in-place to salt structure for IP ${ip}`);
      }

      // Reset lockout counter on success login
      clearFailedAttempts(ip);

      // 4. Generate highly secure signed session token
      const token = generateCryptographicToken(user.id, user.role);

      writeAuditLog('LOGIN_SUCCESS', user.username, 'SUCCESS', `User authenticated and cryptographic session established from IP: ${ip}`);

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          fullName: user.fullName
        }
      });
    } catch (e: any) {
      writeAuditLog('LOGIN_ERROR', req.body?.username || 'unknown', 'FAILURE', `Severe login error: ${e.message}`);
      res.status(500).json({ error: 'Terjadi gangguan internal keamanan login.' });
    }
  });

  // API 4: Surveyor / Admin Post Price Log
  app.post('/api/surveyor/log-price', authenticateToken, (req, res) => {
    try {
      const { commodity_id, recorded_price, recorded_at } = req.body;
      const user = (req as any).user as User;

      if (!commodity_id || recorded_price === undefined || !recorded_at) {
        return res.status(400).json({ error: 'Parameter log-price tidak lengkap.' });
      }

      // Input Validation & XSS Sanity checks
      if (isInputUnsafe(commodity_id) || isInputUnsafe(recorded_at)) {
        writeAuditLog('PRICE_LOG', user.username, 'WARNING', 'Injection characters detected in dynamic parameters.');
        return res.status(400).json({ error: 'Karakter tidak sah dideteksi.' });
      }

      const comm = dbObj.commodities.find(c => c.id === commodity_id);
      if (!comm) {
        return res.status(404).json({ error: 'Komoditas tidak dikenal.' });
      }

      const priceNum = Number(recorded_price);
      if (isNaN(priceNum) || priceNum <= 0 || priceNum > 1000000) { // Limit max price logic to prevent buffer or database injection values
        return res.status(400).json({ error: 'Isian harga tidak valid atau di luar jangkauan regulasi.' });
      }

      const market = dbObj.markets[0]; // Pasar Mentok

      // Double-check if a price log on this date already exists for this commodity.
      const existingLogIndex = dbObj.priceLogs.findIndex(
        log => log.commodity_id === commodity_id && 
               log.recorded_at === recorded_at && 
               log.market_id === market.id
      );

      if (existingLogIndex !== -1) {
        dbObj.priceLogs[existingLogIndex].recorded_price = priceNum;
        dbObj.priceLogs[existingLogIndex].recorded_by = user.id;
      } else {
        const newLog: PriceLog = {
          id: crypto.randomUUID(),
          commodity_id,
          market_id: market.id,
          recorded_price: priceNum,
          recorded_at,
          recorded_by: user.id
        };
        dbObj.priceLogs.push(newLog);
      }

      saveDatabase(dbObj);

      writeAuditLog('PRICE_LOG', user.username, 'SUCCESS', `Updated price of '${comm.name}' to Rp ${priceNum} for date ${recorded_at}`);

      res.json({
        success: true,
        message: 'Log harga berhasil diperbarui.',
        updatedSummary: getCommoditiesSummary()
      });
    } catch (e: any) {
      writeAuditLog('PRICE_LOG_ERROR', (req as any).user?.username || 'unknown', 'FAILURE', `Failed to log price: ${e.message}`);
      res.status(500).json({ error: 'Internal database processing failure.' });
    }
  });

  // API 5: Admin Update Commodity HET / Details
  app.post('/api/admin/commodities', authenticateToken, (req, res) => {
    try {
      dbObj = getDatabase();
      const user = (req as any).user as User;
      
      // Strict Role Check (OWASP A01:2021-Broken Access Control)
      if (user.role !== 'admin') {
        writeAuditLog('UPDATE_HET', user.username, 'WARNING', 'Access Denied: Non-administrator attempted to modify HET / Commodity parameters.');
        return res.status(403).json({ error: 'Akses dibatasi hanya untuk Administrator.' });
      }

      const { id, het_price, name, unit } = req.body;
      if (!id) {
        return res.status(400).json({ error: 'ID Komoditas wajib disertakan.' });
      }

      // Parameter sanity validation against injection
      if (isInputUnsafe(id) || isInputUnsafe(name) || isInputUnsafe(unit)) {
        writeAuditLog('UPDATE_HET', user.username, 'WARNING', 'Blocked malicious HTML/script contents in parameters.');
        return res.status(400).json({ error: 'Nilai masukan tidak valid atau melanggar kebijakan keamanan.' });
      }

      const index = dbObj.commodities.findIndex(c => c.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Komoditas tidak ditemukan.' });
      }

      if (het_price !== undefined) {
        const pNum = Number(het_price);
        if (isNaN(pNum) || pNum <= 0) {
          return res.status(400).json({ error: 'HET harus angka positif.' });
        }
        dbObj.commodities[index].het_price = pNum;
      }

      const oldName = dbObj.commodities[index].name;
      if (name) dbObj.commodities[index].name = name;
      if (unit) dbObj.commodities[index].unit = unit;

      saveDatabase(dbObj);

      writeAuditLog('UPDATE_HET', user.username, 'SUCCESS', `Modified commodity HET details for '${oldName}': New HET Rp ${het_price || 'N/A'}`);

      res.json({
        success: true,
        message: 'Ketetapan komoditas HET berhasil disimpan.',
        commodities: dbObj.commodities
      });
    } catch (e: any) {
      writeAuditLog('UPDATE_HET_ERROR', (req as any).user?.username || 'unknown', 'FAILURE', `Failed update commodity details: ${e.message}`);
      res.status(500).json({ error: 'Terjadi kegagalan memproses penyimpanan data HET.' });
    }
  });

  // API 5B: Add New Commodity (OWASP A01:2021 & A03:2021 Hardening)
  app.post('/api/admin/commodities/new', authenticateToken, (req, res) => {
    try {
      dbObj = getDatabase();
      const user = (req as any).user as User;

      // Strict Role Check (OWASP A01:2021-Broken Access Control)
      if (user.role !== 'admin') {
        writeAuditLog('CREATE_COMMODITY', user.username, 'WARNING', 'Access Denied: Non-administrator attempted to add new commodity.');
        return res.status(403).json({ error: 'Akses dibatasi hanya untuk Administrator.' });
      }

      const { name, category, unit, het_price } = req.body;
      if (!name || !category || !unit || het_price === undefined) {
        return res.status(400).json({ error: 'Data komoditas baru tidak lengkap.' });
      }

      // Input Validation against Injection / Stored XSS
      if (isInputUnsafe(name) || isInputUnsafe(category) || isInputUnsafe(unit)) {
        writeAuditLog('CREATE_COMMODITY', user.username, 'WARNING', 'Blocked malicious scripting or injection attempts in commodity fields.');
        return res.status(400).json({ error: 'Data masukan mengandung karakter atau skrip berbahaya.' });
      }

      const priceNum = Number(het_price);
      if (isNaN(priceNum) || priceNum <= 0) {
        return res.status(400).json({ error: 'HET harus berupa angka positif.' });
      }

      const newCommodity = {
        id: crypto.randomUUID(),
        name,
        category,
        unit,
        het_price: priceNum
      };

      dbObj.commodities.push(newCommodity);

      // Seed a default initial price log for today
      const market = dbObj.markets[0];
      dbObj.priceLogs.push({
        id: crypto.randomUUID(),
        commodity_id: newCommodity.id,
        market_id: market.id,
        recorded_price: priceNum,
        recorded_at: new Date().toISOString().split('T')[0],
        recorded_by: user.id
      });

      saveDatabase(dbObj);

      writeAuditLog('CREATE_COMMODITY', user.username, 'SUCCESS', `Created new commodity '${name}' under category '${category}' with HET ${priceNum}`);

      res.json({
        success: true,
        message: 'Komoditas baru berhasil ditambahkan.',
        commodities: dbObj.commodities
      });
    } catch (e: any) {
      writeAuditLog('CREATE_COMMODITY_ERROR', (req as any).user?.username || 'unknown', 'FAILURE', `Failed to add commodity: ${e.message}`);
      res.status(500).json({ error: 'Gagal memproses penambahan komoditas baru secara aman.' });
    }
  });

  // API 5C: Delete Commodity (OWASP A01:2021 & A03:2021 Hardening)
  app.delete('/api/admin/commodities/:id', authenticateToken, (req, res) => {
    try {
      dbObj = getDatabase();
      const user = (req as any).user as User;

      // Strict Role Check (OWASP A01:2021)
      if (user.role !== 'admin') {
        writeAuditLog('DELETE_COMMODITY', user.username, 'WARNING', `Access Denied: Non-administrator attempted to delete commodity ID: ${req.params.id}`);
        return res.status(403).json({ error: 'Akses dibatasi hanya untuk Administrator.' });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ error: 'ID komoditas wajib disertakan.' });
      }

      if (isInputUnsafe(id)) {
        writeAuditLog('DELETE_COMMODITY', user.username, 'WARNING', 'Invalid parameter characters in commodity ID.');
        return res.status(400).json({ error: 'Parameter tidak valid didefinisikan.' });
      }

      const index = dbObj.commodities.findIndex(c => c.id === id);
      if (index === -1) {
        return res.status(404).json({ error: 'Komoditas tidak ditemukan.' });
      }

      const deletedName = dbObj.commodities[index].name;

      // Remove commodity
      dbObj.commodities.splice(index, 1);

      // Clean up associated price logs
      dbObj.priceLogs = dbObj.priceLogs.filter(log => log.commodity_id !== id);

      saveDatabase(dbObj);

      writeAuditLog('DELETE_COMMODITY', user.username, 'SUCCESS', `Deleted commodity '${deletedName}' (ID: ${id}) and purged all price log histories.`);

      res.json({
        success: true,
        message: 'Komoditas berhasil dihapus.',
        commodities: dbObj.commodities
      });
    } catch (e: any) {
      writeAuditLog('DELETE_COMMODITY_ERROR', (req as any).user?.username || 'unknown', 'FAILURE', `Failed to delete commodity: ${e.message}`);
      res.status(500).json({ error: 'Gagal memproses penghapusan komoditas secara aman.' });
    }
  });

  // API 6: Server-side Smart Inflation Analysis with Gemini!
  app.post('/api/ai/analysis', async (req, res) => {
    try {
      const key = process.env.GEMINI_API_KEY;
      if (!key) {
        return res.status(200).json({ 
          error: "API Key Gemini tidak terkonfigurasi. Silakan tambahkan 'GEMINI_API_KEY' pada menu Settings > Secrets di AI Studio.",
          analysis: "### 💡 Analisis Sistem Terbatas\n\nUntuk mendapatkan rekomendasi inflasi cerdas dengan kecerdasan buatan, mohon konfigurasikan akun API Key Anda.\n\nContoh Rekomendasi Umum Pangan Bangka Barat:\n- Mengadakan Operasi Pasar Murah untuk **Beras Medium** di kawasan Mentok.\n- Menjalin Kerjasama Antar Daerah (KAD) untuk suplai **Cabai Merah** dari daerah produksi penyuplai terdekat (seperti Lampung atau Palembang)."
        });
      }

      const commoditiesSummary = getCommoditiesSummary();
      const violatedHEThat = commoditiesSummary.filter(c => c.isWarning);
      const majorRisks = commoditiesSummary
        .sort((a, b) => b.percentChange - a.percentChange)
        .slice(0, 3); // top 3 movers

      // Prompt crafting for government inflation analysis
      const systemInstStr = `Anda adalah Ahli Analis Kebijakan Ekonomi Makro dan Pengendalian Inflasi Daerah untuk Dinas Perdagangan, Koperasi, dan UKM Kabupaten Bangka Barat, Provinsi Kepulauan Bangka Belitung. Berikan analisis profesional, santun, dan sangat kontekstual berdasarkan data harga pasar harian terkini. Gunakan Bahasa Indonesia yang baik dan terstruktur dengan rapi.`;

      const promptMsg = `Berikut adalah data harga pangan pokok terkini di Pasar Induk Mentok, Bangka Barat:
- Total Komoditi dipantau: ${commoditiesSummary.length}
- Komoditi di atas Harga Eceran Tertinggi (HET) Pemerintah: ${violatedHEThat.map(c => `${c.name} (Harga: Rp ${c.latest_price}/kg, HET: Rp ${c.het_price}/kg, Lewat HET: +${c.hetViolationPercentage}%)`).join(', ') || 'Tidak ada komoditi di atas HET'}
- Kenaikan harga teratas (fluktuasi harian): ${majorRisks.map(c => `${c.name} (${c.percentChange > 0 ? '+' : ''}${c.percentChange}% dengan harga Rp ${c.latest_price}/kg)`).join(', ')}

Berikan laporan evaluasi ringkas dan taktis berbentuk Markdown, meliputi:
1. **Ringkasan Status Inflasi**: Penilaian singkat mengenai tekanan inflasi pangan pokok di Pasar Induk Mentok.
2. **Sorotan Masalah Utama**: Analisis singkat mengapa komoditas tertentu mengalami lonjakan di atas HET atau peningkatan fluktuasi tajam (konteks geografis kepulauan Bangka Barat yang bergantung pasokan luar pulau lewat pelabuhan Tanjung Kalian Mentok).
3. **Rekomendasi Tindakan Cepat (Taktis)**: Ajukan minimal 3 langkah nyata TPID (Tim Pengendalian Inflasi Daerah) Bangka Barat (misal: Operasi Pasar Terbukan Sidak, subsidi biaya logistik melalui Pelabuhan Tanjung Kalian, Kerjasama Antar Daerah / KAD).`;

      // Lazy instantiation to prevent startup crash if API key is invalid
      const ai = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const aiResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: promptMsg,
        config: {
          systemInstruction: systemInstStr,
          temperature: 0.7,
        }
      });

      const responseText = aiResponse.text || "Gagal menghasilkan analisis AI.";
      
      res.json({
        success: true,
        analysis: responseText
      });
    } catch (e: any) {
      console.error("Gemini API Error:", e);
      res.status(200).json({ 
        error: `Gagal memanggil Gemini API: ${e.message}`,
        analysis: "### ⚠️ Kesalahan Komunikasi AI\n\nTerjadi kesalahan koneksi ke peladen kecerdasan buatan. Harap periksa status API Key Anda atau ulas kembali detail error."
      });
    }
  });

  // Vite development integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SIPID Bangka Barat server boot running on: http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Fatal Server Startup Error:", err);
});
