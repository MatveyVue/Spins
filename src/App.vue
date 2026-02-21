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
const HOUSE_WALLET = '0QBbz6lrdck00jKezlUKQAn1QzV1uOB1uUs5caKFv-m1zxCM'; // ← REPLACE WITH YOUR WALLET

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
        endsAt: null 
      },

      // Spin Animation
      isSpinning: false,
      timeLeft: ROUND_TIME,
      timerHandle: null,
      spinAngle: 0,
      animFrame: null,
      winner: null,

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
      return this.user?.handle === 'whsxg'; // Replace with your admin handle
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
        // For production, use your own proxy
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
        // Get all pending deposits for this user
        const pendingQuery = query(
          collection(db, 'deposit_requests'),
          where('userId', '==', this.user.id),
          where('status', '==', 'pending'),
          orderBy('ts', 'desc'),
          limit(10)
        );
        
        const snapshot = await getDocs(pendingQuery);
        if (snapshot.empty) return;
        
        // Fetch latest transactions from TonCenter
        const transactions = await this.fetchTonCenterTransactions();
        if (!transactions || transactions.length === 0) return;
        
        for (const docSnapshot of snapshot.docs) {
          const deposit = docSnapshot.data();
          
          // Skip if already processed
          if (this._lastCheckedTx[deposit.id]) continue;
          
          // Check each transaction for matching comment
          for (const tx of transactions) {
            if (!tx.comment) continue;
            
            // Clean comment from null bytes
            const cleanComment = tx.comment.replace(/\0/g, '').trim();
            const expectedComment = deposit.comment.replace(/\0/g, '').trim();
            
            // Check if this transaction matches our deposit comment
            if (cleanComment.includes(expectedComment) || 
                expectedComment.includes(cleanComment)) {
              
              // Found matching transaction - credit the user
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
          
          // Update user balance
          transaction.update(userRef, {
            balance: increment(deposit.amount)
          });
          
          // Update deposit request status
          transaction.update(docRef, {
            status: 'completed',
            txHash: tx.hash,
            completedAt: serverTimestamp()
          });
        });
        
        // Add to user's history
        await addDoc(collection(db, 'users', deposit.userId, 'history'), {
          type: 'deposit',
          amount: deposit.amount,
          txHash: tx.hash,
          ts: serverTimestamp()
        });
        
        // Update global stats
        const statsRef = doc(db, 'config', 'stats');
        await setDoc(statsRef, {
          totalDeposits: increment(deposit.amount),
          totalTransactions: increment(1)
        }, { merge: true });
        
        // Show notification
        this.showToast(`✅ +${this.fmt(deposit.amount)} TON deposited!`);
        
        // If this is the current user and modal is open, update status
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
        // Fallback for local testing
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
      // Assign random emoji
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
          // Update last seen
          await updateDoc(userRef, { lastSeen: serverTimestamp() });
          
          // Get existing emoji or assign new one
          const existingData = userSnap.data();
          if (existingData.emoji) {
            this.user.emoji = existingData.emoji;
          }
        }

        // Listen to user data
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
        this.balance = 100; // Demo balance
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
          winnerId: d.winnerId || null,
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
          const winnerPlayer = (d.players || []).find(p => p.userId === d.winnerId);
          if (winnerPlayer) {
            setTimeout(() => this.animateSpin(winnerPlayer), 600);
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
          winnerId: null, 
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
              // Reset timer if not enough players
              transaction.update(gameRef, {
                endsAt: new Date(Date.now() + ROUND_TIME * 1000)
              });
            } else {
              const winner = weightedRandom(gd.players);
              transaction.update(gameRef, { 
                status: 'spinning', 
                winnerId: winner.userId 
              });
            }
          }
        });
      } catch (e) {
        console.error("Failed to end round: ", e);
      }
    },

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

      const duration = 6000;
      const t0 = performance.now();
      const startAng = this.spinAngle;
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

        // Pay winner
        batch.update(doc(db, 'users', winnerPlayer.userId), {
          balance: increment(prize),
          'stats.won': increment(1),
          'stats.played': increment(1),
          'stats.earned': increment(prize),
        });

        // Update stats for losers
        this.game.players.forEach(p => {
          if (p.userId !== winnerPlayer.userId) {
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
          houseBalance: increment(houseCut),
        }, { merge: true });

        await batch.commit();

        // Add to history
        if (myBet) {
          await addDoc(collection(db, 'users', this.user.id, 'history'), {
            won: isWinnerMe,
            amount: isWinnerMe ? prize - myBet.bet : myBet.bet,
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
        name: winnerPlayer.name,
        prize: prize,
        isMe: isWinnerMe,
        myLoss: myBet && !isWinnerMe ? myBet.bet : 0,
      };

      // Reset round after delay
      setTimeout(() => {
        this.createFirestoreRound();
      }, 5000);
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

          // Deduct balance
          transaction.update(userRef, { 
            balance: increment(-this.betAmount) 
          });

          // Add player to game
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

          // Start timer if this is first player
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

        // Draw slice
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, startAngle, endAngle);
        ctx.closePath();
        
        ctx.fillStyle = COLORS[i % COLORS.length];
        ctx.fill();
        
        ctx.strokeStyle = '#0d0d0f';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Add emoji if slice is big enough
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

      // Center circle
      ctx.beginPath();
      ctx.arc(cx, cy, 35, 0, Math.PI * 2);
      ctx.fillStyle = '#0d0d0f';
      ctx.fill();
      ctx.strokeStyle = '#f0b429';
      ctx.lineWidth = 2;
      ctx.stroke();
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
        // Create deposit request
        await addDoc(collection(db, 'deposit_requests'), {
          userId: this.user.id,
          userName: this.user.name,
          userHandle: this.user.handle,
          amount: this.depositAmt,
          comment: this.currentDepComment,
          status: 'pending',
          ts: serverTimestamp(),
        });
        
        // Move to waiting step
        this.depositStep = 3;
        this.depositLoading = false;
        this.depositStatus = 'Waiting for blockchain confirmation...';
        
        // Immediately check for this deposit
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
          
          // Lock funds
          transaction.update(userRef, {
            balance: increment(-this.withdrawAmt),
            lockedBalance: increment(this.withdrawAmt)
          });
          
          // Create withdrawal request
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
      // Unsubscribe from old listeners
      Object.values(this._unsubAdmin).forEach(unsub => unsub?.());
      
      try {
        // Load stats
        const statsSnap = await getDoc(doc(db, 'config', 'stats'));
        if (statsSnap.exists()) { 
          Object.assign(this.adminData, statsSnap.data()); 
        }
        
        // Load users
        const uSnap = await getDocs(
          query(collection(db, 'users'), orderBy('balance', 'desc'), limit(50))
        );
        this.adminData.users = uSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        this.adminData.totalUsers = this.adminData.users.length;
        
        // Calculate volume
        const gamesSnap = await getDocs(collection(db, 'games'));
        let volume = 0;
        gamesSnap.forEach(doc => {
          volume += doc.data().totalBet || 0;
        });
        this.adminData.totalGames = gamesSnap.size;
        this.adminData.totalVolume = volume;
        
        // Calculate house balance
        let houseBalance = 0;
        uSnap.docs.forEach(doc => {
          const data = doc.data();
          houseBalance += (data.balance || 0) + (data.lockedBalance || 0);
        });
        this.adminData.houseBalance = houseBalance;
        
      } catch (e) { 
        console.error('Admin data load error:', e); 
      }

      // Listen to pending withdrawals
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
      
      // Listen to recent deposits (for info)
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
