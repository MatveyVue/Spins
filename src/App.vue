<template>
  <div class="app">

    <!-- SPLASH (for users not in Telegram or for local testing) -->
    <div v-if="!user" class="splash">
      <div class="splash-logo">
        <span class="splash-icon">◎</span>
        <span class="splash-title">TON Roulette</span>
      </div>
      <p class="splash-sub">Multiplayer · Fair · Instant</p>
      <button class="splash-btn" @click="quickLogin">Start Playing</button>
    </div>

    <!-- MAIN APP -->
    <div v-else class="main">

      <!-- HEADER -->
      <header class="hdr">
        <div class="hdr-user">
          <div class="hdr-avatar">{{ user.emoji }}</div>
          <div class="hdr-info">
            <div class="hdr-name">{{ user.name }}</div>
            <div class="hdr-handle">@{{ user.handle }}</div>
          </div>
        </div>
        <div class="hdr-balance" @click="openModal('deposit')">
          <span class="hdr-bal-num">{{ fmt(balance) }}</span>
          <span class="hdr-bal-cur">TON</span>
        </div>
      </header>

      <!-- NAVIGATION -->
      <nav class="nav">
        <button :class="['nav-btn', { active: tab === 'game' }]" @click="tab = 'game'">Game</button>
        <button :class="['nav-btn', { active: tab === 'profile' }]" @click="tab = 'profile'">Profile</button>
        <button v-if="isAdmin" :class="['nav-btn', { active: tab === 'admin' }]" @click="switchAdmin">Admin</button>
      </nav>

      <!-- ═══ GAME TAB ═══ -->
      <div v-if="tab === 'game'" class="tab game-tab">

        <div v-if="!isConnected" class="conn-banner">
          <span class="conn-dot"></span> Connecting…
        </div>

        <div class="stats-row">
          <div class="stat-box">
            <span :class="['stat-val', { danger: timeLeft <= 5 && !isSpinning }]">
              {{ isSpinning ? '—' : timeLeft + 's' }}
            </span>
            <span class="stat-lbl">Timer</span>
          </div>
          <div class="stat-box">
            <span class="stat-val gold">{{ fmt(game.totalBet) }}</span>
            <span class="stat-lbl">Prize Pool</span>
          </div>
          <div class="stat-box">
            <span class="stat-val">{{ game.players.length }}</span>
            <span class="stat-lbl">Players</span>
          </div>
        </div>

        <div class="timer-track">
          <div
            class="timer-fill"
            :class="{ danger: timeLeft <= 5 && !isSpinning }"
            :style="{
              width: getTimerWidth(),
              transition: isSpinning ? 'none' : 'width 0.5s linear, background 0.3s'
            }"
          ></div>
        </div>

        <div class="wheel-section">
          <div class="wheel-wrap">
            <canvas ref="wheelCanvas" width="280" height="280" class="wheel-canvas"></canvas>
            <div class="wheel-pointer"></div>
            <div class="wheel-center">◎</div>
          </div>
        </div>

        <div class="bet-card">
          <div class="bet-row">
            <button class="adj-btn" @click="adjustBet(-0.5)" :disabled="isSpinning || userAlreadyBet">−</button>
            <div class="bet-field">
              <input type="number" v-model.number="betAmount" min="0.1" step="0.1"
                :disabled="isSpinning || userAlreadyBet" class="bet-input" />
              <span class="bet-cur">TON</span>
            </div>
            <button class="adj-btn" @click="adjustBet(+0.5)" :disabled="isSpinning || userAlreadyBet">+</button>
          </div>

          <div class="quick-row">
            <button v-for="a in [0.5, 1, 5, 10]" :key="a" class="quick-btn"
              :disabled="isSpinning || userAlreadyBet || a > balance"
              @click="betAmount = a">{{ a }}</button>
          </div>

          <button class="place-btn"
            :class="{ active: canBet, done: userAlreadyBet }"
            :disabled="(!canBet && !userAlreadyBet) || betLoading"
            @click="placeBet">
            <span v-if="betLoading">Placing…</span>
            <span v-else-if="isSpinning">Spinning…</span>
            <span v-else-if="userAlreadyBet">Bet placed ✓</span>
            <span v-else>Place Bet</span>
          </button>
          <div v-if="betError" class="bet-error">{{ betError }}</div>
        </div>

        <div class="players-card">
          <div class="players-head">
            <span class="card-title">Players in this round</span>
            <span class="players-count">{{ game.players.length }}</span>
          </div>
          <div v-if="game.status === 'waiting_for_players'" class="empty-msg">Be the first to join and start the round!</div>
          <div v-else-if="!game.players.length" class="empty-msg">Waiting for players...</div>
          <div v-else class="players-list">
            <div v-for="(p, i) in game.players" :key="p.userId + i" class="player-row"
              :style="{ borderLeftColor: playerColor(p.userId) }">
              <div class="pr-left">
                <span class="pr-emoji">{{ p.emoji }}</span>
                <span class="pr-name" :class="{ 'pr-me': p.userId === user.id }">
                  {{ p.name }}<span v-if="p.userId === user.id" class="pr-you"> you</span>
                </span>
              </div>
              <div class="pr-right">
                <span class="pr-chance">{{ playerChance(p) }}%</span>
                <span class="pr-bet">{{ fmt(p.bet) }} TON</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ PROFILE TAB ═══ -->
      <div v-if="tab === 'profile'" class="tab profile-tab">
        <div class="profile-hero">
          <div class="profile-avatar">{{ user.emoji }}</div>
          <div class="profile-name">{{ user.name }}</div>
          <div class="profile-handle">@{{ user.handle }}</div>
        </div>
        <div class="pstats">
          <div class="pstat"><span class="pstat-val">{{ stats.played }}</span><span class="pstat-lbl">Played</span></div>
          <div class="pstat"><span class="pstat-val">{{ stats.won }}</span><span class="pstat-lbl">Wins</span></div>
          <div class="pstat"><span class="pstat-val gold">{{ fmt(stats.earned) }}</span><span class="pstat-lbl">Earned</span></div>
          <div class="pstat"><span class="pstat-val">{{ winRate }}%</span><span class="pstat-lbl">Rate</span></div>
        </div>
        <div class="ref-card">
          <div class="ref-head">
            <span class="card-title">Referral</span>
            <span class="ref-bonus">+5% from friends</span>
          </div>
          <div class="ref-row">
            <input class="ref-input" :value="referralLink" readonly />
            <button class="copy-btn" @click="copyRef">{{ copied ? '✓' : '⎘' }}</button>
          </div>
        </div>
        <div class="fin-row">
          <button class="fin-btn green" @click="openModal('deposit')">+ Deposit</button>
          <button class="fin-btn red" @click="openModal('withdraw')" :disabled="balance < 0.1">Withdraw</button>
        </div>
        <div v-if="history.length" class="history-card">
          <div class="card-title" style="margin-bottom:12px">History</div>
          <div class="history-list">
            <div v-for="(h, i) in history" :key="i" class="history-row">
              <div class="hist-left">
                <span :class="['hist-result', h.won ? 'win' : 'loss']">{{ h.won ? 'WIN' : 'LOSS' }}</span>
                <span class="hist-time">{{ formatTime(h.ts) }}</span>
              </div>
              <span class="hist-amount" :class="h.won ? 'win' : 'loss'">
                {{ h.won ? '+' : '-' }}{{ fmt(h.amount) }} TON
              </span>
            </div>
          </div>
        </div>
        
        <!-- Кнопка дисконнекта кошелька -->
        <div v-if="tonConnected" class="wallet-disconnect">
          <button class="disconnect-btn" @click="disconnectWallet">
            <span>🔌</span> Disconnect Wallet
          </button>
        </div>
      </div>

      <!-- ═══ ADMIN TAB ═══ -->
      <div v-if="tab === 'admin' && isAdmin" class="tab admin-tab">
        <div class="admin-stats">
          <div class="astat"><span class="astat-val">{{ adminData.totalUsers }}</span><span class="astat-lbl">Users</span></div>
          <div class="astat"><span class="astat-val">{{ adminData.totalGames }}</span><span class="astat-lbl">Games</span></div>
          <div class="astat"><span class="astat-val gold">{{ fmt(adminData.totalVolume) }}</span><span class="astat-lbl">Volume</span></div>
          <div class="astat"><span class="astat-val green">{{ fmt(adminData.houseBalance) }}</span><span class="astat-lbl">House</span></div>
        </div>
        <div class="admin-actions">
          <button class="admin-action-btn" @click="triggerRoundEnd(true)">Force End Round</button>
          <button class="admin-action-btn danger-btn" @click="createFirestoreRound">Reset Round</button>
        </div>
        <div class="admin-section">
          <div class="section-head">
            <span class="card-title">Deposit Requests</span>
            <span class="badge">{{ adminData.deposits.length }}</span>
          </div>
          <div v-if="!adminData.deposits.length" class="empty-msg">No pending deposits</div>
          <div v-for="r in adminData.deposits" :key="r.id" class="req-row">
            <div class="req-info">
              <span class="req-user">{{ r.userName }} <span class="req-uid">#{{ (r.userId||'').slice(-4) }}</span></span>
              <span class="req-meta">{{ fmt(r.amount) }} TON · {{ formatTime(r.ts) }}</span>
              <span v-if="r.txHash" class="req-txhash">tx: {{ r.txHash.slice(0,16) }}…</span>
            </div>
            <div class="req-actions">
              <button class="req-approve" @click="approveDeposit(r)" :disabled="r.processing">✓</button>
              <button class="req-reject" @click="rejectDeposit(r)" :disabled="r.processing">✗</button>
            </div>
          </div>
        </div>
        <div class="admin-section">
          <div class="section-head">
            <span class="card-title">Withdrawal Requests</span>
            <span class="badge">{{ adminData.withdraws.length }}</span>
          </div>
          <div v-if="!adminData.withdraws.length" class="empty-msg">No pending withdrawals</div>
          <div v-for="r in adminData.withdraws" :key="r.id" class="req-row">
            <div class="req-info">
              <span class="req-user">{{ r.userName }} <span class="req-uid">#{{ (r.userId||'').slice(-4) }}</span></span>
              <span class="req-meta">{{ fmt(r.amount) }} TON · {{ formatTime(r.ts) }}</span>
              <span class="req-wallet">→ {{ r.wallet ? r.wallet.slice(0,14)+'…' : 'no wallet' }}</span>
            </div>
            <div class="req-actions">
              <button class="req-approve" @click="approveWithdraw(r)" :disabled="r.processing">✓ Paid</button>
              <button class="req-reject" @click="rejectWithdraw(r)" :disabled="r.processing">✗ Deny</button>
            </div>
          </div>
        </div>
        <div class="admin-section">
          <div class="card-title" style="margin-bottom:12px">All Users</div>
          <div v-if="!adminData.users.length" class="empty-msg">No users yet</div>
          <div v-for="u in adminData.users" :key="u.id" class="user-row">
            <div class="user-info">
              <span class="user-emoji">{{ u.emoji }}</span>
              <div>
                <span class="user-name-txt">{{ u.name }}</span>
                <span class="user-bal">{{ fmt(u.balance) }} TON</span>
              </div>
            </div>
            <div class="user-actions">
              <button class="small-btn" @click="adminAddBalance(u, 10)">+10</button>
              <button class="small-btn danger-sm" @click="adminSetBalance(u)">Set</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- WINNER OVERLAY -->
    <transition name="fade">
      <div v-if="winner" class="overlay" @click="dismissWinner">
        <div class="winner-card" @click.stop>
          <div class="wc-trophy">🏆</div>
          <div class="wc-label">Winner</div>
          <div class="wc-name">{{ winner.name }}</div>
          <div class="wc-prize">+{{ fmt(winner.prize) }} TON</div>
          <div v-if="winner.isMe" class="wc-you">That's you! 🎉</div>
          <div v-else-if="winner.myLoss > 0" class="wc-loss">−{{ fmt(winner.myLoss) }} TON</div>
          <button class="wc-close" @click="dismissWinner">New Round</button>
        </div>
      </div>
    </transition>

    <!-- DEPOSIT MODAL - ИСПРАВЛЕНО -->
    <transition name="fade">
      <div v-if="modal === 'deposit'" class="overlay" @click.self="closeModal">
        <div class="modal-card">
          <div class="modal-title">Deposit TON</div>
          
          <div class="preset-row">
            <button v-for="a in [5,10,25,50,100]" :key="a"
              :class="['preset-btn',{active:depositAmt===a}]" @click="depositAmt=a">{{ a }}</button>
          </div>
          
          <div class="modal-field">
            <input type="number" v-model.number="depositAmt" min="0.1" step="0.1" class="modal-input" placeholder="Amount" />
            <span class="modal-cur">TON</span>
          </div>

          <button v-if="!isTonConnectReady" class="ton-connect-btn" @click="initTonConnect" :disabled="tonConnectLoading">
            <span>💎</span> {{ tonConnectLoading ? 'Initializing...' : 'Connect TON Wallet' }}
          </button>

          <button v-else-if="!tonConnected" class="ton-connect-btn" @click="connectTonWallet">
            <span>💎</span> Connect TON Wallet
          </button>

          <button v-else class="ton-connect-btn success" @click="processDeposit">
            <span>✅</span> Confirm Deposit
          </button>

          <div v-if="depositLoading" class="loading-row">
            <span class="spinner-small"></span> Processing...
          </div>
          <div v-if="depositSuccess" class="success-msg">✓ Deposit successful! +{{ fmt(depositAmt) }} TON</div>
          
          <div class="modal-btns">
            <button class="modal-cancel" @click="closeModal">Close</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- WITHDRAW MODAL - ИСПРАВЛЕНО -->
    <transition name="fade">
      <div v-if="modal === 'withdraw'" class="overlay" @click.self="closeModal">
        <div class="modal-card">
          <div class="modal-title">Withdraw TON</div>
          
          <div class="modal-avail">Available: <strong class="gold">{{ fmt(balance) }} TON</strong></div>
          
          <div class="preset-row">
            <button v-for="a in [5,10,25,50]" :key="a"
              :class="['preset-btn',{active:withdrawAmt===a}]" :disabled="a>balance" @click="withdrawAmt=a">{{ a }}</button>
            <button :class="['preset-btn',{active:withdrawAmt===balance}]" @click="withdrawAmt=balance">MAX</button>
          </div>
          
          <div class="modal-field">
            <input type="number" v-model.number="withdrawAmt" min="0.1" :max="balance" step="0.1" class="modal-input" />
            <span class="modal-cur">TON</span>
          </div>
          
          <div class="modal-field">
            <input type="text" v-model="withdrawWallet" class="modal-input"
              placeholder="Your TON wallet address" style="font-size:12px" />
          </div>

          <div v-if="withdrawWallet && !isValidTonAddress" class="error-message small">
            Invalid TON address format (should start with EQ, UQ, or 0:)
          </div>

          <button v-if="!isTonConnectReady" class="ton-connect-btn" @click="initTonConnect" :disabled="tonConnectLoading">
            <span>💎</span> {{ tonConnectLoading ? 'Initializing...' : 'Connect TON Wallet' }}
          </button>

          <button v-else-if="!tonConnected" class="ton-connect-btn" @click="connectTonWallet">
            <span>💎</span> Connect TON Wallet
          </button>

          <button v-else class="ton-connect-btn success" @click="processWithdraw" :disabled="!canWithdraw">
            <span>💸</span> Confirm Withdrawal
          </button>

          <div v-if="withdrawLoading" class="loading-row">
            <span class="spinner-small"></span> Processing...
          </div>
          <div v-if="withdrawSuccess" class="success-msg">✓ Withdrawal initiated! Check your wallet.</div>
          
          <div class="modal-btns">
            <button class="modal-cancel" @click="closeModal">Close</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Toast -->
    <transition name="toast-anim">
      <div v-if="toastMsg" class="toast">{{ toastMsg }}</div>
    </transition>

  </div>
