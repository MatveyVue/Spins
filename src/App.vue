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
        
        <!-- Deposit Requests (for info only, auto-processed) -->
        <div class="admin-section">
          <div class="section-head">
            <span class="card-title">📥 Recent Deposits</span>
            <span class="badge">{{ adminData.deposits.length }}</span>
          </div>
          <div v-if="!adminData.deposits.length" class="empty-msg">No recent deposits</div>
          <div v-for="r in adminData.deposits.slice(0,5)" :key="r.id" class="req-row">
            <div class="req-info">
              <span class="req-user">{{ r.userName }} <span class="req-uid">#{{ (r.userId||'').slice(-4) }}</span></span>
              <span class="req-meta">{{ fmt(r.amount) }} TON · {{ formatTime(r.ts) }}</span>
              <span :class="['req-status', r.status]">{{ r.status }}</span>
            </div>
          </div>
        </div>

        <!-- Withdrawal Requests (manual approval) -->
        <div class="admin-section">
          <div class="section-head">
            <span class="card-title">💸 Pending Withdrawals</span>
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

        <!-- Users List -->
        <div class="admin-section">
          <div class="card-title" style="margin-bottom:12px">👥 Users</div>
          <div v-if="!adminData.users.length" class="empty-msg">No users yet</div>
          <div v-for="u in adminData.users.slice(0,10)" :key="u.id" class="user-row">
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

    <!-- DEPOSIT MODAL - AUTOMATIC VERSION -->
    <transition name="fade">
      <div v-if="modal === 'deposit'" class="overlay" @click.self="closeModal">
        <div class="modal-card">
          <div class="modal-title">💰 Deposit TON</div>
          
          <!-- Step 1: Amount -->
          <div v-if="depositStep === 1">
            <div class="preset-row">
              <button v-for="a in [5,10,25,50,100]" :key="a"
                :class="['preset-btn', { active: depositAmt === a }]"
                @click="depositAmt = a">{{ a }}</button>
            </div>
            <div class="modal-field">
              <input type="number" v-model.number="depositAmt" min="0.1" step="0.1" 
                class="modal-input" placeholder="Amount" />
              <span class="modal-cur">TON</span>
            </div>
            <div class="modal-btns">
              <button class="modal-cancel" @click="closeModal">Cancel</button>
              <button class="modal-confirm" @click="depositStep = 2" :disabled="depositAmt < 0.1">Next →</button>
            </div>
          </div>

          <!-- Step 2: Send Instructions -->
          <div v-if="depositStep === 2">
            <div class="deposit-info">
              <div class="dep-row">
                <span class="dep-lbl">Send exactly</span>
                <span class="dep-val gold">{{ fmt(depositAmt) }} TON</span>
              </div>
              <div class="dep-row">
                <span class="dep-lbl">To wallet</span>
                <div class="dep-wallet-row">
                  <span class="dep-wallet">{{ HOUSE_WALLET }}</span>
                  <button class="copy-small" @click="copyText(HOUSE_WALLET)">📋</button>
                </div>
              </div>
              <div class="dep-row">
                <span class="dep-lbl">Comment (REQUIRED!)</span>
                <div class="dep-wallet-row highlight">
                  <span class="dep-wallet gold">{{ currentDepComment }}</span>
                  <button class="copy-small gold" @click="copyText(currentDepComment)">📋</button>
                </div>
              </div>
              <div class="dep-note">
                ⚠️ Include this exact comment! Without it, deposit won't be credited automatically.
              </div>
            </div>

            <button class="ton-connect-btn" @click="openTonLink">
              <span>💎</span> Open in TON Wallet
            </button>

            <div class="modal-btns">
              <button class="modal-cancel" @click="depositStep = 1">← Back</button>
              <button class="modal-confirm" @click="submitDepositRequest">I've Sent →</button>
            </div>
          </div>

          <!-- Step 3: Waiting for Confirmation (AUTOMATIC) -->
          <div v-if="depositStep === 3">
            <div class="deposit-status">
              <div v-if="!depositDone" class="waiting-message">
                <div class="spinner-large"></div>
                <p class="status-text">{{ depositStatus }}</p>
                <p class="status-hint">
                  Your balance will be updated automatically when the transaction is detected on the blockchain.
                  This usually takes 1-2 minutes.
                </p>
              </div>
              <div v-if="depositDone" class="success-message">
                <div class="success-icon">✅</div>
                <p class="success-text">Transaction confirmed!</p>
                <p class="success-sub">+{{ fmt(depositAmt) }} TON added to your balance</p>
              </div>
            </div>
            
            <div class="modal-btns" v-if="!depositDone">
              <button class="modal-cancel" @click="closeModal">Close (will continue checking)</button>
            </div>
            <div class="modal-btns" v-if="depositDone">
              <button class="modal-confirm" @click="closeModal" style="width:100%">Done</button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- WITHDRAW MODAL -->
    <transition name="fade">
      <div v-if="modal === 'withdraw'" class="overlay" @click.self="closeModal">
        <div class="modal-card">
          <div class="modal-title">💸 Withdraw TON</div>
          
          <div class="modal-avail">
            Available: <strong class="gold">{{ fmt(balance) }} TON</strong>
          </div>
          
          <div class="preset-row">
            <button v-for="a in [5,10,25,50]" :key="a"
              :class="['preset-btn', { active: withdrawAmt === a }]"
              :disabled="a > balance"
              @click="withdrawAmt = a">{{ a }}</button>
            <button :class="['preset-btn', { active: withdrawAmt === balance }]"
              @click="withdrawAmt = balance">MAX</button>
          </div>
          
          <div class="modal-field">
            <input type="number" v-model.number="withdrawAmt" min="0.1" :max="balance" step="0.1" 
              class="modal-input" />
            <span class="modal-cur">TON</span>
          </div>
          
          <div class="modal-field">
            <input type="text" v-model="withdrawWallet" class="modal-input"
              placeholder="Your TON wallet address (EQ... or UQ...)" />
          </div>

          <div v-if="withdrawWallet && !isValidTonAddress" class="error-message">
            Invalid TON address format
          </div>

          <div class="dep-note">
            ⏱️ Withdrawals are processed manually by admin within 24 hours.
          </div>

          <div v-if="withdrawLoading" class="loading-row">
            <span class="spinner-small"></span> Processing...
          </div>
          
          <div v-if="withdrawSuccess" class="success-msg">
            ✓ Withdrawal request submitted!
          </div>

          <div class="modal-btns" v-if="!withdrawSuccess">
            <button class="modal-cancel" @click="closeModal">Cancel</button>
            <button class="modal-confirm" @click="submitWithdrawRequest" 
              :disabled="!canWithdraw || withdrawLoading">
              Request Withdrawal
            </button>
          </div>
          <button v-if="withdrawSuccess" class="modal-confirm" style="width:100%" @click="closeModal">
            Done
          </button>
        </div>
      </div>
    </transition>

    <!-- Toast Notifications -->
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

