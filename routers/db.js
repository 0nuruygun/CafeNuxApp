require("dotenv").config();
const sql = require('mssql');

const sqlConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PWD,
    database: process.env.DB_NAME,
    server: process.env.DB_SERVER,
    port: 1433,
    pool: {
        max: 10,
        min: 1, // Kapatıldı -> min: 0
        idleTimeoutMillis: 30000,
    },
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

// Açıldı: Global connection pool kullanımı
let poolPromise = sql.connect(sqlConfig);
// Kapatıldı: Her sorguda yeni pool açma
// const pool = await sql.connect(sqlConfig);

const runSQLWithPool = async (sqltext, params) => {
    try {
        // Açıldı: Global pool'dan bağlantı al
        const pool = await poolPromise;
        const request = pool.request();
        
        if (params) {
            if (Array.isArray(params)) {
                // Kapatıldı: secureSQLparams artık kullanılmıyor
                // params = secureSQLparams(params);
                params.forEach((param, i) => {
                    request.input(`param${i}`, param);
                });    
            } else {
                for (const [k, v] of Object.entries(params)) {
                    let reqK = k;
                    if (typeof reqK !== "string") {
                        reqK = new String(k);
                    }
                    request.input(reqK, v);
                }
            }
        }

        const result = await request.query(sqltext);

        // Açıldı: Direkt return kullan
        return result.recordsets;
        // Kapatıldı: Promise.resolve
        // return Promise.resolve(result.recordsets);

    } catch (err) {
        console.trace(`[db] error for query : ${sqltext}`);
        console.error(err);

        // Açıldı: throw err kullan
        throw err;
        // Kapatıldı: Promise.reject
        // return Promise.reject(err);
    }
};

module.exports = {
    runSQLWithPool,
    execsql: runSQLWithPool
};