</template>

<script>
import { db } from './firebase.js';
import {
  doc, collection, addDoc, updateDoc, getDoc, getDocs,
  onSnapshot, serverTimestamp, query, orderBy, limit,
  where, setDoc, increment, writeBatch, runTransaction
} from 'firebase/firestore';
import { TonConnectUI } from '@tonconnect/ui';

const EMOJIS = ['😎','🦊','🐸','🐼','🦁','🐨','🐯','🦅','🐺','🦝','🐻','🦋'];
const COLORS  = ['#e05252','#52a0e0','#52c77a','#e0a052','#9b52e0','#52d4e0','#e0527a','#7ae052'];
const ROUND_TIME  = 30; // Seconds
const HOUSE_FEE   = 0.05; // 5%
const HOUSE_WALLET = 'UQCH_BLQPJtnfj75s3YBu3bmaUTlRi6_I7difhNqINwrRC0i'; // Исправленный формат для теста

// --- Helper Functions ---
function randInt(n) { return Math.floor(Math.random() * n); }
function weightedRandom(players) {
  const total = players.reduce((s, p) => s + p.bet, 0);
  let r = Math.random() * total;
  for (const p of players) { r -= p.bet; if (r <= 0) return p; }
  return players[players.length - 1];
}

// Функция для валидации и нормализации TON адреса
function normalizeTonAddress(address) {
  if (!address) return null;
  
  // Убираем пробелы
  address = address.trim();
  
  // TON адреса должны начинаться с EQ, UQ или 0:
  if (address.startsWith('EQ') || address.startsWith('UQ') || address.startsWith('0:')) {
    return address;
  }
  
  return null;
}