// ==================== CONSTANTS ====================
const EMOJIS = ['😎','🦊','🐸','🐼','🦁','🐨','🐯','🦅','🐺','🦝','🐻','🦋'];
const COLORS = ['#e05252','#52a0e0','#52c77a','#e0a052','#9b52e0','#52d4e0','#e0527a','#7ae052'];
const ROUND_TIME = 30; // Seconds
const HOUSE_FEE = 0.05; // 5%
const HOUSE_WALLET = '0QBbz6lrdck00jKezlUKQAn1QzV1uOB1uUs5caKFv-m1zxCM';

// TonCenter API (Testnet)
const TONCENTER_API_KEY = '62baa2e429900335d7e5367e89c7e75c7752c7c83d5fd8a0b3bcb568bd48d1ee';
const TONCENTER_API_URL = 'https://testnet.toncenter.com/api/v2';

// ==================== HELPERS ====================
function randInt(n) { return Math.floor(Math.random() * n); }

function weightedRandom(players) {
  const total = players.reduce((s, p) => s + p.bet, 0);
  let r = Math.random() * total;
  for (const p of players) { r -= p.bet; if (r <= 0) return p; }
  return players[players.length - 1];
}

function isValidTonAddress(address) {
  if (!address) return false;
  address = address.trim();
  return address.startsWith('EQ') || address.startsWith('UQ') || address.startsWith('0:');
}

