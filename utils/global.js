class onlineUsers {
    constructor() {
        if (!onlineUsers.instance) {
            this.online = []; // { user: string, timestamp: number } şeklinde tutulacak
            this.startCleanupInterval(); // Temizleme işlemini başlat
            onlineUsers.instance = this;
        }
        return onlineUsers.instance;
    }

    // Kullanıcı ekleme fonksiyonu
    addUser(user) {
        const timestamp = Date.now();
        const existingUser = this.online.find(item => item.user.userId === user.userId);

        if (existingUser) {
            // SessionId ve timestamp güncelleniyor
            existingUser.user.sessionId = user.sessionId;
            existingUser.timestamp = timestamp;
        } else {
            // Yeni kullanıcı ekleniyor
            this.online.push({ user, timestamp });
        }
    }

    // Eski kullanıcıları temizleme fonksiyonu
    cleanOldUsers() {
        const now = Date.now();
        const maxTime = 21600000; // 6 saat = 21600000 milisaniye

        for (let i = this.online.length - 1; i >= 0; i--) {
            if (now - this.online[i].timestamp > maxTime) {
                console.log(`${this.online[i].user} kaldırıldı.`);
                this.online.splice(i, 1); // Eski kullanıcıyı diziden kaldır
            }
        }
    }

    // Periyodik temizleme işlemini başlat
    startCleanupInterval() {
        setInterval(() => this.cleanOldUsers(), 21600000); // 6 saatte bir temizle
    }

    // Online kullanıcıları getirme fonksiyonu
    getOnlineUsers() {
        return this.online.map(u => u.user);
    }
}

const instance = new onlineUsers();

module.exports = instance;