// Функция для кодирования payload в правильный формат base64
function encodePayload(text) {
  // Для обычного текстового комментария используем простой base64
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach(byte => binary += String.fromCharCode(byte));
  return btoa(binary);
}

export default {
  name: 'App',

  data() {
    return {
      ROUND_TIME, HOUSE_WALLET,
      user: null, tab: 'game', balance: 0,
      isConnected: false,

      betAmount: 1, betLoading: false, betError: '',
      game: { id: null, players: [], totalBet: 0, status: 'waiting_for_players', endsAt: null },

      isSpinning: false, timeLeft: ROUND_TIME,
      timerHandle: null, spinAngle: 0, animFrame: null, winner: null,

      _unsubGame: null, _unsubUser: null,
      _unsubAdmin: {},

      stats: { played: 0, won: 0, earned: 0 },
      history: [], copied: false,

      modal: null,
      depositAmt: 10, depositLoading: false, depositSuccess: false,
      withdrawAmt: 10, withdrawWallet: '', withdrawLoading: false, withdrawSuccess: false,

      adminData: {
        totalUsers: 0, totalGames: 0, totalVolume: 0, houseBalance: 0,
        deposits: [], withdraws: [], users: [],
      },
      toastMsg: '', _toastTimer: null,
      
      // TON Connect
      tonConnectUI: null,
      tonConnected: false,
      tonConnectLoading: false,
    };
  },

  computed: {
    isAdmin() { return this.user?.handle === 'whsxg'; },
    
    isTonConnectReady() {
      return this.tonConnectUI !== null;
    },

    isValidTonAddress() {
      return normalizeTonAddress(this.withdrawWallet) !== null;
    },

    canBet() {
      return !this.isSpinning && !this.userAlreadyBet
        && this.betAmount >= 0.1 && this.betAmount <= this.balance
        && (this.game.status === 'waiting' || this.game.status === 'waiting_for_players')
        && this.isConnected;
    },

    userAlreadyBet() {
      return this.game.players.some(p => p.userId === this.user?.id);
    },

    referralLink() {
      return `https://t.me/TonRouletteBot?start=${this.user?.id}`;
    },

    winRate() {
      if (!this.stats.played) return 0;
      return Math.round(this.stats.won / this.stats.played * 100);
    },
    
    canWithdraw() {
      return this.withdrawAmt >= 0.1 && 
             this.withdrawAmt <= this.balance && 
             this.withdrawWallet.length >= 10 &&
             this.isValidTonAddress;
    }
  },

  mounted() {
    this.tryTelegram();
    if (typeof performance === 'undefined') { window.performance = { now: () => Date.now() }; }
  },

  beforeUnmount() {
    this.stopTimer();
    this._unsubGame?.();
    this._unsubUser?.();
    Object.values(this._unsubAdmin).forEach(unsub => unsub?.());
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
  },

  methods: {
    // ══════════════════════════════════
    // TON CONNECT (ИСПРАВЛЕНО)
    // ══════════════════════════════════
    async initTonConnect() {
      if (this.tonConnectLoading) return;
      
      this.tonConnectLoading = true;
      try {
        this.tonConnectUI = new TonConnectUI({
          manifestUrl: 'https://raw.githubusercontent.com/MatveyVue/caps/refs/heads/main/tonconnect-manifest.json',
        });
        
        const currentWallet = this.tonConnectUI.wallet;
        if (currentWallet) {
          this.tonConnected = true;
        }
        
        this.tonConnectUI.onStatusChange((wallet) => {
          this.tonConnected = !!wallet;
          if (wallet) {
            this.showToast('Wallet connected!');
          } else {
            this.showToast('Wallet disconnected');
          }
        });
        
        this.showToast('TON Connect initialized');
      } catch (e) {
        console.error('TON Connect init error:', e);
        this.showToast('Failed to initialize TON Connect');
      } finally {
        this.tonConnectLoading = false;
      }
    },

    async connectTonWallet() {
      if (!this.tonConnectUI) {
        await this.initTonConnect();
      }
      
      try {
        if (this.tonConnectUI) {
          await this.tonConnectUI.openModal();
        }
      } catch (e) {
        console.error('Connect wallet error:', e);
        this.showToast('Failed to connect wallet');
      }
    },

    // НОВЫЙ МЕТОД: Дисконнект кошелька
    async disconnectWallet() {
      if (!this.tonConnectUI) return;
      
      try {
        await this.tonConnectUI.disconnect();
        this.tonConnected = false;
        this.showToast('Wallet disconnected');
      } catch (e) {
        console.error('Disconnect wallet error:', e);
        this.showToast('Failed to disconnect wallet');
      }
    },

    prepareTonPayload(text) {
      // Используем новую функцию encodePayload
      return encodePayload(text);
    },

    async processDeposit() {
      if (!this.tonConnectUI || !this.tonConnected) {
        await this.connectTonWallet();
        return;
      }

      this.depositLoading = true;

      try {
        const comment = `dep_${this.user.id}_${Date.now()}`;
        const payload = this.prepareTonPayload(comment);
        const nanoAmount = Math.floor(this.depositAmt * 1e9).toString();

        // Проверяем адрес
        const normalizedAddress = normalizeTonAddress(HOUSE_WALLET);
        if (!normalizedAddress) {
          throw new Error('Invalid house wallet address');
        }

        // validUntil должен быть в пределах 5 минут от текущего времени
        const now = Math.floor(Date.now() / 1000);
        const validUntil = now + 300; // 5 минут = 300 секунд

        console.log('Sending transaction:', {
          address: normalizedAddress,
          amount: nanoAmount,
          payload: payload,
          validUntil,
          now
        });

        const transaction = {
          validUntil: validUntil,
          messages: [{
            address: normalizedAddress,
            amount: nanoAmount,
            payload: payload
          }]
        };

        const result = await this.tonConnectUI.sendTransaction(transaction);

        if (result) {
          await runTransaction(db, async (tx) => {
            const userRef = doc(db, 'users', this.user.id);
            const userSnap = await tx.get(userRef);
            
            if (userSnap.exists()) {
              tx.update(userRef, { balance: increment(this.depositAmt) });
            }
          });

          this.depositSuccess = true;
          this.getTg()?.HapticFeedback?.notificationOccurred('success');
          this.showToast(`+${this.fmt(this.depositAmt)} TON deposited!`);
          
          setTimeout(() => {
            this.closeModal();
            this.depositSuccess = false;
          }, 2000);
        }
      } catch (e) {
        console.error('Deposit error:', e);
        this.showToast('Deposit failed: ' + e.message);
      } finally {
        this.depositLoading = false;
      }
    },

    async processWithdraw() {
      if (!this.tonConnectUI || !this.tonConnected) {
        await this.connectTonWallet();
        return;
      }

      if (!this.canWithdraw) {
        this.showToast('Invalid withdrawal amount or address');
        return;
      }

      this.withdrawLoading = true;

      try {
        // Проверяем адрес получателя
        const normalizedAddress = normalizeTonAddress(this.withdrawWallet);
        if (!normalizedAddress) {
          throw new Error('Invalid recipient address format');
        }

        // Атомарная транзакция - блокируем средства
        await runTransaction(db, async (tx) => {
          const userRef = doc(db, 'users', this.user.id);
          const userSnap = await tx.get(userRef);
          
          if (!userSnap.exists()) throw new Error('User not found');
          
          const currentBalance = userSnap.data().balance || 0;
          if (currentBalance < this.withdrawAmt) throw new Error('Insufficient balance');
          
          tx.update(userRef, { balance: increment(-this.withdrawAmt) });
        });

        const comment = `wd_${this.user.id}_${Date.now()}`;
        const payload = this.prepareTonPayload(comment);
        const nanoAmount = Math.floor(this.withdrawAmt * 1e9).toString();

        // validUntil должен быть в пределах 5 минут от текущего времени
        const now = Math.floor(Date.now() / 1000);
        const validUntil = now + 300; // 5 минут = 300 секунд

        console.log('Sending withdrawal:', {
          address: normalizedAddress,
          amount: nanoAmount,
          payload: payload,
          validUntil,
          now
        });

        const transaction = {
          validUntil: validUntil,
          messages: [{
            address: normalizedAddress,
            amount: nanoAmount,
            payload: payload
          }]
        };

        const result = await this.tonConnectUI.sendTransaction(transaction);

        if (result) {
          this.withdrawSuccess = true;
          this.getTg()?.HapticFeedback?.notificationOccurred('success');
          this.showToast(`✓ ${this.fmt(this.withdrawAmt)} TON sent!`);
          
          setTimeout(() => {
            this.closeModal();
            this.withdrawSuccess = false;
          }, 2000);
        }
      } catch (e) {
        console.error('Withdraw error:', e);
        
        // Возвращаем средства при ошибке
        await updateDoc(doc(db, 'users', this.user.id), {
          balance: increment(this.withdrawAmt)
        });
        
        this.showToast('Withdrawal failed: ' + e.message);
      } finally {
        this.withdrawLoading = false;
      }
    },

    // ══════════════════════════════════
    // AUTH & INITIALIZATION
    // ══════════════════════════════════
    tryTelegram() {
      const tg = window.Telegram?.WebApp;
      if (tg?.initDataUnsafe?.user) {
        tg.ready();
        tg.expand();
        const u = tg.initDataUnsafe.user;
        this.doLogin({
          id: String(u.id),
          name: u.first_name + (u.last_name ? ' ' + u.last_name : ''),
          handle: u.username || String(u.id),
          emoji: EMOJIS[u.id % EMOJIS.length],
        });
      } else {
        // Для локального тестирования
        this.quickLogin();
      }
    },

    quickLogin() {
      const id = Date.now() % 100000;
      this.doLogin({
        id: String(id),
        name: `Player${id}`,
        handle: `p${id}`,
        emoji: EMOJIS[id % EMOJIS.length],
      });
    },

    async doLogin(userData) {
      this.user = userData;
      try {
        const userRef = doc(db, 'users', userData.id);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          await runTransaction(db, async (transaction) => {
            transaction.set(userRef, {
              name: userData.name, handle: userData.handle, emoji: userData.emoji,
              balance: 0, stats: { played: 0, won: 0, earned: 0 },
              createdAt: serverTimestamp(),
            });
            const statsRef = doc(db, 'config', 'stats');
            transaction.set(statsRef, { totalUsers: increment(1) }, { merge: true });
          });
        }

        this._unsubUser = onSnapshot(userRef, (snap) => {
          if (!snap.exists()) return;
          const d = snap.data();
          this.balance = d.balance || 0;
          this.stats   = d.stats || { played: 0, won: 0, earned: 0 };
        });

        await this.loadHistory();
        this.subscribeGame();

      } catch (e) {
        console.error('Firebase login error:', e);
        this.balance = 100;
        this.isConnected = true;
        this.$nextTick(() => this.drawWheel());
      }
    },

    // ══════════════════════════════════
    // AUTOMATED GAME FLOW
    // ══════════════════════════════════
    subscribeGame() {
      const gameRef = doc(db, 'config', 'currentGame');
      let prevStatus = '';

      this._unsubGame = onSnapshot(gameRef, async (snap) => {
        this.isConnected = true;

        if (!snap.exists()) {
          if (this.isAdmin) await this.createFirestoreRound();
          this.$nextTick(() => this.drawWheel());
          return;
        }

        const d = snap.data();
        this.game = {
          id: snap.id,
          players:   d.players   || [],
          totalBet:  d.totalBet  || 0,
          status:    d.status,
          endsAt:    d.endsAt?.toMillis?.() || null,
          winnerId:  d.winnerId  || null,
        };

        if (d.status === 'waiting' && prevStatus !== 'waiting') {
          this.isSpinning = false;
          this.winner = null;
          this.startClientTimer();
        }
        else if (d.status === 'spinning' && prevStatus !== 'spinning') {
          this.isSpinning = true;
          this.stopTimer();
          const winnerPlayer = (d.players || []).find(p => p.userId === d.winnerId);
          if (winnerPlayer) {
            setTimeout(() => this.animateSpin(winnerPlayer), 100);
          }
        }
        else if (d.status === 'waiting_for_players' && prevStatus !== 'waiting_for_players') {
          this.isSpinning = false;
          this.winner = null;
          this.spinAngle = 0;
          this.timeLeft = ROUND_TIME;
          this.stopTimer();
        }

        prevStatus = d.status;
        this.drawWheel();
      }, err => {
        console.error('Game snapshot error:', err);
        this.isConnected = false;
      });
    },

    startClientTimer() {
      this.stopTimer();
      this.timerHandle = setInterval(() => {
        if (this.isSpinning || this.game.status !== 'waiting') return;

        this.timeLeft = this.game.endsAt ? Math.max(0, Math.round((this.game.endsAt - Date.now()) / 1000)) : 0;

        if (this.timeLeft <= 0) {
          this.stopTimer();
          this.triggerRoundEnd();
        }
      }, 500);
    },

    stopTimer() {
      if (this.timerHandle) { clearInterval(this.timerHandle); this.timerHandle = null; }
    },

    async createFirestoreRound() {
      try {
        await setDoc(doc(db, 'config', 'currentGame'), {
          players: [], totalBet: 0,
          status: 'waiting_for_players',
          endsAt: null, winnerId: null, createdAt: serverTimestamp(),
        });
      } catch (e) { console.error('Create round error:', e); }
    },

    async triggerRoundEnd(force = false) {
      if (this.isSpinning) return;

      try {
        await runTransaction(db, async (transaction) => {
          const gameRef = doc(db, 'config', 'currentGame');
          const gameDoc = await transaction.get(gameRef);

          if (!gameDoc.exists()) throw new Error("Game does not exist.");

          const gd = gameDoc.data();
          if (gd.status === 'waiting' && (force || Date.now() >= (gd.endsAt?.toMillis() || 0))) {
            if (gd.players.length < 2) {
              transaction.set(gameRef, {
                players: [], totalBet: 0, status: 'waiting_for_players',
                endsAt: null, winnerId: null, createdAt: serverTimestamp(),
              });
            } else {
              const winner = weightedRandom(gd.players);
              transaction.update(gameRef, { status: 'spinning', winnerId: winner.userId });
            }
          }
        });
      } catch (e) {
        console.error("Failed to end round: ", e);
      }
    },

    async placeBet() {
      if (!this.canBet) return;
      this.betLoading = true;
      this.betError   = '';

      const gameRef = doc(db, 'config', 'currentGame');
      const userRef = doc(db, 'users', this.user.id);

      try {
        await runTransaction(db, async (transaction) => {
          const [gameDoc, userDoc] = await Promise.all([
            transaction.get(gameRef),
            transaction.get(userRef),
          ]);

          if (!gameDoc.exists()) throw new Error("No active game to join.");
          if (!userDoc.exists()) throw new Error("User data not found.");

          const gd = gameDoc.data();
          const bal = userDoc.data().balance || 0;

          if (bal < this.betAmount) throw new Error('Insufficient balance.');
          if (gd.status !== 'waiting' && gd.status !== 'waiting_for_players') throw new Error('Round has already started.');
          if ((gd.players || []).some(p => p.userId === this.user.id)) throw new Error('You have already placed a bet.');

          transaction.update(userRef, { balance: increment(-this.betAmount) });

          const newPlayer = {
            userId: this.user.id, name: this.user.name,
            emoji: this.user.emoji, bet: this.betAmount,
          };

          const gameUpdates = {
            players: [...gd.players, newPlayer],
            totalBet: increment(this.betAmount),
          };

          if (gd.status === 'waiting_for_players') {
            gameUpdates.status = 'waiting';
            gameUpdates.endsAt = new Date(Date.now() + ROUND_TIME * 1000);
          }
          transaction.update(gameRef, gameUpdates);
        });

        this.getTg()?.HapticFeedback?.notificationOccurred('success');

      } catch (e) {
        this.betError = e.message || 'An error occurred placing your bet.';
        setTimeout(() => { this.betError = ''; }, 3500);
        this.getTg()?.HapticFeedback?.notificationOccurred('error');
      } finally {
        this.betLoading = false;
      }
    },

    // ══════════════════════════════════
    // SPIN ANIMATION & PAYOUT
    // ══════════════════════════════════
    animateSpin(winnerPlayer) {
      if (!this.game.players.length) return;

      const total = this.game.totalBet;
      let currentAngle = 0, winStart = 0, winEnd = 0;

      for (const p of this.game.players) {
        const sweep = (p.bet / total) * Math.PI * 2;
        if (p.userId === winnerPlayer.userId) {
          winStart = currentAngle;
          winEnd = currentAngle + sweep;
        }
        currentAngle += sweep;
      }

      const winMidPoint = winStart + (winEnd - winStart) / 2;
      const pointerOffset = -Math.PI / 2;
      const targetBase = pointerOffset - winMidPoint;
      const randomSpins = 6 + Math.random() * 3;
      const targetAngle = targetBase + randomSpins * Math.PI * 2;

      const duration  = 4000;
      const t0        = performance.now();
      const startAng  = this.spinAngle;
      const ease = t => 1 - Math.pow(1 - t, 3);

      const tick = (now) => {
        const t = Math.min((now - t0) / duration, 1);
        this.spinAngle = startAng + (targetAngle - startAng) * ease(t);
        this.drawWheel();

        if (t < 1) {
          this.animFrame = requestAnimationFrame(tick);
        } else {
          this.spinAngle = ((targetAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          this.drawWheel();
          this.resolveRound(winnerPlayer);
        }
      };
      this.animFrame = requestAnimationFrame(tick);
    },

    async resolveRound(winnerPlayer) {
      const prize = +(this.game.totalBet * (1 - HOUSE_FEE)).toFixed(2);
      const houseCut = +(this.game.totalBet - prize).toFixed(2);
      const isWinnerMe = winnerPlayer.userId === this.user.id;
      const myBet = this.game.players.find(p => p.userId === this.user.id);

      try {
        const batch = writeBatch(db);

        batch.update(doc(db, 'users', winnerPlayer.userId), {
          balance: increment(prize),
          'stats.won': increment(1),
          'stats.played': increment(1),
          'stats.earned': increment(prize),
        });

        this.game.players.forEach(p => {
          if (p.userId !== winnerPlayer.userId) {
            batch.update(doc(db, 'users', p.userId), { 'stats.played': increment(1) });
          }
        });

        const statsRef = doc(db, 'config', 'stats');
        batch.set(statsRef, {
          totalGames: increment(1),
          totalVolume: increment(this.game.totalBet),
          houseBalance: increment(houseCut),
        }, { merge: true });

        await batch.commit();

        if (myBet) {
          await addDoc(collection(db, 'users', this.user.id, 'history'), {
            won: isWinnerMe,
            amount: isWinnerMe ? prize - myBet.bet : myBet.bet,
            ts: serverTimestamp(),
            gameId: this.game.id,
          });
          this.loadHistory();
        }
      } catch (e) { console.error('Error resolving round:', e); }

      this.winner = {
        name: winnerPlayer.name,
        prize: prize,
        isMe: isWinnerMe,
        myLoss: myBet && !isWinnerMe ? myBet.bet : 0,
      };

      setTimeout(() => {
        this.createFirestoreRound();
      }, 3000);
    },

    dismissWinner() { this.winner = null; },

    // ══════════════════════════════════
    // DRAWING & UTILS
    // ══════════════════════════════════
    drawWheel() {
      const canvas = this.$refs.wheelCanvas;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const [w, h] = [canvas.width, canvas.height];
      const cx = w / 2, cy = h / 2, r = w / 2 - 12;
      ctx.clearRect(0, 0, w, h);

      if (!this.game.players.length) {
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = '#141416'; ctx.fill();
        ctx.strokeStyle = '#2a2a2e'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.font = '13px DM Sans, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(this.game.status === 'spinning' ? 'Drawing...' : 'Waiting for players…', cx, cy);
        return;
      }

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(this.spinAngle);
      ctx.translate(-cx, -cy);

      let currentAngle = 0;
      for (const p of this.game.players) {
        const sweep = (p.bet / this.game.totalBet) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, currentAngle, currentAngle + sweep); ctx.closePath();
        ctx.fillStyle = this.playerColor(p.userId); ctx.fill();
        currentAngle += sweep;
      }

      ctx.restore();

      currentAngle = 0;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(this.spinAngle);
      ctx.translate(-cx, -cy);
      for (const p of this.game.players) {
          const sweep = (p.bet / this.game.totalBet) * Math.PI * 2;
          ctx.beginPath(); ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, r, currentAngle, currentAngle + sweep);
          ctx.lineTo(cx, cy);
          ctx.strokeStyle = '#0d0d0f'; ctx.lineWidth = 1.5; ctx.stroke();
          currentAngle += sweep;
      }
      ctx.restore();

      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 3; ctx.stroke();
    },

    getTimerWidth() {
      if (this.isSpinning || this.game.status === 'waiting_for_players') return '0%';
      return `${(this.timeLeft / ROUND_TIME) * 100}%`;
    },

    fmt(n) { return Number(n || 0).toFixed(2); },

    playerColor(userId) {
      const hash = String(userId).split('').reduce((a, b) => (a + b.charCodeAt(0)) & 0xFFFFFFFF, 0);
      return COLORS[hash % COLORS.length];
    },

    playerChance(p) {
      if (!this.game.totalBet || p.bet <= 0) return '0.0';
      return (p.bet / this.game.totalBet * 100).toFixed(1);
    },

    adjustBet(delta) {
      const newAmount = +(this.betAmount + delta).toFixed(1);
      this.betAmount = Math.max(0.1, Math.min(this.balance, newAmount));
    },

    showToast(msg) {
      this.toastMsg = msg;
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => { this.toastMsg = ''; }, 3200);
    },
    
    getTg() { return window.Telegram?.WebApp; },

    // ══════════════════════════════════
    // MODALS
    // ══════════════════════════════════
    openModal(type) {
      this.modal = type;
      this.depositSuccess = false;
      this.depositLoading = false;
      this.withdrawSuccess = false;
      this.withdrawLoading = false;
      this.withdrawWallet = '';
      
      if (!this.tonConnectUI && !this.tonConnectLoading) {
        this.initTonConnect();
      }
    },

    closeModal() {
      this.modal = null;
    },

    // ══════════════════════════════════
    // PROFILE & HISTORY
    // ══════════════════════════════════
    async loadHistory() {
      try {
        const q = query(collection(db, `users/${this.user.id}/history`), orderBy('ts', 'desc'), limit(20));
        const snap = await getDocs(q);
        this.history = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch(e) { console.warn("Could not load history", e.message); }
    },

    async copyRef() {
      try {
        await navigator.clipboard.writeText(this.referralLink);
        this.copied = true;
        setTimeout(() => { this.copied = false; }, 2000);
      } catch {}
    },

    formatTime(ts) {
      if (!ts) return '';
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    },

    // ══════════════════════════════════
    // ADMIN
    // ══════════════════════════════════
    switchAdmin() {
      this.tab = 'admin';
      this.subscribeAdmin();
    },

    async subscribeAdmin() {
      Object.values(this._unsubAdmin).forEach(unsub => unsub?.());
      try {
        const snap = await getDoc(doc(db, 'config', 'stats'));
        if (snap.exists()) { Object.assign(this.adminData, snap.data()); }
        const uSnap = await getDocs(query(collection(db, 'users'), orderBy('balance', 'desc'), limit(100)));
        this.adminData.users = uSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        this.adminData.totalUsers = this.adminData.users.length;
      } catch (e) { console.error('Admin data load error:', e); }

      this._unsubAdmin.deposits = onSnapshot(query(collection(db, 'deposit_requests'), where('status', '==', 'pending'), orderBy('ts', 'desc')), snap => {
        this.adminData.deposits = snap.docs.map(d => ({ id: d.id, ...d.data(), processing: false }));
      });
      this._unsubAdmin.withdraws = onSnapshot(query(collection(db, 'withdraw_requests'), where('status', '==', 'pending'), orderBy('ts', 'desc')), snap => {
        this.adminData.withdraws = snap.docs.map(d => ({ id: d.id, ...d.data(), processing: false }));
      });
    },

    async approveDeposit(r) {
      r.processing = true;
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'users', r.userId), { balance: increment(r.amount) });
        batch.update(doc(db, 'deposit_requests', r.id), { status: 'approved', approvedAt: serverTimestamp() });
        await batch.commit();
        this.showToast(`✓ +${r.amount} TON → ${r.userName}`);
      } catch (e) { this.showToast('Error: ' + e.message); r.processing = false; }
    },

    async rejectDeposit(r) {
      r.processing = true;
      try {
        await updateDoc(doc(db, 'deposit_requests', r.id), { status: 'rejected', rejectedAt: serverTimestamp() });
        this.showToast('Deposit rejected');
      } catch (e) { this.showToast('Error: ' + e.message); r.processing = false; }
    },

    async approveWithdraw(r) {
      r.processing = true;
      try {
        await updateDoc(doc(db, 'withdraw_requests', r.id), { status: 'approved', approvedAt: serverTimestamp() });
        this.showToast(`✓ Send ${r.amount} TON → ${r.wallet}`);
      } catch (e) { this.showToast('Error: ' + e.message); r.processing = false; }
    },

    async rejectWithdraw(r) {
      r.processing = true;
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'users', r.userId), { balance: increment(r.amount) });
        batch.update(doc(db, 'withdraw_requests', r.id), { status: 'rejected', rejectedAt: serverTimestamp() });
        await batch.commit();
        this.showToast('Withdrawal rejected, balance refunded');
      } catch (e) { this.showToast('Error: ' + e.message); r.processing = false; }
    },

    async adminAddBalance(u, amount) {
      try {
        await updateDoc(doc(db, 'users', u.id), { balance: increment(amount) });
        const userInList = this.adminData.users.find(admU => admU.id === u.id);
        if (userInList) userInList.balance += amount;
        this.showToast(`+${amount} TON → ${u.name}`);
      } catch (e) { this.showToast('Error: ' + e.message); }
    },

    adminSetBalance(u) {
      const val = prompt(`Set balance for ${u.name} (current: ${u.balance} TON):`);
      if (val === null || isNaN(parseFloat(val))) return;
      const newBal = parseFloat(val);
      updateDoc(doc(db, 'users', u.id), { balance: newBal })
        .then(() => {
          const userInList = this.adminData.users.find(admU => admU.id === u.id);
          if (userInList) userInList.balance = newBal;
          this.showToast(`Balance → ${newBal} TON`);
        })
        .catch(e => this.showToast('Error: ' + e.message));
    },
  },
};
</script>

<style>
/* Добавляем стили для кнопки дисконнекта */
.wallet-disconnect {
  margin: 16px 0;
  display: flex;
  justify-content: center;
}

.disconnect-btn {
  background: rgba(255, 71, 87, 0.1);
  border: 1px solid rgba(255, 71, 87, 0.2);
  border-radius: 30px;
  padding: 12px 24px;
  color: #ff4757;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s;
}

.disconnect-btn:hover {
  background: rgba(255, 71, 87, 0.15);
  transform: translateY(-2px);
}

.disconnect-btn span {
  font-size: 16px;
}

.error-message.small {
  font-size: 11px;
  margin-top: -8px;
  margin-bottom: 8px;
}
</style>