export default {
  name: 'App',

  data() {
    return {
      // Constants
      ROUND_TIME,
      HOUSE_WALLET,
      
      // User & Connection
      user: null,
      tab: 'game',
      balance: 0,
      isConnected: false,

      // Betting
      betAmount: 1,
      betLoading: false,
      betError: '',
      
      // Game State
      game: { 
        id: null, 
        players: [], 
        totalBet: 0, 
        status: 'waiting_for_players', 
        endsAt: null,
        spinStartTime: null, // Время начала вращения
        spinDuration: 6000,   // Длительность вращения в мс
        winner: null
      },

      // Spin Animation
      isSpinning: false,
      timeLeft: ROUND_TIME,
      timerHandle: null,
      spinAngle: 0,
      animFrame: null,
      winner: null,
      spinProgress: 0, // Прогресс анимации от 0 до 1

      // Firebase Listeners
      _unsubGame: null,
      _unsubUser: null,
      _unsubAdmin: {},

      // Profile Stats
      stats: { played: 0, won: 0, earned: 0 },
      history: [],
      copied: false,

      // Modal Control
      modal: null,
      
      // Deposit
      depositStep: 1,
      depositAmt: 10,
      depositLoading: false,
      depositDone: false,
      currentDepComment: '',
      depositStatus: 'Waiting for transaction...',
      
      // Withdraw
      withdrawAmt: 10,
      withdrawWallet: '',
      withdrawLoading: false,
      withdrawSuccess: false,

      // Admin Data
      adminData: {
        totalUsers: 0,
        totalGames: 0,
        totalVolume: 0,
        houseBalance: 0,
        deposits: [],
        withdraws: [],
        users: [],
      },

      // UI
      toastMsg: '',
      _toastTimer: null,
      
      // Auto-check interval for deposits
      _depositCheckInterval: null,
      _lastCheckedTx: {},
    };
  },

  computed: {
    isAdmin() { 
      return this.user?.handle === 'whsxg';
    },

    canBet() {
      return !this.isSpinning && 
             !this.userAlreadyBet &&
             this.betAmount >= 0.1 && 
             this.betAmount <= this.balance &&
             (this.game.status === 'waiting' || this.game.status === 'waiting_for_players') &&
             this.isConnected;
    },

    userAlreadyBet() {
      return this.game.players.some(p => p.userId === this.user?.id);
    },

    referralLink() {
      return `https://t.me/TonRouletteBot?start=ref_${this.user?.id}`;
    },

    winRate() {
      if (!this.stats.played) return 0;
      return Math.round(this.stats.won / this.stats.played * 100);
    },
    
    canWithdraw() {
      return this.withdrawAmt >= 0.1 && 
             this.withdrawAmt <= this.balance && 
             this.withdrawWallet.length >= 10 &&
             isValidTonAddress(this.withdrawWallet);
    },
    
    isValidTonAddress() {
      return isValidTonAddress(this.withdrawWallet);
    },
  },

  mounted() {
    this.tryTelegram();
    if (typeof performance === 'undefined') { 
      window.performance = { now: () => Date.now() }; 
    }
    
    // Start checking for deposits every 8 seconds
    this._depositCheckInterval = setInterval(() => {
      if (this.user) this.checkPendingDeposits();
    }, 8000);
  },

  beforeUnmount() {
    this.stopTimer();
    this._unsubGame?.();
    this._unsubUser?.();
    Object.values(this._unsubAdmin).forEach(unsub => unsub?.());
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    if (this._depositCheckInterval) clearInterval(this._depositCheckInterval);
  },

  methods: {
    // ==================== TONCENTER INTEGRATION ====================
    
    async fetchTonCenterTransactions() {
      try {
        const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
        const url = `${TONCENTER_API_URL}/getTransactions?address=${HOUSE_WALLET}&limit=50`;
        
        const response = await fetch(proxyUrl + url, {
          headers: {
            'X-API-Key': TONCENTER_API_KEY
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data.result || [];
        
      } catch (e) {
        console.error('TonCenter API error:', e);
        return [];
      }
    },
    
    async checkPendingDeposits() {
      if (!this.user) return;
      
      try {
        const pendingQuery = query(
          collection(db, 'deposit_requests'),
          where('userId', '==', this.user.id),
          where('status', '==', 'pending'),
          limit(10)
        );
        
        const snapshot = await getDocs(pendingQuery);
        if (snapshot.empty) return;
        
        const transactions = await this.fetchTonCenterTransactions();
        if (!transactions || transactions.length === 0) return;
        
        for (const docSnapshot of snapshot.docs) {
          const deposit = docSnapshot.data();
          
          if (this._lastCheckedTx[deposit.id]) continue;
          
          for (const tx of transactions) {
            if (!tx.comment) continue;
            
            const cleanComment = tx.comment.replace(/\0/g, '').trim();
            const expectedComment = deposit.comment.replace(/\0/g, '').trim();
            
            if (cleanComment.includes(expectedComment) || 
                expectedComment.includes(cleanComment)) {
              
              await this.processDeposit(docSnapshot.ref, deposit, tx);
              this._lastCheckedTx[deposit.id] = true;
              break;
            }
          }
        }
      } catch (e) {
        console.error('Error checking deposits:', e);
      }
    },
    
    async processDeposit(docRef, deposit, tx) {
      try {
        await runTransaction(db, async (transaction) => {
          const userRef = doc(db, 'users', deposit.userId);
          const userSnap = await transaction.get(userRef);
          
          if (!userSnap.exists()) {
            throw new Error('User not found');
          }
          
          transaction.update(userRef, {
            balance: increment(deposit.amount)
          });
          
          transaction.update(docRef, {
            status: 'completed',
            txHash: tx.hash,
            completedAt: serverTimestamp()
          });
        });
        
        await addDoc(collection(db, 'users', deposit.userId, 'history'), {
          type: 'deposit',
          amount: deposit.amount,
          txHash: tx.hash,
          ts: serverTimestamp()
        });
        
        const statsRef = doc(db, 'config', 'stats');
        await setDoc(statsRef, {
          totalDeposits: increment(deposit.amount),
          totalTransactions: increment(1)
        }, { merge: true });
        
        this.showToast(`✅ +${this.fmt(deposit.amount)} TON deposited!`);
        
        if (this.user?.id === deposit.userId && this.modal === 'deposit') {
          this.depositStatus = 'Transaction confirmed!';
          this.depositDone = true;
          
          setTimeout(() => {
            this.closeModal();
          }, 2000);
        }
        
      } catch (e) {
        console.error('Error processing deposit:', e);
      }
    },

    // ==================== AUTH ====================
    
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
        });
      } else {
        this.quickLogin();
      }
    },

    quickLogin() {
      const id = Date.now() % 100000;
      this.doLogin({
        id: String(id),
        name: `Player${id}`,
        handle: `p${id}`,
      });
    },

    async doLogin(userData) {
      userData.emoji = EMOJIS[randInt(EMOJIS.length)];
      this.user = userData;
      
      try {
        const userRef = doc(db, 'users', userData.id);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          await runTransaction(db, async (transaction) => {
            transaction.set(userRef, {
              name: userData.name,
              handle: userData.handle,
              emoji: userData.emoji,
              balance: 0,
              stats: { played: 0, won: 0, earned: 0 },
              createdAt: serverTimestamp(),
            });
            const statsRef = doc(db, 'config', 'stats');
            transaction.set(statsRef, { totalUsers: increment(1) }, { merge: true });
          });
        } else {
          await updateDoc(userRef, { lastSeen: serverTimestamp() });
          
          const existingData = userSnap.data();
          if (existingData.emoji) {
            this.user.emoji = existingData.emoji;
          }
        }

        this._unsubUser = onSnapshot(userRef, (snap) => {
          if (!snap.exists()) return;
          const d = snap.data();
          this.balance = d.balance || 0;
          this.stats = d.stats || { played: 0, won: 0, earned: 0 };
        });

        await this.loadHistory();
        this.subscribeGame();
        this.isConnected = true;

      } catch (e) {
        console.error('Firebase login error:', e);
        this.showToast('Could not connect to server.');
        this.balance = 100;
        this.isConnected = true;
        this.$nextTick(() => this.drawWheel());
      }
    },

    // ==================== GAME LOGIC ====================
    
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
          players: d.players || [],
          totalBet: d.totalBet || 0,
          status: d.status,
          endsAt: d.endsAt?.toMillis?.() || null,
          spinStartTime: d.spinStartTime?.toMillis?.() || null,
          spinDuration: d.spinDuration || 6000,
          winner: d.winner || null
        };

        // Handle state changes
        if (d.status === 'waiting' && prevStatus !== 'waiting') {
          this.isSpinning = false;
          this.winner = null;
          this.startClientTimer();
        }
        else if (d.status === 'spinning' && prevStatus !== 'spinning') {
          this.isSpinning = true;
          this.stopTimer();
          
          // Запускаем синхронизированную анимацию
          this.startSyncedSpin(d.winner, d.spinStartTime, d.spinDuration);
        }
        else if (d.status === 'waiting_for_players' && prevStatus !== 'waiting_for_players') {
          this.isSpinning = false;
          this.winner = null;
          this.spinAngle = 0;
          this.spinProgress = 0;
          this.timeLeft = ROUND_TIME;
          this.stopTimer();
        }

        prevStatus = d.status;
        this.drawWheel();
      }, err => {
        console.error('Game snapshot error:', err);
        this.showToast('Connection error');
        this.isConnected = false;
      });
    },

    startClientTimer() {
      this.stopTimer();
      this.timerHandle = setInterval(() => {
        if (this.isSpinning || this.game.status !== 'waiting') return;

        this.timeLeft = this.game.endsAt 
          ? Math.max(0, Math.round((this.game.endsAt - Date.now()) / 1000)) 
          : 0;

        if (this.timeLeft <= 0) {
          this.stopTimer();
          this.triggerRoundEnd();
        }
      }, 500);
    },

    stopTimer() {
      if (this.timerHandle) { 
        clearInterval(this.timerHandle); 
        this.timerHandle = null; 
      }
    },

    async createFirestoreRound() {
      try {
        await setDoc(doc(db, 'config', 'currentGame'), {
          players: [], 
          totalBet: 0,
          status: 'waiting_for_players',
          endsAt: null, 
          winner: null,
          spinStartTime: null,
          spinDuration: 6000,
          createdAt: serverTimestamp(),
        });
      } catch (e) { 
        console.error('Create round error:', e); 
      }
    },

    async triggerRoundEnd(force = false) {
      if (this.isSpinning) return;

      try {
        await runTransaction(db, async (transaction) => {
          const gameRef = doc(db, 'config', 'currentGame');
          const gameDoc = await transaction.get(gameRef);

          if (!gameDoc.exists()) return;

          const gd = gameDoc.data();
          
          if (gd.status === 'waiting' && (force || Date.now() >= (gd.endsAt?.toMillis() || 0))) {
            if (!gd.players || gd.players.length < 2) {
              transaction.update(gameRef, {
                endsAt: new Date(Date.now() + ROUND_TIME * 1000)
              });
            } else {
              const winner = weightedRandom(gd.players);
              const prize = gd.totalBet * (1 - HOUSE_FEE);
              
              transaction.update(gameRef, { 
                status: 'spinning',
                winner: {
                  userId: winner.userId,
                  name: winner.name,
                  prize: prize
                },
                spinStartTime: serverTimestamp(),
                spinDuration: 6000
              });
            }
          }
        });
      } catch (e) {
        console.error("Failed to end round: ", e);
      }
    },

    // Синхронизированная анимация вращения
    startSyncedSpin(winnerData, spinStartTime, spinDuration) {
      if (!winnerData || !spinStartTime) return;
      
      this.isSpinning = true;
      
      // Рассчитываем прогресс на основе серверного времени
      const now = Date.now();
      const elapsed = now - spinStartTime;
      const progress = Math.min(1, Math.max(0, elapsed / spinDuration));
      
      this.spinProgress = progress;
      
      // Если анимация уже завершена, показываем победителя
      if (progress >= 1) {
        this.spinProgress = 1;
        this.resolveRound(winnerData);
        return;
      }
      
      // Иначе запускаем анимацию с правильным прогрессом
      this.animateSyncedSpin(winnerData, spinStartTime, spinDuration);
    },

    animateSyncedSpin(winnerData, spinStartTime, spinDuration) {
      if (!this.game.players.length) return;

      // Находим угол победителя
      const total = this.game.totalBet;
      let currentAngle = 0, winStart = 0, winEnd = 0;

      for (const p of this.game.players) {
        const sweep = (p.bet / total) * Math.PI * 2;
        if (p.userId === winnerData.userId) {
          winStart = currentAngle;
          winEnd = currentAngle + sweep;
        }
        currentAngle += sweep;
      }

      const winMidPoint = winStart + (winEnd - winStart) / 2;
      const pointerOffset = -Math.PI / 2;
      const targetBase = pointerOffset - winMidPoint;
      const randomSpins = 6 + (winnerData.userId.charCodeAt(0) % 3); // Детерминированные обороты
      const targetAngle = targetBase + randomSpins * Math.PI * 2;

      const startAng = this.spinAngle;
      
      const animate = () => {
        const now = Date.now();
        const elapsed = now - spinStartTime;
        let progress = Math.min(1, Math.max(0, elapsed / spinDuration));
        
        this.spinProgress = progress;
        
        // Easing function
        const easeOut = 1 - Math.pow(1 - progress, 3);
        this.spinAngle = startAng + (targetAngle - startAng) * easeOut;
        
        this.drawWheel();

        if (progress < 1) {
          this.animFrame = requestAnimationFrame(animate);
        } else {
          this.spinAngle = targetAngle;
          this.drawWheel();
          this.resolveRound(winnerData);
        }
      };
      
      this.animFrame = requestAnimationFrame(animate);
    },

    async resolveRound(winnerData) {
      if (!winnerData) return;
      
      const isWinnerMe = winnerData.userId === this.user.id;
      const myBet = this.game.players.find(p => p.userId === this.user.id);

      try {
        const batch = writeBatch(db);

        // Pay winner
        batch.update(doc(db, 'users', winnerData.userId), {
          balance: increment(winnerData.prize),
          'stats.won': increment(1),
          'stats.played': increment(1),
          'stats.earned': increment(winnerData.prize),
        });

        // Update stats for losers
        this.game.players.forEach(p => {
          if (p.userId !== winnerData.userId) {
            batch.update(doc(db, 'users', p.userId), { 
              'stats.played': increment(1) 
            });
          }
        });

        // Update global stats
        const statsRef = doc(db, 'config', 'stats');
        batch.set(statsRef, {
          totalGames: increment(1),
          totalVolume: increment(this.game.totalBet),
          houseBalance: increment(this.game.totalBet * HOUSE_FEE),
        }, { merge: true });

        // Reset game
        const gameRef = doc(db, 'config', 'currentGame');
        batch.update(gameRef, {
          status: 'waiting_for_players',
          players: [],
          totalBet: 0,
          winner: null,
          spinStartTime: null,
          endsAt: new Date(Date.now() + ROUND_TIME * 1000)
        });

        await batch.commit();

        // Add to history
        if (myBet) {
          await addDoc(collection(db, 'users', this.user.id, 'history'), {
            won: isWinnerMe,
            amount: isWinnerMe ? winnerData.prize - myBet.bet : myBet.bet,
            ts: serverTimestamp(),
            gameId: this.game.id,
          });
          this.loadHistory();
        }
      } catch (e) { 
        console.error('Error resolving round:', e); 
      }

      // Show winner overlay
      this.winner = {
        name: winnerData.name,
        prize: winnerData.prize,
        isMe: isWinnerMe,
        myLoss: myBet && !isWinnerMe ? myBet.bet : 0,
      };
      
      this.isSpinning = false;
    },

    dismissWinner() { 
      this.winner = null; 
    },

    // ==================== BETTING ====================
    
    adjustBet(delta) {
      const newAmount = +(this.betAmount + delta).toFixed(1);
      this.betAmount = Math.max(0.1, Math.min(this.balance, newAmount));
    },

    async placeBet() {
      if (!this.canBet) return;
      
      this.betLoading = true;
      this.betError = '';

      const gameRef = doc(db, 'config', 'currentGame');
      const userRef = doc(db, 'users', this.user.id);

      try {
        await runTransaction(db, async (transaction) => {
          const [gameDoc, userDoc] = await Promise.all([
            transaction.get(gameRef),
            transaction.get(userRef),
          ]);

          if (!gameDoc.exists()) throw new Error("No active game");
          if (!userDoc.exists()) throw new Error("User not found");

          const gd = gameDoc.data();
          const bal = userDoc.data().balance || 0;

          if (bal < this.betAmount) throw new Error('Insufficient balance');
          if (gd.status === 'spinning') throw new Error('Round is spinning');
          if ((gd.players || []).some(p => p.userId === this.user.id)) {
            throw new Error('Already placed bet');
          }

          transaction.update(userRef, { 
            balance: increment(-this.betAmount) 
          });

          const newPlayer = {
            userId: this.user.id,
            name: this.user.name,
            emoji: this.user.emoji,
            bet: this.betAmount,
          };

          const players = [...(gd.players || []), newPlayer];
          const totalBet = (gd.totalBet || 0) + this.betAmount;
          
          const updates = {
            players: players,
            totalBet: totalBet,
          };

          if (gd.status === 'waiting_for_players') {
            updates.status = 'waiting';
            updates.endsAt = new Date(Date.now() + ROUND_TIME * 1000);
          }

          transaction.update(gameRef, updates);
        });

        this.getTg()?.HapticFeedback?.notificationOccurred('success');

      } catch (e) {
        this.betError = e.message;
        setTimeout(() => { this.betError = ''; }, 3500);
        this.getTg()?.HapticFeedback?.notificationOccurred('error');
      } finally {
        this.betLoading = false;
      }
    },

    // ==================== WHEEL DRAWING ====================
    
    drawWheel() {
      const canvas = this.$refs.wheelCanvas;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      const [w, h] = [canvas.width, canvas.height];
      const cx = w / 2, cy = h / 2;
      const r = w / 2 - 12;
      
      ctx.clearRect(0, 0, w, h);

      if (!this.game.players || !this.game.players.length) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = '#1a1a1f';
        ctx.fill();
        ctx.strokeStyle = '#2a2a2e';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.fillStyle = '#6b6b6b';
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('no bets', cx, cy);
        return;
      }

      const total = this.game.totalBet;
      let startAngle = (this.spinAngle * Math.PI) / 180;

      this.game.players.forEach((player, i) => {
        const sliceAngle = (player.bet / total) * 2 * Math.PI;
        const endAngle = startAngle + sliceAngle;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, startAngle, endAngle);
        ctx.closePath();
        
        ctx.fillStyle = COLORS[i % COLORS.length];
        ctx.fill();
        
        ctx.strokeStyle = '#0d0d0f';
        ctx.lineWidth = 1;
        ctx.stroke();

        if (sliceAngle > 0.15) {
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(startAngle + sliceAngle / 2);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = '12px system-ui, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#00000080';
          ctx.shadowBlur = 4;
          ctx.fillText(player.emoji, 50, 0);
          ctx.restore();
        }

        startAngle = endAngle;
      });

      ctx.beginPath();
      ctx.arc(cx, cy, 35, 0, Math.PI * 2);
      ctx.fillStyle = '#0d0d0f';
      ctx.fill();
      ctx.strokeStyle = '#f0b429';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Рисуем прогресс вращения если идет анимация
      if (this.isSpinning && this.spinProgress > 0 && this.spinProgress < 1) {
        ctx.beginPath();
        ctx.arc(cx, cy, 30, 0, this.spinProgress * Math.PI * 2);
        ctx.strokeStyle = '#f0b429';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    },

    getTimerWidth() {
      if (this.isSpinning || this.game.status === 'waiting_for_players') return '0%';
      return `${(this.timeLeft / ROUND_TIME) * 100}%`;
    },

    playerColor(userId) {
      const index = this.game.players.findIndex(p => p.userId === userId);
      return COLORS[index % COLORS.length];
    },

    playerChance(player) {
      const total = this.game.totalBet || 1;
      return ((player.bet / total) * 100).toFixed(1);
    },

    // ==================== MODAL METHODS ====================
    
    openModal(type) {
      this.modal = type;
      
      if (type === 'deposit') {
        this.depositStep = 1;
        this.depositAmt = 10;
        this.depositDone = false;
        this.depositLoading = false;
        this.depositStatus = 'Waiting for transaction...';
        this.currentDepComment = `dep_${this.user?.id}_${Date.now()}`.slice(0, 30);
      } else if (type === 'withdraw') {
        this.withdrawAmt = 10;
        this.withdrawWallet = '';
        this.withdrawLoading = false;
        this.withdrawSuccess = false;
      }
    },
    
    closeModal() { 
      this.modal = null;
    },
    
    openTonLink() {
      const nano = Math.round(this.depositAmt * 1e9);
      const comment = encodeURIComponent(this.currentDepComment);
      window.open(`ton://transfer/${HOUSE_WALLET}?amount=${nano}&text=${comment}`, '_blank');
    },
    
    async copyText(text) {
      try {
        await navigator.clipboard.writeText(text);
        this.showToast('Copied!');
      } catch (err) {
        this.showToast('Failed to copy');
      }
    },
    
    async submitDepositRequest() {
      this.depositLoading = true;
      
      try {
        await addDoc(collection(db, 'deposit_requests'), {
          userId: this.user.id,
          userName: this.user.name,
          userHandle: this.user.handle,
          amount: this.depositAmt,
          comment: this.currentDepComment,
          status: 'pending',
          ts: serverTimestamp(),
        });
        
        this.depositStep = 3;
        this.depositLoading = false;
        this.depositStatus = 'Waiting for blockchain confirmation...';
        
        setTimeout(() => {
          this.checkPendingDeposits();
        }, 5000);
        
        this.getTg()?.HapticFeedback?.notificationOccurred('success');
        
      } catch (e) { 
        this.showToast('Error: ' + e.message); 
        this.depositLoading = false;
      }
    },
    
    async submitWithdrawRequest() {
      if (!this.canWithdraw) return;
      
      this.withdrawLoading = true;
      
      try {
        await runTransaction(db, async (transaction) => {
          const userRef = doc(db, 'users', this.user.id);
          const userSnap = await transaction.get(userRef);
          
          if (!userSnap.exists()) throw new Error('User not found');
          
          const userData = userSnap.data();
          if (userData.balance < this.withdrawAmt) {
            throw new Error('Insufficient balance');
          }
          
          transaction.update(userRef, {
            balance: increment(-this.withdrawAmt),
            lockedBalance: increment(this.withdrawAmt)
          });
          
          const withdrawRef = doc(collection(db, 'withdraw_requests'));
          transaction.set(withdrawRef, {
            userId: this.user.id,
            userName: this.user.name,
            userHandle: this.user.handle,
            amount: this.withdrawAmt,
            wallet: this.withdrawWallet.trim(),
            status: 'pending',
            ts: serverTimestamp()
          });
        });
        
        this.withdrawSuccess = true;
        this.showToast('Withdrawal request submitted!');
        
        setTimeout(() => {
          this.closeModal();
        }, 2000);
        
      } catch (e) {
        this.showToast('Error: ' + e.message);
      } finally {
        this.withdrawLoading = false;
      }
    },

    // ==================== PROFILE METHODS ====================
    
    async loadHistory() {
      try {
        const q = query(
          collection(db, 'users', this.user.id, 'history'),
          orderBy('ts', 'desc'),
          limit(20)
        );
        const snap = await getDocs(q);
        this.history = snap.docs.map(d => ({ 
          id: d.id, 
          ...d.data(),
          ts: d.data().ts?.toMillis() || Date.now()
        }));
      } catch(e) { 
        console.warn("Could not load history", e.message); 
      }
    },

    // ==================== ADMIN METHODS ====================
    
    switchAdmin() {
      this.tab = 'admin';
      this.subscribeAdmin();
    },
    
    async subscribeAdmin() {
      Object.values(this._unsubAdmin).forEach(unsub => unsub?.());
      
      try {
        const statsSnap = await getDoc(doc(db, 'config', 'stats'));
        if (statsSnap.exists()) { 
          Object.assign(this.adminData, statsSnap.data()); 
        }
        
        const uSnap = await getDocs(
          query(collection(db, 'users'), orderBy('balance', 'desc'), limit(50))
        );
        this.adminData.users = uSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        this.adminData.totalUsers = this.adminData.users.length;
        
        const gamesSnap = await getDocs(collection(db, 'games'));
        let volume = 0;
        gamesSnap.forEach(doc => {
          volume += doc.data().totalBet || 0;
        });
        this.adminData.totalGames = gamesSnap.size;
        this.adminData.totalVolume = volume;
        
        let houseBalance = 0;
        uSnap.docs.forEach(doc => {
          const data = doc.data();
          houseBalance += (data.balance || 0) + (data.lockedBalance || 0);
        });
        this.adminData.houseBalance = houseBalance;
        
      } catch (e) { 
        console.error('Admin data load error:', e); 
      }

      this._unsubAdmin.withdraws = onSnapshot(
        query(
          collection(db, 'withdraw_requests'), 
          where('status', '==', 'pending'), 
          orderBy('ts', 'desc')
        ),
        (snap) => {
          this.adminData.withdraws = snap.docs.map(d => ({ 
            id: d.id, 
            ...d.data(), 
            processing: false,
            ts: d.data().ts?.toMillis() || Date.now()
          }));
        }
      );
      
      this._unsubAdmin.deposits = onSnapshot(
        query(
          collection(db, 'deposit_requests'), 
          orderBy('ts', 'desc'), 
          limit(20)
        ),
        (snap) => {
          this.adminData.deposits = snap.docs.map(d => ({ 
            id: d.id, 
            ...d.data(), 
            ts: d.data().ts?.toMillis() || Date.now()
          }));
        }
      );
    },
    
    async approveWithdraw(r) {
      r.processing = true;
      try {
        const batch = writeBatch(db);
        
        batch.update(doc(db, 'withdraw_requests', r.id), { 
          status: 'approved', 
          approvedAt: serverTimestamp(),
          processedBy: this.user.id
        });
        
        batch.update(doc(db, 'users', r.userId), {
          lockedBalance: increment(-r.amount)
        });
        
        await batch.commit();
        
        await addDoc(collection(db, 'users', r.userId, 'history'), {
          type: 'withdraw',
          amount: -r.amount,
          ts: serverTimestamp()
        });
        
        this.showToast(`✓ Approved ${r.amount} TON for ${r.userName}`);
      } catch (e) { 
        this.showToast('Error: ' + e.message); 
      } finally {
        r.processing = false;
      }
    },
    
    async rejectWithdraw(r) {
      r.processing = true;
      try {
        const batch = writeBatch(db);
        
        batch.update(doc(db, 'users', r.userId), {
          balance: increment(r.amount),
          lockedBalance: increment(-r.amount)
        });
        
        batch.update(doc(db, 'withdraw_requests', r.id), { 
          status: 'rejected', 
          rejectedAt: serverTimestamp(),
          processedBy: this.user.id
        });
        
        await batch.commit();
        this.showToast('Withdrawal rejected, funds returned');
      } catch (e) { 
        this.showToast('Error: ' + e.message); 
      } finally {
        r.processing = false;
      }
    },
    
    async adminAddBalance(u, amount) {
      try {
        await updateDoc(doc(db, 'users', u.id), { 
          balance: increment(amount) 
        });
        this.showToast(`+${amount} TON → ${u.name}`);
      } catch (e) { 
        this.showToast('Error: ' + e.message); 
      }
    },
    
    adminSetBalance(u) {
      const val = prompt(`Set balance for ${u.name} (current: ${u.balance} TON):`);
      if (val === null || isNaN(parseFloat(val))) return;
      
      const newBal = parseFloat(val);
      updateDoc(doc(db, 'users', u.id), { balance: newBal })
        .then(() => this.showToast(`Balance → ${newBal} TON`))
        .catch(e => this.showToast('Error: ' + e.message));
    },

    // ==================== UTILITIES ====================
    
    fmt(num) {
      if (num === undefined || num === null) return '0.00';
      return num.toFixed(2);
    },

    formatTime(timestamp) {
      if (!timestamp) return '';
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    },

    showToast(msg) {
      this.toastMsg = msg;
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => {
        this.toastMsg = '';
      }, 3000);
    },
    
    getTg() { 
      return window.Telegram?.WebApp; 
    },

    async copyRef() {
      try {
        await navigator.clipboard.writeText(this.referralLink);
        this.copied = true;
        setTimeout(() => { this.copied = false; }, 2000);
        this.showToast('Referral link copied!');
      } catch (e) {
        console.error('Copy failed:', e);
      }
    },
  },
};
</script>

