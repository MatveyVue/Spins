<template>
  <div class="app" :class="{ 'app--dark': true }">

    <!-- SPLASH -->
    <div v-if="!user" class="splash">
      <div class="splash-bg">
        <div class="splash-orb splash-orb--1"></div>
        <div class="splash-orb splash-orb--2"></div>
        <div class="splash-grid"></div>
      </div>
      <div class="splash-content">
        <div class="splash-logo">
          <div class="logo-icon">
            <span class="logo-diamond">◈</span>
          </div>
          <h1 class="splash-title">TON<br><span class="splash-title--accent">ROULETTE</span></h1>
        </div>
        <p class="splash-sub">Stake · Spin · Win</p>
        <button class="splash-btn" @click="quickLogin">
          <span class="btn-shine"></span>
          Enter Game
        </button>
      </div>
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
          <div class="hdr-bal-inner">
            <span class="hdr-bal-num">{{ fmt(balance) }}</span>
            <span class="hdr-bal-cur">TON</span>
          </div>
          <div class="hdr-bal-add">+</div>
        </div>
      </header>

      <!-- NAVIGATION -->
      <nav class="nav">
        <button :class="['nav-btn', { active: tab === 'game' }]" @click="tab = 'game'">
          <span class="nav-icon">◉</span> Game
        </button>
        <button :class="['nav-btn', { active: tab === 'profile' }]" @click="tab = 'profile'">
          <span class="nav-icon">◎</span> Profile
        </button>
        <button v-if="isAdmin" :class="['nav-btn', { active: tab === 'admin' }]" @click="switchAdmin">
          <span class="nav-icon">⬡</span> Admin
        </button>
        <div class="nav-indicator" :style="navIndicatorStyle"></div>
      </nav>

      <!-- CONNECTION BANNER -->
      <div v-if="!isConnected" class="conn-banner">
        <div class="conn-pulse"></div> Reconnecting…
      </div>

      <!-- ═══ GAME TAB ═══ -->
      <div v-if="tab === 'game'" class="tab game-tab">

        <!-- STATS ROW -->
        <div class="stats-row">
          <div class="stat-box">
            <span :class="['stat-val', { danger: timeLeft <= 5 && !isSpinning }]">
              {{ isSpinning ? '—' : timeLeft + 's' }}
            </span>
            <span class="stat-lbl">Timer</span>
          </div>
          <div class="stat-box stat-box--main">
            <span class="stat-val gold">{{ fmt(game.totalBet) }}</span>
            <span class="stat-lbl">Prize Pool TON</span>
          </div>
          <div class="stat-box">
            <span class="stat-val">{{ game.players.length }}</span>
            <span class="stat-lbl">Players</span>
          </div>
        </div>

        <!-- TIMER BAR -->
        <div class="timer-track">
          <div class="timer-fill"
            :class="{ danger: timeLeft <= 5 && !isSpinning }"
            :style="{ width: getTimerWidth(), transition: isSpinning ? 'none' : 'width 0.5s linear, background 0.3s' }">
          </div>
        </div>

        <!-- BLOCK ROULETTE STRIP -->
        <div class="roulette-section">
          <div class="roulette-label" v-if="game.status === 'waiting_for_players'">Waiting for players…</div>
          <div class="roulette-label" v-else-if="isSpinning">
            <span class="spinning-text">Spinning…</span>
          </div>
          <div class="roulette-label" v-else>Round #{{ game.roundId ? String(game.roundId).slice(-4) : '—' }}</div>

          <div class="roulette-viewport">
            <div class="roulette-pointer">
              <div class="pointer-top">▼</div>
              <div class="pointer-line"></div>
            </div>

            <div class="roulette-track" ref="rouletteTrack"
              :style="{ transform: `translateX(${stripOffset}px)`, transition: isSpinning ? `transform ${SPIN_DURATION}ms cubic-bezier(0.17, 0.67, 0.12, 1.0)` : 'none' }">
              <template v-for="(block, i) in rouletteBlocks" :key="i">
                <div class="roulette-block"
                  :class="{ 'roulette-block--winner': isSpinning && block.isWinner && spinProgress > 0.9 }"
                  :style="{ background: block.color, width: block.width + 'px' }">
                  <span class="block-emoji">{{ block.emoji }}</span>
                  <span class="block-name">{{ block.shortName }}</span>
                  <span class="block-bet">{{ fmt(block.bet) }}</span>
                </div>
              </template>
            </div>

            <div class="roulette-fade roulette-fade--left"></div>
            <div class="roulette-fade roulette-fade--right"></div>
          </div>
        </div>

        <!-- BET CARD -->
        <div class="bet-card">
          <div class="bet-card-title">Place Your Bet</div>
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
            <button class="quick-btn quick-btn--max"
              :disabled="isSpinning || userAlreadyBet || balance <= 0"
              @click="betAmount = Math.floor(balance * 10) / 10">MAX</button>
          </div>

          <button class="place-btn"
            :class="{ 'place-btn--active': canBet, 'place-btn--done': userAlreadyBet }"
            :disabled="(!canBet && !userAlreadyBet) || betLoading"
            @click="placeBet">
            <span class="place-btn-shine"></span>
            <span v-if="betLoading">Placing…</span>
            <span v-else-if="isSpinning">Spinning…</span>
            <span v-else-if="userAlreadyBet">✓ Bet Placed — Good luck!</span>
            <span v-else>Place Bet</span>
          </button>
          <div v-if="betError" class="bet-error">⚠ {{ betError }}</div>
        </div>

        <!-- PLAYERS LIST -->
        <div class="players-card">
          <div class="players-head">
            <span class="card-title">This Round</span>
            <span class="players-badge">{{ game.players.length }}</span>
          </div>
          <div v-if="game.status === 'waiting_for_players'" class="empty-msg">
            <div class="empty-icon">🎰</div>
            Be the first to start the round!
          </div>
          <div v-else-if="!game.players.length" class="empty-msg">Waiting…</div>
          <div v-else class="players-list">
            <div v-for="(p, i) in game.players" :key="p.userId + i" class="player-row">
              <div class="player-color" :style="{ background: COLORS[i % COLORS.length] }"></div>
              <span class="pr-emoji">{{ p.emoji }}</span>
              <span class="pr-name" :class="{ 'pr-me': p.userId === user.id }">
                {{ p.name }}<span v-if="p.userId === user.id" class="pr-you"> YOU</span>
              </span>
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
          <div class="profile-balance">
            <span class="profile-bal-num">{{ fmt(balance) }}</span>
            <span class="profile-bal-cur">TON</span>
          </div>
        </div>

        <div class="pstats">
          <div class="pstat">
            <span class="pstat-val">{{ stats.played }}</span>
            <span class="pstat-lbl">Played</span>
          </div>
          <div class="pstat">
            <span class="pstat-val">{{ stats.won }}</span>
            <span class="pstat-lbl">Wins</span>
          </div>
          <div class="pstat">
            <span class="pstat-val gold">{{ fmt(stats.earned) }}</span>
            <span class="pstat-lbl">Earned</span>
          </div>
          <div class="pstat">
            <span class="pstat-val">{{ winRate }}%</span>
            <span class="pstat-lbl">Win Rate</span>
          </div>
        </div>

        <div class="fin-row">
          <button class="fin-btn fin-btn--deposit" @click="openModal('deposit')">
            <span class="fin-icon">↓</span> Deposit
          </button>
          <button class="fin-btn fin-btn--withdraw" @click="openModal('withdraw')" :disabled="balance < 0.1">
            <span class="fin-icon">↑</span> Withdraw
          </button>
        </div>

        <div class="ref-card">
          <div class="ref-head">
            <span class="card-title">Referral Link</span>
            <span class="ref-bonus">+5% from friends</span>
          </div>
          <div class="ref-row">
            <input class="ref-input" :value="referralLink" readonly />
            <button class="copy-btn" @click="copyRef">{{ copied ? '✓' : '⎘' }}</button>
          </div>
        </div>

        <div v-if="history.length" class="history-card">
          <div class="card-title" style="margin-bottom:14px">Recent Games</div>
          <div class="history-list">
            <div v-for="(h, i) in history" :key="i" class="history-row">
              <div class="hist-left">
                <span :class="['hist-pill', h.won ? 'win' : 'loss']">{{ h.won ? 'WIN' : 'LOSS' }}</span>
                <span class="hist-time">{{ formatTime(h.ts) }}</span>
              </div>
              <span class="hist-amount" :class="h.won ? 'win' : 'loss'">
                {{ h.won ? '+' : '−' }}{{ fmt(h.amount) }} TON
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
          <button class="admin-action-btn admin-action-btn--danger" @click="createFirestoreRound">Reset Round</button>
        </div>

        <!-- Deposits -->
        <div class="admin-section">
          <div class="section-head">
            <span class="card-title">📥 Recent Deposits</span>
            <span class="badge">{{ adminData.deposits.length }}</span>
          </div>
          <div v-if="!adminData.deposits.length" class="empty-msg">No recent deposits</div>
          <div v-for="r in adminData.deposits.slice(0,5)" :key="r.id" class="req-row">
            <div class="req-info">
              <span class="req-user">{{ r.userName }}</span>
              <span class="req-meta">{{ fmt(r.amount) }} TON · {{ formatTime(r.ts) }}</span>
              <span :class="['req-status', r.status]">{{ r.status }}</span>
            </div>
          </div>
        </div>

        <!-- Withdrawals -->
        <div class="admin-section">
          <div class="section-head">
            <span class="card-title">💸 Pending Withdrawals</span>
            <span class="badge">{{ adminData.withdraws.length }}</span>
          </div>
          <div v-if="!adminData.withdraws.length" class="empty-msg">No pending withdrawals</div>
          <div v-for="r in adminData.withdraws" :key="r.id" class="req-row">
            <div class="req-info">
              <span class="req-user">{{ r.userName }}</span>
              <span class="req-meta">{{ fmt(r.amount) }} TON · {{ formatTime(r.ts) }}</span>
              <span class="req-wallet">→ {{ r.wallet ? r.wallet.slice(0,14) + '…' : 'no wallet' }}</span>
            </div>
            <div class="req-actions">
              <button class="req-approve" @click="approveWithdraw(r)" :disabled="r.processing">✓ Paid</button>
              <button class="req-reject" @click="rejectWithdraw(r)" :disabled="r.processing">✗ Deny</button>
            </div>
          </div>
        </div>

        <!-- Users -->
        <div class="admin-section">
          <div class="card-title" style="margin-bottom:12px">👥 Users</div>
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
              <button class="small-btn small-btn--danger" @click="adminSetBalance(u)">Set</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- WINNER OVERLAY -->
    <transition name="winner-anim">
      <div v-if="winnerOverlay" class="overlay" @click="dismissWinner">
        <div class="winner-card" @click.stop>
          <div class="winner-bg-glow"></div>
          <div class="wc-trophy">🏆</div>
          <div class="wc-label">Winner!</div>
          <div class="wc-name">{{ winnerOverlay.name }}</div>
          <div class="wc-prize">+{{ fmt(winnerOverlay.prize) }} TON</div>
          <div v-if="winnerOverlay.isMe" class="wc-you">🎉 That's you!</div>
          <div v-else-if="winnerOverlay.myLoss > 0" class="wc-loss">−{{ fmt(winnerOverlay.myLoss) }} TON</div>
          <button class="wc-close" @click="dismissWinner">New Round →</button>
        </div>
      </div>
    </transition>

    <!-- DEPOSIT MODAL -->
    <transition name="modal-anim">
      <div v-if="modal === 'deposit'" class="overlay" @click.self="closeModal">
        <div class="modal-card">
          <div class="modal-title">
            <span class="modal-icon">💎</span> Deposit TON
          </div>

          <!-- Step 1 -->
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

          <!-- Step 2 -->
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
                <span class="dep-lbl">Comment <strong class="red">(REQUIRED)</strong></span>
                <div class="dep-wallet-row highlight">
                  <span class="dep-wallet gold">{{ currentDepComment }}</span>
                  <button class="copy-small gold" @click="copyText(currentDepComment)">📋</button>
                </div>
              </div>
              <div class="dep-note">
                ⚠️ The comment must be sent exactly as shown. Without it, the deposit won't be credited.
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

          <!-- Step 3 -->
          <div v-if="depositStep === 3">
            <div class="deposit-status">
              <div v-if="!depositDone" class="waiting-message">
                <div class="spinner-large"></div>
                <p class="status-text">{{ depositStatus }}</p>
                <p class="status-hint">Balance updates automatically when the blockchain confirms your transaction. Usually 1–2 minutes.</p>
              </div>
              <div v-if="depositDone" class="success-message">
                <div class="success-icon">✅</div>
                <p class="success-text">Confirmed!</p>
                <p class="success-sub">+{{ fmt(depositAmt) }} TON added to your balance</p>
              </div>
            </div>
            <div class="modal-btns" v-if="!depositDone">
              <button class="modal-cancel" @click="closeModal">Close (checking continues)</button>
            </div>
            <div class="modal-btns" v-if="depositDone">
              <button class="modal-confirm" style="width:100%" @click="closeModal">Done ✓</button>
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- WITHDRAW MODAL -->
    <transition name="modal-anim">
      <div v-if="modal === 'withdraw'" class="overlay" @click.self="closeModal">
        <div class="modal-card">
          <div class="modal-title">
            <span class="modal-icon">💸</span> Withdraw TON
          </div>
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
              placeholder="TON wallet (EQ… or UQ…)" />
          </div>
          <div v-if="withdrawWallet && !isValidTonAddress" class="error-message">
            ⚠ Invalid TON address format
          </div>
          <div class="dep-note">⏱ Manually processed within 24h.</div>
          <div v-if="withdrawLoading" class="loading-row">
            <span class="spinner-small"></span> Processing…
          </div>
          <div v-if="withdrawSuccess" class="success-msg">✓ Request submitted!</div>
          <div class="modal-btns" v-if="!withdrawSuccess">
            <button class="modal-cancel" @click="closeModal">Cancel</button>
            <button class="modal-confirm" @click="submitWithdrawRequest"
              :disabled="!canWithdraw || withdrawLoading">
              Request Withdrawal
            </button>
          </div>
          <button v-if="withdrawSuccess" class="modal-confirm" style="width:100%" @click="closeModal">Done ✓</button>
        </div>
      </div>
    </transition>

    <!-- TOAST -->
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