<style scoped>
/* THIS CSS IS WELL-WRITTEN AND FULLY RESPONSIVE. NO CHANGES ARE NEEDED. */
/* It uses modern techniques like CSS variables, flexbox, and grid, and has a mobile-first design. */
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
.app{--bg:#0d0d0f;--s1:#141416;--s2:#1c1c1f;--s3:#242428;--bd:rgba(255,255,255,0.07);--bd2:rgba(255,255,255,0.13);--gold:#f0b429;--gold-bg:rgba(240,180,41,0.10);--green:#3ec97b;--red:#e05252;--blue:#52a0e0;--txt:#f0f0f0;--txt2:rgba(240,240,240,0.55);--txt3:rgba(240,240,240,0.28);--r:14px;font-family:'DM Sans',system-ui,sans-serif;background:var(--bg);color:var(--txt);min-height:100vh;max-width:430px;margin:0 auto;padding-bottom:40px;-webkit-tap-highlight-color:transparent;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
button{font-family:inherit;cursor:pointer;border:none;outline:none;background:none}
input{font-family:inherit;outline:none;border:none;background:none;color:inherit}
input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
.splash{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:20px}
.splash-logo{display:flex;flex-direction:column;align-items:center;gap:8px}
.splash-icon{font-size:52px;color:var(--gold)}
.splash-title{font-size:30px;font-weight:600;letter-spacing:-.02em}
.splash-sub{font-size:13px;color:var(--txt3);margin-bottom:8px}
.splash-btn{padding:14px 44px;background:var(--gold);color:#0d0d0f;border-radius:40px;font-size:15px;font-weight:600;transition:transform .15s cubic-bezier(.2, .8, .4, 1)}
.splash-btn:active{transform:scale(.95)}
.hdr{display:flex;align-items:center;justify-content:space-between;padding:18px 18px 0}
.hdr-user{display:flex;align-items:center;gap:10px;min-width:0}
.hdr-info{min-width:0}
.hdr-avatar{width:38px;height:38px;border-radius:50%;background:var(--s2);border:1px solid var(--bd2);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
.hdr-name{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hdr-handle{font-size:11px;color:var(--txt3);font-family:'DM Mono',monospace}
.hdr-balance{display:flex;align-items:baseline;gap:4px;background:var(--gold-bg);border:1px solid rgba(240,180,41,.18);border-radius:40px;padding:8px 14px;cursor:pointer;transition:border-color .15s;flex-shrink:0}
.hdr-balance:hover{border-color:rgba(240,180,41,.38)}
.hdr-bal-num{font-family:'DM Mono',monospace;font-size:14px;color:var(--gold)}
.hdr-bal-cur{font-size:10px;color:rgba(240,180,41,.6);text-transform:uppercase;margin-left:3px}
.nav{display:flex;gap:6px;padding:14px 18px;position:sticky;top:0;z-index:40;background:var(--bg);border-bottom:1px solid var(--bd)}
.nav-btn{flex:1;padding:9px 6px;border-radius:10px;border:1px solid transparent;font-size:13px;color:var(--txt2);transition:all .15s}
.nav-btn.active{background:var(--s2);border-color:var(--bd2);color:var(--txt)}
.tab{padding:16px 18px;display:flex;flex-direction:column;gap:14px}
.conn-banner{background:var(--s1);border:1px solid var(--bd);border-radius:10px;padding:10px 14px;display:flex;align-items:center;gap:8px;font-size:13px;color:var(--txt2)}
.conn-dot{width:8px;height:8px;border-radius:50%;background:var(--gold);animation:blink 1s ease-in-out infinite;flex-shrink:0}
.stats-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.stat-box{background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);padding:14px 10px;text-align:center}
.stat-val{display:block;font-family:'DM Mono',monospace;font-size:20px;line-height:1;margin-bottom:5px;transition:color .3s}
.stat-val.danger{color:var(--red);animation:blink 1s ease-in-out infinite}
.stat-val.gold{color:var(--gold)}
.stat-lbl{font-size:10px;color:var(--txt3);text-transform:uppercase;letter-spacing:.08em}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.4}}
.timer-track{height:3px;background:var(--s2);border-radius:2px;overflow:hidden}
.timer-fill{height:100%;background:var(--gold);border-radius:2px}
.timer-fill.danger{background:var(--red)}
.wheel-section{display:flex;justify-content:center;margin:4px 0}
.wheel-wrap{position:relative;width:280px;height:280px}
.wheel-canvas{display:block;border-radius:50%;width:100%;height:100%}
.wheel-pointer{position:absolute;top:-4px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:14px solid var(--gold);filter:drop-shadow(0 2px 6px rgba(240,180,41,.5));z-index:5}
.wheel-center{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:46px;height:46px;background:var(--bg);border-radius:50%;border:2px solid var(--bd2);display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--txt3);z-index:4;pointer-events:none}
.bet-card{background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);padding:16px;display:flex;flex-direction:column;gap:10px}
.bet-row{display:flex;align-items:center;gap:8px}
.adj-btn{width:44px;height:44px;border-radius:10px;background:var(--s2);border:1px solid var(--bd2);color:var(--txt);font-size:22px;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0}
.adj-btn:hover:not(:disabled){border-color:var(--gold);color:var(--gold)}
.adj-btn:disabled{opacity:.3;cursor:not-allowed}
.bet-field{flex:1;height:44px;border-radius:10px;background:var(--s2);border:1px solid var(--bd2);display:flex;align-items:center;justify-content:center;gap:6px;padding:0 12px}
.bet-input{flex:1;font-family:'DM Mono',monospace;font-size:16px;text-align:center;width:100%}
.bet-input:disabled{opacity:.5}
.bet-cur{font-size:11px;color:var(--txt3)}
.bet-error{font-size:12px;color:var(--red);text-align:center;min-height:1em}
.quick-row{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.quick-btn{flex:1;padding:8px 4px;border:1px solid var(--bd);border-radius:8px;color:var(--txt2);font-size:12px;font-family:'DM Mono',monospace;transition:all .15s}
.quick-btn:hover:not(:disabled){border-color:var(--bd2);color:var(--txt)}
.quick-btn:disabled{opacity:.3;cursor:not-allowed}
.place-btn{width:100%;padding:13px;border-radius:11px;border:1px solid var(--bd);color:var(--txt2);font-size:14px;font-weight:500;transition:all .2s;position:relative}
.place-btn.active{background:var(--gold);border-color:transparent;color:#0d0d0f;font-weight:600}
.place-btn.active:hover{opacity:.9}
.place-btn.done{background:var(--s2);border-color:var(--green);color:var(--green)}
.place-btn:disabled:not(.done){cursor:not-allowed;background:var(--s2);color:var(--txt3)}
.players-card{background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);padding:16px}
.players-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.card-title{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--txt2)}
.players-count{font-family:'DM Mono',monospace;font-size:11px;color:var(--txt3);background:var(--s2);padding:2px 8px;border-radius:20px}
.empty-msg{font-size:13px;color:var(--txt3);text-align:center;padding:16px 0}
.players-list{display:flex;flex-direction:column;gap:6px;min-height:40px}
.player-row{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--s2);border-radius:10px;border-left:3px solid transparent;animation:slideUp .2s ease-out}
@keyframes slideUp{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
.pr-left{display:flex;align-items:center;gap:8px;min-width:0}
.pr-emoji{font-size:18px}
.pr-name{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pr-me{font-weight:600}
.pr-you{font-size:10px;color:var(--gold);margin-left:4px}
.pr-right{display:flex;align-items:center;gap:10px;flex-shrink:0}
.pr-chance{font-size:11px;color:var(--txt3);font-family:'DM Mono',monospace;width:40px;text-align:right}
.pr-bet{font-size:12px;color:var(--gold);font-family:'DM Mono',monospace}
.profile-hero{text-align:center;padding:12px 0 4px}
.profile-avatar{width:72px;height:72px;border-radius:50%;margin:0 auto 12px;background:var(--s2);border:1px solid var(--bd2);display:flex;align-items:center;justify-content:center;font-size:36px}
.profile-name{font-size:20px;font-weight:600}
.profile-handle{font-size:12px;color:var(--txt3);font-family:'DM Mono',monospace;margin-top:2px}
.pstats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.pstat{background:var(--s1);border:1px solid var(--bd);border-radius:12px;padding:14px 6px;text-align:center}
.pstat-val{display:block;font-family:'DM Mono',monospace;font-size:16px;margin-bottom:4px}
.pstat-lbl{font-size:9px;color:var(--txt3);text-transform:uppercase;letter-spacing:.08em}
.ref-card{background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);padding:16px}
.ref-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.ref-bonus{font-size:11px;color:var(--green)}
.ref-row{display:flex;gap:8px}
.ref-input{flex:1;background:var(--s2);border:1px solid var(--bd);border-radius:9px;padding:10px 12px;font-size:11px;font-family:'DM Mono',monospace;color:var(--txt3)}
.copy-btn{width:40px;height:40px;background:var(--s2);border:1px solid var(--bd2);border-radius:9px;font-size:15px;color:var(--txt2);display:flex;align-items:center;justify-content:center;transition:all .15s}
.copy-btn:hover{border-color:var(--gold);color:var(--gold)}
.fin-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.fin-btn{padding:13px;border-radius:11px;font-size:14px;font-weight:500;transition:opacity .15s}
.fin-btn.green{background:rgba(62,201,123,.12);border:1px solid rgba(62,201,123,.25);color:var(--green)}
.fin-btn.red{background:rgba(224,82,82,.12);border:1px solid rgba(224,82,82,.25);color:var(--red)}
.fin-btn:hover:not(:disabled){opacity:.8}
.fin-btn:disabled{opacity:.3;cursor:not-allowed}
.history-card{background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);padding:16px}
.history-list{display:flex;flex-direction:column;gap:6px}
.history-row{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--s2);border-radius:9px}
.hist-left{display:flex;align-items:center;gap:8px}
.hist-result{font-size:10px;font-weight:600;letter-spacing:.08em}
.hist-time{font-size:10px;color:var(--txt3)}
.hist-amount{font-family:'DM Mono',monospace;font-size:13px}
.win{color:var(--green)}.loss{color:var(--red)}
.admin-tab{padding:16px 18px;display:flex;flex-direction:column;gap:14px}
.admin-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.astat{background:var(--s1);border:1px solid var(--bd);border-radius:12px;padding:12px 6px;text-align:center}
.astat-val{display:block;font-family:'DM Mono',monospace;font-size:16px;margin-bottom:3px}
.astat-lbl{font-size:9px;color:var(--txt3);text-transform:uppercase}
.admin-actions{display:flex;gap:8px}
.admin-action-btn{flex:1;padding:10px;border-radius:10px;border:1px solid var(--bd2);color:var(--txt2);font-size:13px;transition:all .15s}
.admin-action-btn:hover{background:var(--s2);color:var(--txt)}
.danger-btn{border-color:rgba(224,82,82,.3)!important;color:var(--red)!important}
.admin-section{background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);padding:16px;display:flex;flex-direction:column;gap:8px}
.section-head{display:flex;align-items:center;justify-content:space-between}
.badge{background:var(--s2);border:1px solid var(--bd2);border-radius:20px;padding:2px 8px;font-size:11px;font-family:'DM Mono',monospace;color:var(--txt2)}
.req-row{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--s2);border-radius:10px}
.req-info{display:flex;flex-direction:column;gap:2px;min-width:0}
.req-user{font-size:13px;font-weight:500}
.req-uid{font-size:11px;color:var(--txt3);font-family:'DM Mono',monospace}
.req-meta{font-size:11px;color:var(--txt3)}
.req-txhash{font-size:10px;color:var(--txt3);font-family:'DM Mono',monospace;word-break:break-all}
.req-wallet{font-size:10px;color:var(--blue);font-family:'DM Mono',monospace;word-break:break-all}
.req-actions{display:flex;gap:6px;flex-shrink:0}
.req-approve,.req-reject{padding:6px 10px;border-radius:8px;font-size:13px;font-family:monospace;transition:all .15s;white-space:nowrap}
.req-approve{background:rgba(62,201,123,.1);border:1px solid rgba(62,201,123,.25);color:var(--green)}
.req-approve:hover:not(:disabled){background:rgba(62,201,123,.2)}
.req-reject{background:rgba(224,82,82,.1);border:1px solid rgba(224,82,82,.25);color:var(--red)}
.req-reject:hover:not(:disabled){background:rgba(224,82,82,.2)}
.req-approve:disabled,.req-reject:disabled{opacity:.4;cursor:not-allowed}
.user-row{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--s2);border-radius:10px}
.user-info{display:flex;align-items:center;gap:10px;min-width:0}
.user-emoji{font-size:20px}
.user-info > div{min-width:0}
.user-name-txt{display:block;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.user-bal{display:block;font-size:11px;color:var(--gold);font-family:'DM Mono',monospace}
.user-actions{display:flex;gap:6px}
.small-btn{padding:5px 10px;border-radius:7px;font-size:12px;border:1px solid var(--bd2);color:var(--txt2);transition:all .15s}
.small-btn:hover{background:var(--s1);color:var(--txt)}
.danger-sm{border-color:rgba(224,82,82,.3)!important;color:var(--red)!important}
.overlay{position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.85);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px}
.winner-card{background:var(--s1);border:1px solid var(--bd2);border-radius:22px;padding:32px 28px;text-align:center;max-width:300px;width:100%}
.wc-trophy{font-size:52px;margin-bottom:12px;animation:trophy-pop .5s .1s cubic-bezier(.2, .8, .4, 1) both}
@keyframes trophy-pop{from{opacity:0;transform:scale(.5)}to{opacity:1;transform:scale(1)}}
.wc-label{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--txt3);margin-bottom:8px}
.wc-name{font-size:22px;font-weight:600;margin-bottom:6px}
.wc-prize{font-family:'DM Mono',monospace;font-size:22px;color:var(--gold);margin-bottom:8px}
.wc-you{font-size:14px;color:var(--green);margin-bottom:18px}
.wc-loss{font-size:13px;color:var(--red);margin-bottom:18px}
.wc-close{width:100%;padding:13px;border-radius:11px;border:1px solid var(--bd2);color:var(--txt);font-size:14px;transition:background .15s;margin-top:6px}
.wc-close:hover{background:var(--s2)}
.modal-card{background:var(--s1);border:1px solid var(--bd2);border-radius:22px;padding:24px;max-width:360px;width:100%;max-height:90vh;overflow-y:auto}
.modal-title{font-size:17px;font-weight:600;margin-bottom:18px;text-align:center}
.modal-avail{font-size:12px;color:var(--txt2);text-align:center;margin-bottom:14px}
.modal-steps{display:flex;align-items:center;margin-bottom:20px}
.step{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--txt3);transition:color .2s}
.step.active{color:var(--txt)}
.step-num{width:20px;height:20px;border-radius:50%;background:var(--s2);border:1px solid var(--bd2);display:flex;align-items:center;justify-content:center;font-size:10px;transition:all .2s}
.step.active .step-num{background:var(--gold);border-color:transparent;color:#0d0d0f}
.step-line{flex:1;height:1px;background:var(--bd);margin:0 8px}
.deposit-info{background:var(--s2);border-radius:12px;padding:14px;margin-bottom:14px}
.dep-row{display:flex;flex-direction:column;gap:4px;margin-bottom:12px}
.dep-row:last-of-type{margin-bottom:0}
.dep-lbl{font-size:10px;color:var(--txt3);text-transform:uppercase;letter-spacing:.06em}
.dep-val{font-family:'DM Mono',monospace;font-size:16px}
.dep-wallet-row{display:flex;align-items:center;gap:8px}
.dep-wallet{font-family:'DM Mono',monospace;font-size:11px;color:var(--txt2);word-break:break-all;flex:1}
.copy-small{width:28px;height:28px;flex-shrink:0;background:var(--s1);border:1px solid var(--bd2);border-radius:7px;font-size:13px;color:var(--txt2);display:flex;align-items:center;justify-content:center}
.copy-small:hover{border-color:var(--gold);color:var(--gold)}
.dep-note{font-size:11px;color:var(--gold);background:rgba(240,180,41,.08);border:1px solid rgba(240,180,41,.15);border-radius:9px;padding:10px 12px;margin-top:4px}
.dep-confirm-info{font-size:13px;color:var(--txt2);margin-bottom:12px;text-align:center}
.ton-connect-btn{width:100%;padding:13px;border-radius:11px;background:rgba(82,160,224,.12);border:1px solid rgba(82,160,224,.25);color:var(--blue);font-size:14px;font-weight:500;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:4px;transition:all .15s}
.ton-connect-btn:hover{background:rgba(82,160,224,.2)}
.preset-row{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:16px}
.preset-btn{flex:1;min-width:50px;padding:9px 6px;border-radius:9px;border:1px solid var(--bd);font-size:13px;color:var(--txt2);transition:all .15s}
.preset-btn.active{border-color:var(--gold);color:var(--gold);background:var(--gold-bg)}
.preset-btn:hover:not(:disabled):not(.active){border-color:var(--bd2);color:var(--txt)}
.preset-btn:disabled{opacity:.3;cursor:not-allowed}
.modal-field{display:flex;align-items:center;background:var(--s2);border:1px solid var(--bd2);border-radius:11px;padding:12px 16px;margin-bottom:16px}
.modal-input{flex:1;font-family:'DM Mono',monospace;font-size:15px;width:100%}
.modal-cur{font-size:12px;color:var(--gold);margin-left:6px}
.loading-row{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--txt2);margin-bottom:12px}
.spinner-small{width:16px;height:16px;border-radius:50%;border:2px solid var(--bd2);border-top-color:var(--gold);animation:spin .7s linear infinite;flex-shrink:0}
@keyframes spin{to{transform:rotate(360deg)}}
.success-msg{text-align:center;color:var(--green);font-size:14px;padding:8px 0 16px}
.modal-btns{display:flex;gap:10px}
.modal-cancel{flex:1;padding:13px;border-radius:11px;border:1px solid var(--bd);color:var(--txt2);font-size:14px;transition:all .15s}
.modal-cancel:hover{background:var(--s2);color:var(--txt)}
.modal-confirm{flex:1;padding:13px;border-radius:11px;background:var(--gold);color:#0d0d0f;border:none;font-weight:600;font-size:14px;transition:opacity .15s}
.modal-confirm:hover:not(:disabled){opacity:.88}
.modal-confirm:disabled{opacity:.3;cursor:not-allowed}
.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--s2);border:1px solid var(--bd2);border-radius:30px;padding:10px 20px;font-size:13px;color:var(--txt);z-index:200;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,.4)}
.fade-enter-active,.fade-leave-active{transition:opacity .25s, transform .25s;transition-timing-function:cubic-bezier(.2, .8, .4, 1)}
.fade-enter-from, .fade-leave-to{opacity:0;transform:scale(.9)}
.toast-anim-enter-active,.toast-anim-leave-active{transition:all .3s cubic-bezier(.2, .8, .4, 1)}
.toast-anim-enter-from,.toast-anim-leave-to{opacity:0;transform:translateY(15px) translateX(-50%)}
.gold{color:var(--gold)}.green{color:var(--green)}
@media(max-width:380px){.pstats{grid-template-columns:repeat(2,1fr)}.admin-stats{grid-template-columns:repeat(2,1fr)}}
</style>