const EMOJIS = ['😎','🦊','🐸','🐼','🦁','🐨','🐯','🦅','🐺','🦝','🐻','🦋','🐙','🦄','🐲'];
const COLORS = ['#ff4757','#3742fa','#2ed573','#ffa502','#a55eea','#1e90ff','#ff6b81','#eccc68','#ff6348','#70a1ff'];
const ROUND_TIME = 30;
const HOUSE_FEE = 0.05;
const MIN_PLAYERS = 2;
const HOUSE_WALLET = 'UQCH_BLQPJtnfj75s3YBu3bmaUTlRi6_I7difhNqINwrRC0i';
const SPIN_DURATION = 5000;
const TRACK_REPEAT = 4;
const REFERRAL_BONUS = 0.2;
const ADMIN_HANDLE = 'whsxg';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// TON Center API Configuration
const TONCENTER_API_KEY = '62baa2e429900335d7e5367e89c7e75c7752c7c83d5fd8a0b3bcb568bd48d1ee';
const TONCENTER_API_URL = 'https://toncenter.com/api/v2/jsonRPC';

function randInt(n) { return Math.floor(Math.random() * n); }
function weightedRandom(players) {
  const total = players.reduce((s, p) => s + p.bet, 0);
  let r = Math.random() * total;
  for (const p of players) { r -= p.bet; if (r <= 0) return p; }
  return players[players.length - 1];
}
function isValidAddr(a) {
  if (!a) return false;
  a = a.trim();
  return a.startsWith('EQ') || a.startsWith('UQ') || a.startsWith('0:') || a.startsWith('EQC') || a.startsWith('UQB');
}

export default {
  name: 'App',
  data() {
    return {
      HOUSE_WALLET, SPIN_DURATION, ROUND_TIME,
      COLORS,
      user: null, tab: 'game', balance: 0,
      isConnected: false, connectionError: false,
      betAmount: 1, betLoading: false, betError: '',
      game: {
        id: null, players: [], totalBet: 0,
        status: 'waiting_for_players', endsAt: null,
        spinStartTime: null, spinDuration: SPIN_DURATION,
        winner: null, roundId: null
      },
      isSpinning: false, timeLeft: ROUND_TIME,
      timerHandle: null, winnerOverlay: null,
      spinProgress: 0,
      rouletteBlocks: [],
      stripOffset: 0,
      _unsubGame: null, _unsubUser: null, _unsubAdmin: {},
      stats: { played: 0, won: 0, earned: 0, referrals: 0, referralEarned: 0 },
      history: [], copied: false,
      modal: null,
      depositStep: 1, depositAmt: 10, depositLoading: false,
      depositDone: false, currentDepComment: '', depositStatus: 'Waiting...',
      withdrawAmt: 10, withdrawWallet: '', withdrawLoading: false, withdrawSuccess: false,
      adminData: {
        totalUsers:0, totalGames:0, totalVolume:0, houseBalance:0,
        adminBalance:0, commissionEarned:0,
        deposits:[], withdraws:[], users:[]
      },
      toastMsg: '', _toastTimer: null,
      _depositCheckInterval: null, _lastCheckedTx: {}, _isCheckingDeposits: false,
      _reconnectTimer: null,
      _isCreatingGame: false,
      _gameEndTimer: null,
      _retryCount: 0,
      _newRoundTimer: null,
      
      // TON Center related
      lastTxCheck: null,
      txCheckInProgress: false,
      depositAddress: HOUSE_WALLET,
      
      // Stats for new game
      lastRoundStats: null,
    };
  },

  computed: {
    isAdmin() { return this.user?.handle === ADMIN_HANDLE; },
    canBet() {
      return !this.isSpinning && !this.userAlreadyBet &&
        this.betAmount >= 0.1 && this.betAmount <= this.balance &&
        (this.game.status === 'waiting' || this.game.status === 'waiting_for_players') &&
        this.isConnected;
    },
    userAlreadyBet() { return this.game.players?.some(p => p.userId === this.user?.id) || false; },
    referralLink() { return `https://t.me/TonRouletteBot?start=ref_${this.user?.id}`; },
    winRate() { return !this.stats.played ? 0 : Math.round((this.stats.won / this.stats.played) * 100); },
    canWithdraw() {
      return this.withdrawAmt >= 0.1 && this.withdrawAmt <= this.balance &&
        this.withdrawWallet.length >= 10 && isValidAddr(this.withdrawWallet);
    },
    isValidTonAddress() { return isValidAddr(this.withdrawWallet); },
    navIndicatorStyle() {
      const idx = this.tab === 'game' ? 0 : this.tab === 'profile' ? 1 : 2;
      return { transform: `translateX(${idx * 100}%)` };
    },
    toncenterExplorerUrl() {
      return `https://tonviewer.com/${this.depositAddress}`;
    },
  },

  watch: {
    'game.players': {
      handler(newPlayers, oldPlayers) {
        console.log('Players changed:', newPlayers);
        this.$nextTick(() => {
          this.buildRouletteBlocks();
        });
      },
      deep: true,
      immediate: true
    },
    'game.status': {
      handler(newStatus, oldStatus) {
        console.log(`Game status changed: ${oldStatus} -> ${newStatus}`);
        
        if (newStatus === 'waiting' && oldStatus === 'waiting_for_players') {
          this.startGameTimer();
        } else if (newStatus === 'spinning') {
          this.clearGameTimer();
          // Запускаем таймер для очистки и создания нового раунда после спина
          this._newRoundTimer = setTimeout(() => {
            this.clearRouletteBlocks();
            this.createNewRoundAfterSpin();
          }, SPIN_DURATION + 2000);
        } else if (newStatus === 'waiting_for_players' && oldStatus === 'spinning') {
          this.prepareNewRound();
        }
        
        // При любом изменении статуса перестраиваем блоки
        this.$nextTick(() => {
          this.buildRouletteBlocks();
        });
      }
    }
  },

  mounted() {
    this.tryTelegram();
    this._depositCheckInterval = setInterval(() => {
      if (this.user && !this._isCheckingDeposits && this.isConnected)
        this.checkPendingDeposits();
    }, 30000);
    this._reconnectTimer = setInterval(() => {
      if (!this.isConnected && this.user) this.reconnect();
    }, 5000);
    
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  },

  beforeUnmount() {
    this.stopTimer();
    this.clearGameTimer();
    if (this._newRoundTimer) clearTimeout(this._newRoundTimer);
    this._unsubGame?.();
    this._unsubUser?.();
    Object.values(this._unsubAdmin).forEach(u => u?.());
    clearInterval(this._depositCheckInterval);
    clearInterval(this._reconnectTimer);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  },

  methods: {
    // ==================== БЛОКИ РУЛЕТКИ ====================
    
    /**
     * Построение блоков рулетки
     */
    buildRouletteBlocks() {
      console.log('Building roulette blocks...');
      
      if (!this.game.players || this.game.players.length === 0) {
        console.log('No players, clearing blocks');
        this.rouletteBlocks = [];
        this.stripOffset = 0;
        return;
      }
      
      const total = this.game.totalBet || 1;
      console.log(`Total bet: ${total}, Players: ${this.game.players.length}`);
      
      const base = this.game.players.map((p, i) => {
        const width = Math.max(60, Math.round((p.bet / total) * 400));
        console.log(`Player ${p.name}: bet=${p.bet}, width=${width}`);
        
        return {
          userId: p.userId,
          emoji: p.emoji,
          shortName: p.name.split(' ')[0].slice(0, 8),
          bet: p.bet,
          color: COLORS[i % COLORS.length],
          width: width,
          isWinner: false,
        };
      });
      
      let blocks = [];
      for (let r = 0; r < TRACK_REPEAT; r++) {
        base.forEach(b => blocks.push({ ...b, _rep: r }));
      }
      
      console.log(`Created ${blocks.length} blocks`);
      this.rouletteBlocks = blocks;
      this.stripOffset = 0;
      
      // Принудительно обновляем DOM
      this.$forceUpdate();
    },

    /**
     * Очистка блоков рулетки
     */
    clearRouletteBlocks() {
      console.log('Clearing roulette blocks...');
      this.rouletteBlocks = [];
      this.stripOffset = 0;
      
      // Принудительно обновляем DOM
      this.$forceUpdate();
      this.$nextTick(() => {
        const strip = this.$refs?.rouletteStrip;
        if (strip) {
          strip.style.transform = 'translateX(0px)';
        }
      });
    },

    /**
     * Сброс всех игровых состояний
     */
    resetGameState() {
      console.log('Resetting game state...');
      this.isSpinning = false;
      this.winnerOverlay = null;
      this.stripOffset = 0;
      this.clearRouletteBlocks();
      this.stopTimer();
      this.clearGameTimer();
    },

    // ==================== УПРАВЛЕНИЕ ИГРОЙ ====================
    
    /**
     * Создание нового раунда после завершения спина
     */
    async createNewRoundAfterSpin() {
      console.log('Creating new round after spin...');
      
      // Сначала очищаем блоки
      this.clearRouletteBlocks();
      
      try {
        const gameRef = doc(db, 'config', 'currentGame');
        const gameSnap = await getDoc(gameRef);
        
        if (!gameSnap.exists()) {
          await this.createNewRound();
          return;
        }
        
        const gameData = gameSnap.data();
        
        // Если игра все еще в статусе spinning или waiting_for_players, создаем новый раунд
        if (gameData.status === 'spinning' || gameData.status === 'waiting_for_players') {
          await this.createNewRound();
        }
      } catch (e) {
        console.error('Error creating new round after spin:', e);
        this.clearRouletteBlocks();
      }
    },

    /**
     * Обработка изменения видимости страницы
     */
    handleVisibilityChange() {
      if (!document.hidden && this.user) {
        this.syncGameState();
      }
    },

    /**
     * Синхронизация состояния игры
     */
    async syncGameState() {
      try {
        const gameRef = doc(db, 'config', 'currentGame');
        const gameSnap = await getDoc(gameRef);
        
        if (!gameSnap.exists()) {
          await this.createNewRound();
          return;
        }

        const gameData = gameSnap.data();
        
        // Проверяем, не зависла ли игра
        if (gameData.status === 'spinning') {
          const spinStartTime = gameData.spinStartTime?.toMillis?.() || 0;
          if (Date.now() - spinStartTime > SPIN_DURATION + 5000) {
            console.log('Game appears stuck, creating new round');
            this.clearRouletteBlocks();
            await this.createNewRound();
          }
        } else if (gameData.status === 'waiting') {
          const endsAt = gameData.endsAt?.toMillis?.() || 0;
          if (Date.now() > endsAt + 5000) {
            console.log('Game timer expired, forcing round end');
            await this.triggerRoundEnd(true);
          }
        }
      } catch (e) {
        console.error('Error syncing game state:', e);
      }
    },

    /**
     * Очистка таймера игры
     */
    clearGameTimer() {
      if (this._gameEndTimer) {
        clearTimeout(this._gameEndTimer);
        this._gameEndTimer = null;
      }
    },

    /**
     * Запуск таймера игры
     */
    startGameTimer() {
      this.clearGameTimer();
      if (!this.game.endsAt) return;
      
      const timeUntilEnd = this.game.endsAt - Date.now();
      if (timeUntilEnd <= 0) {
        this.triggerRoundEnd();
      } else {
        this._gameEndTimer = setTimeout(() => {
          this.triggerRoundEnd();
        }, timeUntilEnd);
      }
    },

    /**
     * Подготовка нового раунда
     */
    prepareNewRound() {
      // Сохраняем статистику предыдущего раунда
      if (this.game.winner) {
        this.lastRoundStats = {
          winner: this.game.winner,
          totalBet: this.game.totalBet,
          playersCount: this.game.players.length,
          timestamp: Date.now()
        };
      }
      
      // Очищаем все состояния
      this.resetGameState();
      
      // Автоматически создаем новый раунд
      this.startNewRound();
    },

    /**
     * Принудительный запуск следующего раунда
     */
    async forceNextRound() {
      try {
        await runTransaction(db, async (t) => {
          const gameRef = doc(db, 'config', 'currentGame');
          const gameSnap = await t.get(gameRef);
          
          if (!gameSnap.exists()) return;
          
          const gameData = gameSnap.data();
          
          if (gameData.status === 'spinning' || gameData.status === 'waiting') {
            // Возвращаем ставки игрокам
            if (gameData.players && gameData.players.length > 0) {
              for (const player of gameData.players) {
                t.update(doc(db, 'users', player.userId), {
                  balance: increment(player.bet)
                });
              }
            }
            
            // Создаем новый раунд
            t.set(gameRef, {
              players: [],
              totalBet: 0,
              status: 'waiting_for_players',
              endsAt: null,
              winner: null,
              spinStartTime: null,
              spinDuration: SPIN_DURATION,
              roundId: Date.now(),
              createdAt: serverTimestamp()
            });
          }
        });
        
        // Очищаем блоки
        this.clearRouletteBlocks();
        this.showToast('🔄 Starting new round...');
      } catch (e) {
        console.error('Error forcing next round:', e);
        this.showToast('❌ Error starting new round');
      }
    },

    /**
     * Запуск нового раунда
     */
    async startNewRound() {
      if (this._isCreatingGame) return;
      
      this._isCreatingGame = true;
      
      try {
        await this.createNewRound();
        this.showToast('🎮 New round started!');
      } catch (e) {
        console.error('Error starting new round:', e);
        this.showToast('❌ Error starting new round');
      } finally {
        this._isCreatingGame = false;
      }
    },

    /**
     * Создание нового раунда в Firestore
     */
    async createNewRound() {
      console.log('Creating new round...');
      
      try {
        const gameRef = doc(db, 'config', 'currentGame');
        const newRoundId = Date.now();
        
        await setDoc(gameRef, {
          players: [],
          totalBet: 0,
          status: 'waiting_for_players',
          endsAt: null,
          winner: null,
          spinStartTime: null,
          spinDuration: SPIN_DURATION,
          roundId: newRoundId,
          createdAt: serverTimestamp()
        });
        
        console.log(`✅ New round created with ID: ${newRoundId}`);
        
        // Обновляем локальное состояние и очищаем блоки
        this.game = {
          ...this.game,
          players: [],
          totalBet: 0,
          status: 'waiting_for_players',
          endsAt: null,
          winner: null,
          roundId: newRoundId
        };
        
        // Очищаем блоки
        this.clearRouletteBlocks();
        
      } catch (e) {
        console.error('Error creating new round:', e);
        throw e;
      }
    },

    /**
     * Сохранение завершенной игры в архив
     */
    async archiveCompletedGame(gameData, winner) {
      if (!gameData || !winner) return;
      
      try {
        await addDoc(collection(db, 'games'), {
          roundId: gameData.roundId,
          players: gameData.players,
          totalBet: gameData.totalBet,
          winner: winner,
          prize: winner.prize,
          commission: gameData.totalBet * HOUSE_FEE,
          timestamp: serverTimestamp(),
          endsAt: gameData.endsAt
        });
        
        console.log('✅ Game archived successfully');
      } catch (e) {
        console.error('Error archiving game:', e);
      }
    },

    // ==================== TON CENTER API METHODS ====================
    
    async fetchTonCenterTransactions(limit = 50) {
      if (!this.depositAddress) return [];
      
      try {
        const payload = {
          id: 1,
          jsonrpc: "2.0",
          method: "getTransactions",
          params: {
            address: this.depositAddress,
            limit: limit
          }
        };

        const headers = {
          'Content-Type': 'application/json',
          'X-API-Key': TONCENTER_API_KEY
        };

        const response = await fetch(TONCENTER_API_URL, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.error) {
          console.error('TON Center API error:', data.error);
          return [];
        }

        const transactions = data.result || [];
        
        const parsedTxs = transactions.map(tx => {
          const inMsg = tx.in_msg || {};
          let amount = 0;
          let comment = '';
          let hash = tx.transaction_id?.hash || tx.hash || '';
          let from = '';
          let timestamp = tx.utime || Math.floor(Date.now() / 1000);
          
          if (inMsg && inMsg.value) {
            amount = parseInt(inMsg.value) / 1e9;
            
            if (inMsg.msg_data) {
              if (inMsg.msg_data['@type'] === 'msg.dataText') {
                const textBase64 = inMsg.msg_data.text || '';
                if (textBase64) {
                  try {
                    const decoded = atob(textBase64.replace(/^base64:/, ''));
                    comment = decoded.replace(/\0/g, '');
                  } catch (e) {
                    console.warn('Failed to decode comment:', e);
                  }
                }
              } else if (inMsg.msg_data.text) {
                comment = inMsg.msg_data.text;
              }
            }
            
            from = inMsg.source || '';
          }
          
          return {
            hash,
            amount,
            comment: comment.trim(),
            from,
            timestamp,
            lt: tx.transaction_id?.lt || tx.lt || 0,
          };
        }).filter(tx => tx.amount > 0);
        
        return parsedTxs;
        
      } catch (error) {
        console.error('Error fetching from TON Center:', error);
        return [];
      }
    },

    async checkPendingDeposits() {
      if (!this.user || this._isCheckingDeposits) return;
      
      this._isCheckingDeposits = true;
      
      try {
        const q = query(
          collection(db, 'deposit_requests'),
          where('userId', '==', this.user.id),
          where('status', '==', 'pending'),
          orderBy('ts', 'desc'),
          limit(10)
        );
        
        const snap = await getDocs(q);
        
        if (snap.empty) {
          this._isCheckingDeposits = false;
          return;
        }

        const transactions = await this.fetchTonCenterTransactions(30);
        
        if (!transactions || transactions.length === 0) {
          this._isCheckingDeposits = false;
          return;
        }

        for (const depositDoc of snap.docs) {
          const deposit = depositDoc.data();
          
          if (this._lastCheckedTx[depositDoc.id] && 
              Date.now() - this._lastCheckedTx[depositDoc.id] < 60000) {
            continue;
          }

          for (const tx of transactions) {
            if (!tx.comment) continue;
            
            const txComment = tx.comment.replace(/\0/g, '').trim();
            const depositComment = deposit.comment.replace(/\0/g, '').trim();
            
            if (txComment.includes(depositComment) || depositComment.includes(txComment)) {
              if (Math.abs(tx.amount - deposit.amount) < 0.01) {
                await this.processDeposit(depositDoc.ref, deposit, tx);
                this._lastCheckedTx[depositDoc.id] = Date.now();
                break;
              }
            }
          }
          
          if (deposit.ts && (Date.now() - (deposit.ts.toDate?.() || deposit.ts)) > 24 * 60 * 60 * 1000) {
            await updateDoc(depositDoc.ref, { 
              status: 'expired',
              expiredAt: serverTimestamp()
            });
          }
        }
        
      } catch (error) {
        console.error('Error checking pending deposits:', error);
      } finally {
        this._isCheckingDeposits = false;
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

          if (deposit.status === 'completed') {
            return;
          }

          transaction.update(userRef, { 
            balance: increment(deposit.amount) 
          });

          transaction.update(docRef, { 
            status: 'completed',
            txHash: tx.hash,
            txFrom: tx.from,
            txTime: tx.timestamp,
            completedAt: serverTimestamp()
          });

          const statsRef = doc(db, 'config', 'stats');
          transaction.set(statsRef, {
            totalDeposits: increment(deposit.amount),
            totalTransactions: increment(1)
          }, { merge: true });
        });

        await addDoc(collection(db, 'users', deposit.userId, 'history'), {
          type: 'deposit',
          amount: deposit.amount,
          txHash: tx.hash,
          description: `Deposit of ${deposit.amount} TON`,
          ts: serverTimestamp()
        });

        this.showToast(`✅ +${this.fmt(deposit.amount)} TON deposited!`);
        
        if (this.user?.id === deposit.userId && this.modal === 'deposit') {
          this.depositStatus = '✅ Confirmed!';
          this.depositDone = true;
          setTimeout(() => this.closeModal(), 2000);
        }

      } catch (error) {
        console.error('Error processing deposit:', error);
        this.showToast('❌ Error processing deposit');
      }
    },

    async manualCheckDeposit() {
      this.depositLoading = true;
      this.depositStatus = '🔍 Checking blockchain...';
      
      try {
        await this.checkPendingDeposits();
        
        const q = query(
          collection(db, 'deposit_requests'),
          where('userId', '==', this.user.id),
          where('comment', '==', this.currentDepComment),
          limit(1)
        );
        
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          const deposit = snap.docs[0].data();
          if (deposit.status === 'completed') {
            this.depositStatus = '✅ Confirmed!';
            this.depositDone = true;
          } else {
            this.depositStatus = '⏳ Still waiting for confirmation...';
          }
        } else {
          this.depositStatus = '❌ Deposit request not found';
        }
        
      } catch (error) {
        console.error('Error in manual check:', error);
        this.depositStatus = '❌ Check failed';
      } finally {
        this.depositLoading = false;
      }
    },

    // ==================== ИНИЦИАЛИЗАЦИЯ ====================
    
    async ensureGameExists() {
      if (this._isCreatingGame) return;
      
      this._isCreatingGame = true;
      try {
        const gameRef = doc(db, 'config', 'currentGame');
        const gameSnap = await getDoc(gameRef);
        
        if (!gameSnap.exists()) {
          console.log('No active game found, creating new game...');
          await this.createNewRound();
          this.showToast('🎮 New game created!');
        } else {
          const gameData = gameSnap.data();
          
          // Проверяем, не зависла ли игра
          if (gameData.status === 'spinning') {
            const spinStartTime = gameData.spinStartTime?.toMillis?.() || 0;
            if (Date.now() - spinStartTime > SPIN_DURATION + 5000) {
              console.log('Found stuck game, resetting...');
              this.clearRouletteBlocks();
              await this.createNewRound();
            }
          }
        }
      } catch (e) {
        console.error('Error ensuring game exists:', e);
      } finally {
        this._isCreatingGame = false;
      }
    },

    getRefFromStartParam() {
      try {
        const params = new URLSearchParams(window.location.search);
        const start = params.get('start');
        if (start && start.startsWith('ref_')) {
          return start.replace('ref_', '');
        }
        return null;
      } catch {
        return null;
      }
    },

    async processReferral(newUserId, referrerId) {
      if (!referrerId || referrerId === newUserId) return;

      try {
        await runTransaction(db, async (transaction) => {
          const referrerRef = doc(db, 'users', referrerId);
          const referrerSnap = await transaction.get(referrerRef);

          if (!referrerSnap.exists()) return;

          transaction.update(referrerRef, {
            balance: increment(REFERRAL_BONUS),
            'stats.referrals': increment(1),
            'stats.referralEarned': increment(REFERRAL_BONUS)
          });

          const referralHistoryRef = doc(collection(db, 'users', referrerId, 'referrals'));
          transaction.set(referralHistoryRef, {
            userId: newUserId,
            bonus: REFERRAL_BONUS,
            ts: serverTimestamp()
          });

          const newUserRef = doc(db, 'users', newUserId);
          transaction.update(newUserRef, {
            referredBy: referrerId
          });
        });

        await addDoc(collection(db, 'users', referrerId, 'history'), {
          type: 'referral_bonus',
          amount: REFERRAL_BONUS,
          description: 'Referral bonus',
          ts: serverTimestamp()
        });

        console.log(`✅ Referral bonus ${REFERRAL_BONUS} TON sent to ${referrerId}`);
      } catch (e) {
        console.error('Error processing referral:', e);
      }
    },

    // ── BLOCK ROULETTE ──
    startBlockSpin(winnerData) {
      if (!this.game.players.length || !winnerData) return;
      const total = this.game.totalBet || 1;
      const viewportCenter = 150;

      const winIdx = this.game.players.findIndex(p => p.userId === winnerData.userId);
      if (winIdx < 0) return;

      const widths = this.game.players.map(p => Math.max(60, Math.round((p.bet / total) * 400)));
      const totalTrackWidth = widths.reduce((s, w) => s + w, 0);

      let offsetToWinner = 0;
      for (let i = 0; i < winIdx; i++) offsetToWinner += widths[i];
      offsetToWinner += widths[winIdx] / 2;

      const targetOffset = -(totalTrackWidth * 2 + offsetToWinner - viewportCenter);

      this.rouletteBlocks.forEach(b => {
        b.isWinner = b.userId === winnerData.userId;
      });

      this.$nextTick(() => {
        this.stripOffset = targetOffset;
      });

      setTimeout(() => {
        this.showWinnerOverlay(winnerData);
      }, SPIN_DURATION);
    },

    // ── RECONNECT ──
    reconnect() {
      if (this.user) { 
        this.subscribeGame(); 
        this._unsubUser?.(); 
        this.listenToUser(); 
        this.ensureGameExists();
      }
    },

    // ── AUTH ──
    tryTelegram() {
      const tg = window.Telegram?.WebApp;
      if (tg?.initDataUnsafe?.user) {
        tg.ready(); tg.expand();
        const u = tg.initDataUnsafe.user;
        this.doLogin({ id:String(u.id), name:u.first_name+(u.last_name?' '+u.last_name:''), handle:u.username||String(u.id) });
      } else { this.quickLogin(); }
    },

    quickLogin() {
      const id = Date.now() % 100000;
      this.doLogin({ id:String(id), name:`Player${id}`, handle:`p${id}` });
    },

    async doLogin(ud) {
      ud.emoji = EMOJIS[randInt(EMOJIS.length)];
      this.user = ud;

      const referrerId = this.getRefFromStartParam();

      try {
        const ref = doc(db, 'users', ud.id);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          await runTransaction(db, async (t) => {
            t.set(ref, {
              name:ud.name,
              handle:ud.handle,
              emoji:ud.emoji,
              balance:100,
              stats:{
                played:0,
                won:0,
                earned:0,
                referrals:0,
                referralEarned:0
              },
              referredBy: referrerId,
              createdAt: serverTimestamp()
            });
            t.set(doc(db, 'config', 'stats'), {totalUsers:increment(1)}, {merge:true});
          });

          if (referrerId) {
            await this.processReferral(ud.id, referrerId);
          }
        } else {
          await updateDoc(ref, {lastSeen:serverTimestamp()});
          if (snap.data().emoji) this.user.emoji = snap.data().emoji;
        }
        
        this.listenToUser();
        await this.loadHistory();
        
        await this.ensureGameExists();
        this.subscribeGame();
        
        this.isConnected = true;
      } catch(e) {
        console.error(e);
        this.balance = 100; 
        this.isConnected = false;
        this.showToast('Could not connect.');
      }
    },

    listenToUser() {
      if (!this.user) return;
      this._unsubUser = onSnapshot(doc(db, 'users', this.user.id), (snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        this.balance = d.balance || 0;
        this.stats = d.stats || {played:0,won:0,earned:0, referrals:0, referralEarned:0};
      });
    },

    // ── GAME ──
    subscribeGame() {
      const gameRef = doc(db, 'config', 'currentGame');
      let prev = '';
      let processing = false;
      
      this._unsubGame = onSnapshot(gameRef, async (snap) => {
        if (processing) return;
        processing = true;
        
        try {
          this.isConnected = true;
          
          if (!snap.exists()) {
            console.log('Game snapshot: game does not exist');
            this.game = {
              id: null,
              players: [],
              totalBet: 0,
              status: 'waiting_for_players',
              endsAt: null,
              winner: null,
              roundId: null
            };
            
            this.clearRouletteBlocks();
            await this.createNewRound();
            return;
          }
          
          const d = snap.data();
          const ng = {
            id:snap.id, 
            players:d.players||[], 
            totalBet:d.totalBet||0,
            status:d.status, 
            endsAt:d.endsAt?.toMillis?.()||null,
            spinStartTime:d.spinStartTime?.toMillis?.()||null,
            spinDuration:d.spinDuration||SPIN_DURATION,
            winner:d.winner||null, 
            roundId:d.roundId||Date.now()
          };

          // Всегда перестраиваем блоки при изменении игроков
          if (JSON.stringify(ng.players) !== JSON.stringify(this.game.players)) {
            console.log('Players changed, rebuilding blocks...');
            this.$nextTick(() => {
              this.buildRouletteBlocks();
            });
          }

          if (ng.status === 'spinning' && prev !== 'spinning') {
            this.isSpinning = true;
            this.stopTimer();
            this.clearGameTimer();
            this.game = ng;
            this.$nextTick(() => {
              this.buildRouletteBlocks();
              this.startBlockSpin(ng.winner);
            });
            
            if (ng.winner) {
              await this.archiveCompletedGame(ng, ng.winner);
            }
            
          } else if (ng.status === 'waiting' && prev !== 'waiting') {
            this.isSpinning = false;
            this.winnerOverlay = null;
            this.game = ng;
            this.startClientTimer();
            this.$nextTick(() => {
              this.buildRouletteBlocks();
            });
            
          } else if (ng.status === 'waiting_for_players' && prev !== 'waiting_for_players') {
            this.isSpinning = false;
            this.winnerOverlay = null;
            this.timeLeft = ROUND_TIME;
            this.stopTimer();
            this.clearGameTimer();
            this.stripOffset = 0;
            this.game = ng;
            this.clearRouletteBlocks();
          }

          if (ng.winner && ng.status !== 'spinning' && !this.winnerOverlay) {
            this.showWinnerOverlay(ng.winner);
          }

          this.game = ng;
          prev = ng.status;
          
        } catch (e) {
          console.error('Error processing game snapshot:', e);
        } finally {
          processing = false;
        }
        
      }, (err) => {
        console.error('Game snapshot error:', err);
        this.isConnected = false;
        this._retryCount++;
        
        if (this._retryCount < MAX_RETRIES) {
          setTimeout(() => {
            this.subscribeGame();
          }, RETRY_DELAY * this._retryCount);
        }
      });
    },

    startClientTimer() {
      this.stopTimer();
      this.timerHandle = setInterval(() => {
        if (this.isSpinning || this.game.status !== 'waiting' || !this.game.endsAt) return;
        this.timeLeft = Math.max(0, Math.round((this.game.endsAt - Date.now()) / 1000));
        if (this.timeLeft <= 0 && !this.isSpinning) { 
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

    async triggerRoundEnd(force=false) {
      if (this.isSpinning) return;
      
      try {
        await runTransaction(db, async (t) => {
          const ref = doc(db, 'config', 'currentGame');
          const gameSnap = await t.get(ref);
          
          if (!gameSnap.exists()) return;
          
          const gameData = gameSnap.data();
          
          if (gameData.status === 'waiting' && (force || Date.now() >= (gameData.endsAt?.toMillis?.() || 0))) {
            
            // Если недостаточно игроков - возвращаем ставки
            if (!gameData.players || gameData.players.length < MIN_PLAYERS) {
              for (const player of gameData.players) {
                t.update(doc(db, 'users', player.userId), {
                  balance: increment(player.bet)
                });
              }
              
              // Создаем новый раунд
              t.set(ref, {
                players: [],
                totalBet: 0,
                status: 'waiting_for_players',
                endsAt: null,
                winner: null,
                spinStartTime: null,
                spinDuration: SPIN_DURATION,
                roundId: Date.now(),
                createdAt: serverTimestamp()
              });
              
              this.showToast('Not enough players. Bets refunded. New round started.');
              
            } else {
              // Выбираем победителя
              const winner = weightedRandom(gameData.players);
              const prize = gameData.totalBet * (1 - HOUSE_FEE);
              const commission = gameData.totalBet * HOUSE_FEE;

              // Начисляем приз победителю
              t.update(doc(db, 'users', winner.userId), {
                balance: increment(prize),
                'stats.won': increment(1),
                'stats.earned': increment(prize)
              });

              // Обновляем статистику для всех игроков
              for (const player of gameData.players) {
                t.update(doc(db, 'users', player.userId), {
                  'stats.played': increment(1)
                });
              }

              // Начисляем комиссию админу
              const adminQuery = query(collection(db, 'users'), where('handle', '==', ADMIN_HANDLE));
              const adminSnap = await getDocs(adminQuery);
              if (!adminSnap.empty) {
                const adminRef = adminSnap.docs[0].ref;
                t.update(adminRef, {
                  balance: increment(commission),
                  'stats.earned': increment(commission)
                });
              }

              // Обновляем статус игры на spinning
              t.update(ref, {
                status: 'spinning',
                winner: {
                  userId: winner.userId,
                  name: winner.name,
                  prize: prize
                },
                spinStartTime: serverTimestamp(),
                spinDuration: SPIN_DURATION
              });
            }
          }
        });
        
      } catch (e) {
        console.error('Error in triggerRoundEnd:', e);
        this.showToast('❌ Error ending round');
      }
    },

    showWinnerOverlay(w) {
      if (!w) return;
      const isMe = w.userId === this.user?.id;
      const myBet = this.game.players?.find(p => p.userId === this.user?.id);
      
      this.winnerOverlay = { 
        name: w.name, 
        prize: w.prize, 
        isMe, 
        myLoss: myBet && !isMe ? myBet.bet : 0 
      };
      
      this.isSpinning = false;
      
      setTimeout(() => {
        if (this.winnerOverlay) {
          this.dismissWinner();
        }
      }, 6000);
    },

    dismissWinner() { 
      this.winnerOverlay = null; 
    },

    // ── BETTING ──
    adjustBet(d) {
      let v = Math.round((this.betAmount + d) * 10) / 10;
      this.betAmount = Math.max(0.1, Math.min(this.balance, v));
    },

    async placeBet() {
      if (!this.canBet) return;
      
      await this.ensureGameExists();
      
      this.betLoading = true; 
      this.betError = '';
      
      try {
        await runTransaction(db, async (t) => {
          const gameRef = doc(db, 'config', 'currentGame');
          const userRef = doc(db, 'users', this.user.id);
          
          const gameSnap = await t.get(gameRef);
          if (!gameSnap.exists()) {
            t.set(gameRef, {
              players: [], 
              totalBet: 0, 
              status: 'waiting_for_players',
              endsAt: null, 
              winner: null, 
              spinStartTime: null,
              spinDuration: SPIN_DURATION, 
              roundId: Date.now(), 
              createdAt: serverTimestamp()
            });
          }
          
          const gameData = gameSnap.exists() ? gameSnap.data() : { 
            players: [], 
            totalBet: 0, 
            status: 'waiting_for_players' 
          };
          
          const userSnap = await t.get(userRef);
          const userBalance = userSnap.data().balance || 0;
          
          if (userBalance < this.betAmount) throw new Error('Insufficient balance');
          if (gameData.status === 'spinning') throw new Error('Round is spinning');
          if (gameData.players?.some(p => p.userId === this.user.id)) throw new Error('Already bet');
          
          t.update(userRef, { balance: increment(-this.betAmount) });
          
          const players = [...(gameData.players || []), {
            userId: this.user.id, 
            name: this.user.name, 
            emoji: this.user.emoji, 
            bet: this.betAmount
          }];
          
          const updates = { 
            players, 
            totalBet: (gameData.totalBet || 0) + this.betAmount 
          };
          
          if (gameData.status === 'waiting_for_players') { 
            updates.status = 'waiting'; 
            updates.endsAt = new Date(Date.now() + ROUND_TIME * 1000); 
          }
          
          t.update(gameRef, updates);
        });
        
        this.showToast(`✅ Bet: ${this.fmt(this.betAmount)} TON`);
        
        // Принудительно перестраиваем блоки после ставки
        this.$nextTick(() => {
          this.buildRouletteBlocks();
        });
        
      } catch(e) {
        this.betError = e.message;
        setTimeout(() => { this.betError = ''; }, 3500);
      } finally { 
        this.betLoading = false; 
      }
    },

    // ── UTILS ──
    getTimerWidth() {
      if (this.isSpinning || this.game.status === 'waiting_for_players') return '0%';
      return `${(this.timeLeft / ROUND_TIME) * 100}%`;
    },

    playerChance(p) { 
      return ((p.bet / (this.game.totalBet || 1)) * 100).toFixed(1); 
    },
    
    fmt(n) { 
      return (n || 0).toFixed(2); 
    },
    
    formatTime(ts) {
      if (!ts) return '';
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    },
    
    showToast(m) {
      this.toastMsg = m; 
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => { this.toastMsg = ''; }, 3000);
    },
    
    getTg() { 
      return window.Telegram?.WebApp; 
    },

    // ── MODALS ──
    openModal(t) {
      this.modal = t;
      if (t === 'deposit') {
        this.depositStep = 1;
        this.depositAmt = 10;
        this.depositDone = false;
        this.depositLoading = false;
        this.depositStatus = 'Waiting for transaction...';
        this.currentDepComment = `dep_${this.user?.id}_${Date.now()}`.slice(0, 30);
      } else if (t === 'withdraw') {
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
      window.open(`ton://transfer/${HOUSE_WALLET}?amount=${nano}&text=${encodeURIComponent(this.currentDepComment)}`, '_blank');
    },
    
    openTonkeeper() {
      const nano = Math.round(this.depositAmt * 1e9);
      window.open(`tonkeeper://transfer/${HOUSE_WALLET}?amount=${nano}&text=${encodeURIComponent(this.currentDepComment)}`, '_blank');
    },
    
    async copyText(t) {
      try { 
        await navigator.clipboard.writeText(t); 
        this.showToast('Copied!'); 
      } catch { 
        this.showToast('Copy failed'); 
      }
    },
    
    async submitDepositRequest() {
      this.depositLoading = true;
      try {
        const q = query(
          collection(db, 'deposit_requests'),
          where('userId', '==', this.user.id),
          where('comment', '==', this.currentDepComment),
          limit(1)
        );
        
        const existing = await getDocs(q);
        
        if (existing.empty) {
          await addDoc(collection(db, 'deposit_requests'), {
            userId: this.user.id,
            userName: this.user.name,
            userHandle: this.user.handle,
            amount: this.depositAmt,
            comment: this.currentDepComment,
            status: 'pending',
            ts: serverTimestamp()
          });
        }
        
        this.depositStep = 2;
        this.depositLoading = false;
        this.depositStatus = '⏳ Waiting for blockchain confirmation...';
        
        setTimeout(() => this.manualCheckDeposit(), 5000);
        
      } catch(e) { 
        this.showToast('Error: ' + e.message); 
        this.depositLoading = false;
      }
    },
    
    async submitWithdrawRequest() {
      if (!this.canWithdraw) return;
      this.withdrawLoading = true;
      try {
        await runTransaction(db, async (t) => {
          const uRef = doc(db, 'users', this.user.id);
          const uSnap = await t.get(uRef);
          if (!uSnap.exists()) throw new Error('User not found');
          if (uSnap.data().balance < this.withdrawAmt) throw new Error('Insufficient balance');
          t.update(uRef, { balance: increment(-this.withdrawAmt) });
          t.set(doc(collection(db, 'withdraw_requests')), {
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
        setTimeout(() => this.closeModal(), 2000);
      } catch(e) { 
        this.showToast('Error: ' + e.message); 
      } finally { 
        this.withdrawLoading = false; 
      }
    },

    // ── PROFILE ──
    async loadHistory() {
      try {
        const q = query(
          collection(db, 'users', this.user.id, 'history'), 
          orderBy('ts', 'desc'), 
          limit(20)
        );
        const s = await getDocs(q);
        this.history = s.docs.map(d => ({
          id: d.id, 
          ...d.data(), 
          ts: d.data().ts?.toMillis?.() || Date.now()
        }));
      } catch(e) { 
        console.warn(e); 
      }
    },
    
    async copyRef() {
      try { 
        await navigator.clipboard.writeText(this.referralLink); 
        this.copied = true; 
        setTimeout(() => { this.copied = false; }, 2000); 
        this.showToast('Copied!'); 
      } catch {}
    },

    // ── ADMIN ──
    switchAdmin() { 
      this.tab = 'admin'; 
      this.subscribeAdmin(); 
    },
    
    async subscribeAdmin() {
      Object.values(this._unsubAdmin).forEach(u => u?.());
      
      try {
        const uSnap = await getDocs(query(
          collection(db, 'users'), 
          orderBy('balance', 'desc'), 
          limit(50)
        ));
        
        this.adminData.users = uSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        this.adminData.totalUsers = this.adminData.users.length;

        const gSnap = await getDocs(collection(db, 'games'));
        let vol = 0;
        gSnap.forEach(d => { vol += d.data().totalBet || 0; });
        this.adminData.totalGames = gSnap.size;
        this.adminData.totalVolume = vol;
        this.adminData.commissionEarned = vol * HOUSE_FEE;

        let hb = 0;
        let adminBal = 0;
        uSnap.docs.forEach(d => {
          const x = d.data();
          hb += (x.balance || 0) + (x.lockedBalance || 0);
          if (x.handle === ADMIN_HANDLE) adminBal = x.balance || 0;
        });
        this.adminData.houseBalance = hb;
        this.adminData.adminBalance = adminBal;

      } catch(e) {
        console.error(e);
      }
      
      this._unsubAdmin.w = onSnapshot(
        query(
          collection(db, 'withdraw_requests'), 
          where('status', '==', 'pending'), 
          orderBy('ts', 'desc')
        ), 
        s => {
          this.adminData.withdraws = s.docs.map(d => ({
            id: d.id,
            ...d.data(),
            processing: false,
            ts: d.data().ts?.toMillis?.() || Date.now()
          }));
      });
      
      this._unsubAdmin.d = onSnapshot(
        query(
          collection(db, 'deposit_requests'), 
          orderBy('ts', 'desc'), 
          limit(20)
        ), 
        s => {
          this.adminData.deposits = s.docs.map(d => ({
            id: d.id,
            ...d.data(),
            ts: d.data().ts?.toMillis?.() || Date.now()
          }));
      });
    },
    
    async approveWithdraw(r) {
      r.processing = true;
      try {
        const b = writeBatch(db);
        b.update(doc(db, 'withdraw_requests', r.id), {
          status: 'approved',
          approvedAt: serverTimestamp(),
          processedBy: this.user.id
        });
        b.update(doc(db, 'users', r.userId), { 
          balance: increment(-r.amount) 
        });
        await b.commit();
        
        await addDoc(collection(db, 'users', r.userId, 'history'), {
          type: 'withdraw',
          amount: -r.amount,
          ts: serverTimestamp()
        });
        
        this.showToast(`✓ Approved ${r.amount} TON for ${r.userName}`);
      } catch(e) {
        this.showToast('Error: ' + e.message);
      } finally {
        r.processing = false;
      }
    },
    
    async rejectWithdraw(r) {
      r.processing = true;
      try {
        const b = writeBatch(db);
        b.update(doc(db, 'users', r.userId), {
          balance: increment(r.amount)
        });
        b.update(doc(db, 'withdraw_requests', r.id), {
          status: 'rejected',
          rejectedAt: serverTimestamp()
        });
        await b.commit();
        this.showToast('Rejected, funds returned');
      } catch(e) {
        this.showToast('Error: ' + e.message);
      } finally {
        r.processing = false;
      }
    },
    
    async adminAddBalance(u, a) {
      try { 
        await updateDoc(doc(db, 'users', u.id), { balance: increment(a) }); 
        this.showToast(`+${a} TON → ${u.name}`); 
      } catch(e) {
        this.showToast('Error: ' + e.message);
      }
    },
    
    adminSetBalance(u) {
      const v = prompt(`Balance for ${u.name} (now: ${u.balance}):`);
      if (!v || isNaN(parseFloat(v))) return;
      updateDoc(doc(db, 'users', u.id), { balance: parseFloat(v) })
        .then(() => this.showToast('Done'))
        .catch(e => this.showToast('Error: ' + e.message));
    },
  },
};
</script>

<style>
/* ═══════════════════════════════════════
   FONTS & ROOT
═══════════════════════════════════════ */
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:       #08080f;
  --bg2:      #0f0f1a;
  --bg3:      #151525;
  --border:   #ffffff0f;
  --border2:  #ffffff18;
  --text:     #e8e8f0;
  --text2:    #8888aa;
  --gold:     #f5c842;
  --gold2:    #ffd97d;
  --green:    #2ecc71;
  --red:      #e74c3c;
  --blue:     #3498db;
  --accent:   #7c5cff;
  --accent2:  #a07cff;
  --radius:   14px;
  --r-sm:     8px;
  --shadow:   0 8px 32px #0007;
}

html, body { height: 100%; background: var(--bg); color: var(--text); font-family: 'Syne', sans-serif; overflow-x: hidden; }

/* ═══════════════════════════════════════
   SPLASH
═══════════════════════════════════════ */
.splash { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.splash-bg { position: absolute; inset: 0; }
.splash-grid {
  position: absolute; inset: 0;
  background-image: linear-gradient(#ffffff08 1px, transparent 1px), linear-gradient(90deg, #ffffff08 1px, transparent 1px);
  background-size: 40px 40px;
}
.splash-orb {
  position: absolute; border-radius: 50%; filter: blur(80px); animation: orbFloat 6s ease-in-out infinite;
}
.splash-orb--1 { width: 400px; height: 400px; background: radial-gradient(#7c5cff55, transparent); top: -100px; right: -100px; }
.splash-orb--2 { width: 300px; height: 300px; background: radial-gradient(#f5c84255, transparent); bottom: -50px; left: -50px; animation-delay: -3s; }
@keyframes orbFloat { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-20px) scale(1.05); } }

.splash-content { position: relative; text-align: center; z-index: 1; }
.splash-logo { display: flex; flex-direction: column; align-items: center; margin-bottom: 20px; }
.logo-icon {
  width: 80px; height: 80px; border-radius: 24px;
  background: linear-gradient(135deg, #7c5cff, #f5c842);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 16px;
  box-shadow: 0 0 40px #7c5cff55, 0 0 80px #f5c84222;
  animation: logoPulse 2s ease-in-out infinite;
}
@keyframes logoPulse { 0%,100% { box-shadow: 0 0 40px #7c5cff55, 0 0 80px #f5c84222; } 50% { box-shadow: 0 0 60px #7c5cff88, 0 0 100px #f5c84244; } }
.logo-diamond { font-size: 36px; color: #fff; }
.splash-title { font-size: 48px; font-weight: 800; line-height: 1; letter-spacing: -2px; color: #fff; }
.splash-title--accent { color: var(--gold); }
.splash-sub { font-size: 14px; color: var(--text2); letter-spacing: 4px; text-transform: uppercase; margin-bottom: 40px; font-weight: 600; }
.splash-btn {
  position: relative; padding: 16px 48px; font-size: 16px; font-weight: 700;
  background: linear-gradient(135deg, var(--accent), #5c3cdd);
  color: #fff; border: none; border-radius: 50px; cursor: pointer;
  overflow: hidden; letter-spacing: 1px;
  box-shadow: 0 4px 30px #7c5cff55;
  transition: transform 0.2s, box-shadow 0.2s;
  font-family: 'Syne', sans-serif;
}
.splash-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 40px #7c5cff77; }
.btn-shine {
  position: absolute; top: 0; left: -100%; width: 60%; height: 100%;
  background: linear-gradient(90deg, transparent, #ffffff30, transparent);
  animation: shine 2.5s ease-in-out infinite;
}
@keyframes shine { 0% { left: -100%; } 60%,100% { left: 150%; } }

/* ═══════════════════════════════════════
   MAIN APP
═══════════════════════════════════════ */
.app { min-height: 100vh; }
.main { min-height: 100vh; display: flex; flex-direction: column; max-width: 480px; margin: 0 auto; }

/* ── HEADER ── */
.hdr {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; background: var(--bg2);
  border-bottom: 1px solid var(--border);
  position: sticky; top: 0; z-index: 50;
  backdrop-filter: blur(12px);
}
.hdr-user { display: flex; align-items: center; gap: 10px; }
.hdr-avatar {
  width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--accent), var(--gold));
  display: flex; align-items: center; justify-content: center; font-size: 20px;
}
.hdr-name { font-weight: 700; font-size: 15px; }
.hdr-handle { color: var(--text2); font-size: 12px; font-family: 'JetBrains Mono', monospace; }
.hdr-balance {
  display: flex; align-items: center; gap: 8px;
  background: var(--bg3); border: 1px solid var(--border2);
  border-radius: 50px; padding: 6px 6px 6px 14px; cursor: pointer;
  transition: border-color 0.2s;
}
.hdr-balance:hover { border-color: var(--gold); }
.hdr-bal-inner { display: flex; align-items: baseline; gap: 4px; }
.hdr-bal-num { font-weight: 700; font-size: 15px; color: var(--gold); font-family: 'JetBrains Mono', monospace; }
.hdr-bal-cur { font-size: 11px; color: var(--text2); font-weight: 600; }
.hdr-bal-add {
  width: 28px; height: 28px; border-radius: 50%; background: var(--accent);
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; color: #fff; font-weight: 700; line-height: 1;
}

/* ── NAV ── */
.nav {
  display: flex; background: var(--bg2); border-bottom: 1px solid var(--border);
  padding: 0 16px; position: relative;
}
.nav-btn {
  flex: 1; padding: 12px 8px; background: none; border: none; cursor: pointer;
  color: var(--text2); font-size: 13px; font-weight: 600;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  transition: color 0.2s; font-family: 'Syne', sans-serif;
  position: relative;
}
.nav-btn.active { color: var(--text); }
.nav-btn.active::after {
  content: ''; position: absolute; bottom: 0; left: 20%; right: 20%; height: 2px;
  background: linear-gradient(90deg, var(--accent), var(--gold));
  border-radius: 2px 2px 0 0;
}
.nav-icon { font-size: 14px; }

/* ── CONNECTION ── */
.conn-banner {
  background: #e74c3c20; border-bottom: 1px solid #e74c3c40;
  color: var(--red); padding: 8px 16px; font-size: 12px;
  display: flex; align-items: center; gap: 8px;
}
.conn-pulse {
  width: 8px; height: 8px; border-radius: 50%; background: var(--red);
  animation: pulse 1s ease-in-out infinite;
}
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }

/* ── TABS ── */
.tab { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 14px; }

/* ── STATS ROW ── */
.stats-row { display: grid; grid-template-columns: 1fr 1.5fr 1fr; gap: 8px; }
.stat-box {
  background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 14px 10px; text-align: center; display: flex; flex-direction: column; gap: 4px;
}
.stat-box--main {
  background: linear-gradient(135deg, #1a1a2a, #1f1f35);
  border-color: #f5c84230;
}
.stat-val { font-size: 22px; font-weight: 800; font-family: 'JetBrains Mono', monospace; }
.stat-val.gold { color: var(--gold); }
.stat-val.danger { color: var(--red); animation: blink 0.5s ease-in-out infinite; }
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.5} }
.stat-lbl { font-size: 11px; color: var(--text2); text-transform: uppercase; letter-spacing: 0.5px; }

/* ── TIMER ── */
.timer-track {
  height: 4px; background: var(--bg3); border-radius: 4px; overflow: hidden;
}
.timer-fill {
  height: 100%; background: linear-gradient(90deg, var(--accent), var(--gold));
  border-radius: 4px;
}
.timer-fill.danger { background: linear-gradient(90deg, #c0392b, var(--red)); }

/* ─────────────────────────────────────
   BLOCK ROULETTE
───────────────────────────────────── */
.roulette-section {
  background: var(--bg2); border: 1px solid var(--border2);
  border-radius: var(--radius); overflow: hidden;
}
.roulette-label {
  padding: 10px 16px; font-size: 12px; color: var(--text2);
  text-transform: uppercase; letter-spacing: 1px; font-weight: 600;
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 8px;
}
.spinning-text {
  background: linear-gradient(90deg, var(--accent), var(--gold));
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
  animation: textShimmer 1s ease-in-out infinite;
}
@keyframes textShimmer { 0%,100%{opacity:1} 50%{opacity:0.7} }

.roulette-viewport {
  position: relative; height: 100px; overflow: hidden;
  background: linear-gradient(180deg, #0a0a14, #0f0f1e);
}
.roulette-track {
  display: flex; align-items: center; height: 100%;
  will-change: transform;
}
.roulette-block {
  flex-shrink: 0; height: 80px; border-radius: 10px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 2px; margin: 0 3px; min-width: 60px;
  border: 1px solid #ffffff15;
  transition: box-shadow 0.3s;
}
.roulette-block--winner {
  box-shadow: 0 0 20px currentColor, 0 0 40px currentColor;
  border-color: #ffffff55;
  animation: winnerPulse 0.4s ease-in-out infinite;
}
@keyframes winnerPulse { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(1.05)} }
.block-emoji { font-size: 20px; }
.block-name { font-size: 9px; font-weight: 700; color: #fff; letter-spacing: 0.5px; text-transform: uppercase; }
.block-bet { font-size: 9px; color: rgba(255,255,255,0.7); font-family: 'JetBrains Mono', monospace; }

.roulette-pointer {
  position: absolute; left: 50%; transform: translateX(-50%); top: 0; bottom: 0;
  display: flex; flex-direction: column; align-items: center; z-index: 5;
  pointer-events: none;
}
.pointer-top { color: var(--gold); font-size: 16px; line-height: 1; margin-bottom: -1px; }
.pointer-line { width: 2px; flex: 1; background: linear-gradient(180deg, var(--gold), transparent); }

.roulette-fade {
  position: absolute; top: 0; bottom: 0; width: 80px; z-index: 4; pointer-events: none;
}
.roulette-fade--left { left: 0; background: linear-gradient(90deg, var(--bg2), transparent); }
.roulette-fade--right { right: 0; background: linear-gradient(-90deg, var(--bg2), transparent); }

/* ── BET CARD ── */
.bet-card {
  background: var(--bg2); border: 1px solid var(--border2);
  border-radius: var(--radius); padding: 18px;
}
.bet-card-title { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: var(--text2); margin-bottom: 14px; font-weight: 600; }
.bet-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.adj-btn {
  width: 42px; height: 42px; border-radius: 50%; background: var(--bg3); border: 1px solid var(--border2);
  color: var(--text); font-size: 22px; cursor: pointer; display: flex; align-items: center; justify-content: center;
  font-weight: 700; transition: background 0.2s, border-color 0.2s;
  font-family: 'Syne', sans-serif;
}
.adj-btn:hover:not(:disabled) { background: var(--accent); border-color: var(--accent); }
.adj-btn:disabled { opacity: 0.3; cursor: default; }
.bet-field { flex: 1; display: flex; align-items: center; gap: 8px; background: var(--bg3); border: 1px solid var(--border2); border-radius: var(--r-sm); padding: 8px 14px; }
.bet-input {
  flex: 1; background: none; border: none; outline: none; color: var(--text);
  font-size: 24px; font-weight: 700; font-family: 'JetBrains Mono', monospace;
  width: 100%; min-width: 0;
}
.bet-input::-webkit-inner-spin-button, .bet-input::-webkit-outer-spin-button { -webkit-appearance: none; }
.bet-cur { font-size: 13px; color: var(--text2); font-weight: 600; }

.quick-row { display: flex; gap: 6px; margin-bottom: 14px; }
.quick-btn {
  flex: 1; padding: 8px 4px; background: var(--bg3); border: 1px solid var(--border);
  border-radius: var(--r-sm); color: var(--text); font-size: 13px; font-weight: 600;
  cursor: pointer; transition: all 0.2s; font-family: 'Syne', sans-serif;
}
.quick-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.quick-btn:disabled { opacity: 0.3; cursor: default; }
.quick-btn--max { background: linear-gradient(135deg, #2a1a4a, #1a1a3a); border-color: var(--accent); color: var(--accent2); }

.place-btn {
  width: 100%; padding: 16px; font-size: 16px; font-weight: 700;
  background: var(--bg3); border: 1px solid var(--border2);
  border-radius: var(--radius); color: var(--text2); cursor: not-allowed;
  transition: all 0.2s; position: relative; overflow: hidden;
  font-family: 'Syne', sans-serif; letter-spacing: 0.5px;
}
.place-btn--active {
  background: linear-gradient(135deg, var(--accent), #5c3cdd);
  border-color: var(--accent); color: #fff; cursor: pointer;
  box-shadow: 0 4px 20px #7c5cff40;
}
.place-btn--active:hover { transform: translateY(-1px); box-shadow: 0 6px 30px #7c5cff60; }
.place-btn--done {
  background: linear-gradient(135deg, #1a3a2a, #0f2a1a);
  border-color: var(--green); color: var(--green); cursor: default;
}
.place-btn-shine {
  position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent 30%, #ffffff15 50%, transparent 70%);
  animation: btnShine 3s ease-in-out infinite;
}
@keyframes btnShine { 0%,100%{transform:translateX(-100%)} 50%{transform:translateX(100%)} }

.bet-error { margin-top: 10px; color: var(--red); font-size: 13px; text-align: center; }

/* ── PLAYERS ── */
.players-card {
  background: var(--bg2); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 18px;
}
.players-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.card-title { font-size: 14px; font-weight: 700; color: var(--text); }
.players-badge {
  background: var(--accent); color: #fff; font-size: 11px; font-weight: 700;
  border-radius: 50px; padding: 2px 8px; min-width: 24px; text-align: center;
}
.empty-msg { color: var(--text2); font-size: 14px; text-align: center; padding: 20px 0; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.empty-icon { font-size: 32px; }

.players-list { display: flex; flex-direction: column; gap: 8px; }
.player-row {
  display: flex; align-items: center; gap: 10px;
  background: var(--bg3); border-radius: var(--r-sm);
  padding: 10px 12px; border: 1px solid var(--border);
}
.player-color { width: 4px; height: 36px; border-radius: 4px; flex-shrink: 0; }
.pr-emoji { font-size: 20px; }
.pr-name { flex: 1; font-size: 14px; font-weight: 600; }
.pr-me { color: var(--gold); }
.pr-you { font-size: 10px; background: var(--gold); color: #000; border-radius: 4px; padding: 1px 5px; margin-left: 6px; font-weight: 700; vertical-align: middle; }
.pr-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.pr-chance { font-size: 12px; color: var(--text2); font-family: 'JetBrains Mono', monospace; }
.pr-bet { font-size: 14px; font-weight: 700; color: var(--gold); font-family: 'JetBrains Mono', monospace; }

/* ═══════════════════════════════════════
   PROFILE TAB
═══════════════════════════════════════ */
.profile-hero {
  background: linear-gradient(135deg, #0f0f2a, #1a1a3a);
  border: 1px solid var(--border2); border-radius: var(--radius);
  padding: 28px; text-align: center;
}
.profile-avatar {
  width: 70px; height: 70px; border-radius: 50%; margin: 0 auto 12px;
  background: linear-gradient(135deg, var(--accent), var(--gold));
  display: flex; align-items: center; justify-content: center; font-size: 34px;
  box-shadow: 0 0 30px #7c5cff40;
}
.profile-name { font-size: 22px; font-weight: 800; margin-bottom: 4px; }
.profile-handle { color: var(--text2); font-size: 13px; font-family: 'JetBrains Mono', monospace; margin-bottom: 14px; }
.profile-balance { display: flex; align-items: baseline; gap: 6px; justify-content: center; }
.profile-bal-num { font-size: 36px; font-weight: 800; color: var(--gold); font-family: 'JetBrains Mono', monospace; }
.profile-bal-cur { font-size: 14px; color: var(--text2); }

.pstats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.pstat {
  background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 14px 8px; text-align: center; display: flex; flex-direction: column; gap: 4px;
}
.pstat-val { font-size: 18px; font-weight: 800; font-family: 'JetBrains Mono', monospace; }
.pstat-val.gold { color: var(--gold); }
.pstat-lbl { font-size: 10px; color: var(--text2); text-transform: uppercase; letter-spacing: 0.5px; }

.fin-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.fin-btn {
  padding: 16px; border-radius: var(--radius); border: 1px solid transparent;
  font-size: 15px; font-weight: 700; cursor: pointer; display: flex;
  align-items: center; justify-content: center; gap: 8px;
  transition: all 0.2s; font-family: 'Syne', sans-serif;
}
.fin-btn--deposit {
  background: linear-gradient(135deg, #1a2a1a, #0f1f0f);
  border-color: var(--green); color: var(--green);
}
.fin-btn--deposit:hover { background: var(--green); color: #000; }
.fin-btn--withdraw {
  background: linear-gradient(135deg, #2a1a1a, #1f0f0f);
  border-color: var(--red); color: var(--red);
}
.fin-btn--withdraw:hover:not(:disabled) { background: var(--red); color: #fff; }
.fin-btn:disabled { opacity: 0.3; cursor: default; }
.fin-icon { font-weight: 700; }

.ref-card {
  background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px;
}
.ref-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.ref-bonus { font-size: 12px; color: var(--gold); background: #f5c84215; border: 1px solid #f5c84230; border-radius: 50px; padding: 3px 10px; }
.ref-row { display: flex; gap: 8px; }
.ref-input {
  flex: 1; background: var(--bg3); border: 1px solid var(--border); border-radius: var(--r-sm);
  padding: 10px 12px; color: var(--text2); font-size: 12px;
  font-family: 'JetBrains Mono', monospace; outline: none;
}
.copy-btn {
  width: 42px; background: var(--bg3); border: 1px solid var(--border2); border-radius: var(--r-sm);
  color: var(--text); font-size: 18px; cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: border-color 0.2s;
}
.copy-btn:hover { border-color: var(--accent); }

.history-card {
  background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px;
}
.history-list { display: flex; flex-direction: column; gap: 8px; }
.history-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px; background: var(--bg3); border-radius: var(--r-sm);
  border: 1px solid var(--border);
}
.hist-left { display: flex; align-items: center; gap: 10px; }
.hist-pill { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 50px; letter-spacing: 1px; }
.hist-pill.win { background: #2ecc7120; color: var(--green); border: 1px solid #2ecc7140; }
.hist-pill.loss { background: #e74c3c20; color: var(--red); border: 1px solid #e74c3c40; }
.hist-time { font-size: 12px; color: var(--text2); font-family: 'JetBrains Mono', monospace; }
.hist-amount { font-weight: 700; font-size: 14px; font-family: 'JetBrains Mono', monospace; }
.hist-amount.win { color: var(--green); }
.hist-amount.loss { color: var(--red); }

/* ═══════════════════════════════════════
   ADMIN TAB
═══════════════════════════════════════ */
.admin-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; }
.astat { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--r-sm); padding: 12px 8px; text-align: center; display: flex; flex-direction: column; gap: 4px; }
.astat-val { font-size: 16px; font-weight: 800; font-family: 'JetBrains Mono', monospace; }
.astat-val.gold { color: var(--gold); }
.astat-val.green { color: var(--green); }
.astat-lbl { font-size: 9px; color: var(--text2); text-transform: uppercase; }

.admin-actions { display: flex; gap: 8px; }
.admin-action-btn {
  flex: 1; padding: 12px; background: var(--bg2); border: 1px solid var(--border2);
  border-radius: var(--r-sm); color: var(--text); cursor: pointer; font-weight: 600;
  transition: all 0.2s; font-family: 'Syne', sans-serif;
}
.admin-action-btn:hover { border-color: var(--accent); color: var(--accent); }
.admin-action-btn--danger { border-color: var(--red); color: var(--red); }
.admin-action-btn--danger:hover { background: var(--red); color: #fff; }

.admin-section { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
.section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.badge { background: var(--accent); color: #fff; font-size: 11px; font-weight: 700; border-radius: 50px; padding: 2px 8px; }
.req-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border); }
.req-row:last-child { border-bottom: none; }
.req-info { display: flex; flex-direction: column; gap: 3px; }
.req-user { font-size: 13px; font-weight: 600; }
.req-meta { font-size: 11px; color: var(--text2); font-family: 'JetBrains Mono', monospace; }
.req-wallet { font-size: 11px; color: var(--accent2); font-family: 'JetBrains Mono', monospace; }
.req-status { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
.req-status.pending { color: var(--gold); }
.req-status.completed { color: var(--green); }
.req-status.approved { color: var(--green); }
.req-status.rejected { color: var(--red); }
.req-actions { display: flex; gap: 6px; }
.req-approve, .req-reject {
  padding: 6px 12px; border-radius: 6px; border: none; cursor: pointer; font-size: 12px; font-weight: 700; font-family: 'Syne', sans-serif;
}
.req-approve { background: #2ecc7120; color: var(--green); border: 1px solid #2ecc7140; }
.req-approve:hover:not(:disabled) { background: var(--green); color: #000; }
.req-reject { background: #e74c3c20; color: var(--red); border: 1px solid #e74c3c40; }
.req-reject:hover:not(:disabled) { background: var(--red); color: #fff; }

.user-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border); }
.user-row:last-child { border-bottom: none; }
.user-info { display: flex; align-items: center; gap: 10px; }
.user-emoji { font-size: 24px; }
.user-name-txt { display: block; font-size: 13px; font-weight: 600; }
.user-bal { display: block; font-size: 11px; color: var(--gold); font-family: 'JetBrains Mono', monospace; }
.user-actions { display: flex; gap: 6px; }
.small-btn {
  padding: 6px 12px; border-radius: 6px; background: var(--bg3); border: 1px solid var(--border2);
  color: var(--text); cursor: pointer; font-size: 12px; font-weight: 600; font-family: 'Syne', sans-serif;
  transition: all 0.2s;
}
.small-btn:hover { border-color: var(--accent); color: var(--accent); }
.small-btn--danger { border-color: var(--red); color: var(--red); }

/* ═══════════════════════════════════════
   OVERLAYS & MODALS
═══════════════════════════════════════ */
.overlay {
  position: fixed; inset: 0; background: #000a; z-index: 100;
  display: flex; align-items: center; justify-content: center; padding: 20px;
  backdrop-filter: blur(6px);
}

/* ── WINNER CARD ── */
.winner-card {
  background: var(--bg2); border: 1px solid var(--border2);
  border-radius: 24px; padding: 36px 28px; text-align: center;
  position: relative; overflow: hidden; max-width: 300px; width: 100%;
  box-shadow: 0 20px 80px #0009;
}
.winner-bg-glow {
  position: absolute; inset: 0;
  background: radial-gradient(ellipse at 50% 0%, #f5c84215, transparent 60%);
  pointer-events: none;
}
.wc-trophy { font-size: 64px; animation: trophyBounce 0.6s ease-out; margin-bottom: 8px; }
@keyframes trophyBounce { 0%{transform:scale(0) rotate(-10deg)} 60%{transform:scale(1.2) rotate(5deg)} 100%{transform:scale(1) rotate(0deg)} }
.wc-label { font-size: 12px; text-transform: uppercase; letter-spacing: 3px; color: var(--text2); margin-bottom: 6px; }
.wc-name { font-size: 26px; font-weight: 800; margin-bottom: 8px; }
.wc-prize { font-size: 32px; font-weight: 800; color: var(--gold); font-family: 'JetBrains Mono', monospace; margin-bottom: 12px; }
.wc-you { font-size: 18px; color: var(--green); margin-bottom: 16px; font-weight: 700; }
.wc-loss { font-size: 16px; color: var(--red); margin-bottom: 16px; font-family: 'JetBrains Mono', monospace; }
.wc-close {
  width: 100%; padding: 14px; background: linear-gradient(135deg, var(--accent), #5c3cdd);
  border: none; border-radius: var(--radius); color: #fff; font-size: 15px; font-weight: 700;
  cursor: pointer; font-family: 'Syne', sans-serif; letter-spacing: 0.5px;
}

/* ── MODAL CARD ── */
.modal-card {
  background: var(--bg2); border: 1px solid var(--border2);
  border-radius: 20px; padding: 24px; max-width: 360px; width: 100%;
  box-shadow: 0 20px 80px #0009;
  max-height: 85vh; overflow-y: auto;
}
.modal-title { font-size: 20px; font-weight: 800; margin-bottom: 20px; display: flex; align-items: center; gap: 8px; }
.modal-icon { font-size: 22px; }
.modal-avail { font-size: 14px; color: var(--text2); margin-bottom: 16px; }

.preset-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; }
.preset-btn {
  flex: 1; min-width: 44px; padding: 10px 8px; background: var(--bg3); border: 1px solid var(--border);
  border-radius: var(--r-sm); color: var(--text); font-size: 14px; font-weight: 700;
  cursor: pointer; transition: all 0.2s; font-family: 'Syne', sans-serif;
}
.preset-btn:disabled { opacity: 0.3; cursor: default; }
.preset-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; }
.preset-btn:hover:not(:disabled):not(.active) { border-color: var(--accent); }

.modal-field {
  display: flex; align-items: center; gap: 10px;
  background: var(--bg3); border: 1px solid var(--border2); border-radius: var(--r-sm);
  padding: 10px 14px; margin-bottom: 14px;
}
.modal-input {
  flex: 1; background: none; border: none; outline: none; color: var(--text);
  font-size: 18px; font-weight: 600; font-family: 'JetBrains Mono', monospace; min-width: 0;
}
.modal-cur { font-size: 13px; color: var(--text2); font-weight: 600; }
.modal-btns { display: flex; gap: 10px; margin-top: 16px; }
.modal-cancel {
  flex: 1; padding: 13px; background: var(--bg3); border: 1px solid var(--border);
  border-radius: var(--r-sm); color: var(--text2); cursor: pointer; font-weight: 600;
  font-family: 'Syne', sans-serif;
}
.modal-confirm {
  flex: 1; padding: 13px; background: linear-gradient(135deg, var(--accent), #5c3cdd);
  border: none; border-radius: var(--r-sm); color: #fff; cursor: pointer; font-weight: 700;
  font-family: 'Syne', sans-serif; transition: opacity 0.2s;
}
.modal-confirm:disabled { opacity: 0.4; cursor: default; }

.deposit-info { display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
.dep-row { display: flex; flex-direction: column; gap: 4px; }
.dep-lbl { font-size: 11px; color: var(--text2); text-transform: uppercase; letter-spacing: 0.5px; }
.dep-val { font-size: 22px; font-weight: 800; font-family: 'JetBrains Mono', monospace; }
.dep-wallet-row { display: flex; align-items: center; gap: 8px; background: var(--bg3); border-radius: var(--r-sm); padding: 8px 10px; border: 1px solid var(--border); }
.dep-wallet { flex: 1; font-size: 12px; font-family: 'JetBrains Mono', monospace; word-break: break-all; }
.dep-wallet-row.highlight { border-color: var(--gold); }
.copy-small { background: none; border: none; cursor: pointer; font-size: 16px; padding: 2px; }
.dep-note { font-size: 12px; color: var(--text2); background: #ffffff08; border-radius: var(--r-sm); padding: 10px 12px; border-left: 3px solid var(--gold); }
.red { color: var(--red); }

.ton-connect-btn {
  width: 100%; padding: 14px; background: linear-gradient(135deg, #0088cc, #005fa3);
  border: none; border-radius: var(--r-sm); color: #fff; font-size: 16px; font-weight: 700;
  cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
  margin-bottom: 4px; font-family: 'Syne', sans-serif;
}

.waiting-message { text-align: center; padding: 20px 0; }
.spinner-large {
  width: 48px; height: 48px; border: 3px solid var(--border2); border-top-color: var(--accent);
  border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px;
}
@keyframes spin { to { transform: rotate(360deg); } }
.status-text { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
.status-hint { font-size: 12px; color: var(--text2); line-height: 1.5; }
.success-message { text-align: center; padding: 20px 0; }
.success-icon { font-size: 48px; margin-bottom: 12px; }
.success-text { font-size: 18px; font-weight: 700; color: var(--green); margin-bottom: 6px; }
.success-sub { font-size: 14px; color: var(--text2); }

.loading-row { display: flex; align-items: center; gap: 10px; color: var(--text2); font-size: 14px; margin-top: 10px; }
.spinner-small { width: 16px; height: 16px; border: 2px solid var(--border2); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }
.success-msg { color: var(--green); font-size: 14px; margin-top: 10px; }
.error-message { color: var(--red); font-size: 12px; margin-bottom: 10px; }

/* ── TOAST ── */
.toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  background: var(--bg2); border: 1px solid var(--border2);
  color: var(--text); font-size: 14px; font-weight: 600;
  padding: 12px 24px; border-radius: 50px;
  box-shadow: 0 8px 32px #0008; z-index: 200;
  white-space: nowrap;
}

/* ═══════════════════════════════════════
   TRANSITIONS
═══════════════════════════════════════ */
.winner-anim-enter-active { animation: winnerIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
.winner-anim-leave-active { animation: winnerIn 0.2s ease-in reverse; }
@keyframes winnerIn { from { opacity: 0; transform: scale(0.7); } to { opacity: 1; transform: scale(1); } }

.modal-anim-enter-active { animation: modalIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.modal-anim-leave-active { animation: modalIn 0.2s ease-in reverse; }
@keyframes modalIn { from { opacity: 0; transform: translateY(30px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }

.toast-anim-enter-active { animation: toastIn 0.3s ease-out; }
.toast-anim-leave-active { animation: toastIn 0.2s ease-in reverse; }
@keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

/* ── GLOBAL ── */
.gold { color: var(--gold); }
.green { color: var(--green); }
.win { color: var(--green); }
.loss { color: var(--red); }

/* Scrollbar */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: var(--bg); }
::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 4px; }
</style>
