<template>
  <div class="app">

    <!-- SPLASH -->
    <div v-if="!user" class="splash">
      <div class="splash-logo">
        <span class="splash-icon">◎</span>
        <span class="splash-title">TON Roulette</span>
      </div>
      <p class="splash-sub">Multiplayer · Fair · Instant</p>
      <button class="splash-btn" @click="quickLogin">Start Playing</button>
    </div>

    <!-- MAIN -->
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

      <!-- NAV -->
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
              width: isSpinning ? '0%' : (timeLeft / ROUND_TIME * 100) + '%',
              transition: isSpinning ? 'none' : 'width 1s linear, background 0.3s'
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
          <div v-if="!game.players.length" class="empty-msg">Be the first to join!</div>
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
          <button class="admin-action-btn" @click="adminForceEnd">Force End Round</button>
          <button class="admin-action-btn danger-btn" @click="adminResetRound">Reset Round</button>
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

    <!-- MODALS -->
    <transition name="fade">
      <div v-if="modal" class="overlay" @click.self="closeModal">
        <div class="modal-card">

          <!-- DEPOSIT -->
          <div v-if="modal === 'deposit'">
            <div class="modal-title">Deposit TON</div>
            <div class="modal-steps">
              <div class="step" :class="{ active: depositStep === 1 }"><span class="step-num">1</span><span>Amount</span></div>
              <div class="step-line"></div>
              <div class="step" :class="{ active: depositStep === 2 }"><span class="step-num">2</span><span>Send</span></div>
              <div class="step-line"></div>
              <div class="step" :class="{ active: depositStep === 3 }"><span class="step-num">3</span><span>Confirm</span></div>
            </div>

            <div v-if="depositStep === 1">
              <div class="preset-row">
                <button v-for="a in [5,10,25,50,100]" :key="a"
                  :class="['preset-btn',{active:depositAmt===a}]" @click="depositAmt=a">{{ a }}</button>
              </div>
              <div class="modal-field">
                <input type="number" v-model.number="depositAmt" min="0.1" step="0.1" class="modal-input" placeholder="Amount" />
                <span class="modal-cur">TON</span>
              </div>
              <div class="modal-btns">
                <button class="modal-cancel" @click="closeModal">Cancel</button>
                <button class="modal-confirm" @click="depositStep=2" :disabled="depositAmt<0.1">Next →</button>
              </div>
            </div>

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
                    <button class="copy-small" @click="copyText(HOUSE_WALLET,'Wallet copied!')">⎘</button>
                  </div>
                </div>
                <div class="dep-row">
                  <span class="dep-lbl">Comment (required!)</span>
                  <div class="dep-wallet-row">
                    <span class="dep-wallet gold">{{ currentDepComment }}</span>
                    <button class="copy-small" @click="copyText(currentDepComment,'Comment copied!')">⎘</button>
                  </div>
                </div>
                <div class="dep-note">⚠️ Include the exact comment — without it deposit won't be credited.</div>
              </div>
              <button class="ton-connect-btn" @click="openTonLink">
                <span>💎</span> Open in TON Wallet
              </button>
              <div class="modal-btns" style="margin-top:12px">
                <button class="modal-cancel" @click="depositStep=1">← Back</button>
                <button class="modal-confirm" @click="depositStep=3">I sent it →</button>
              </div>
            </div>

            <div v-if="depositStep === 3">
              <p class="dep-confirm-info">Paste transaction hash so admin can verify:</p>
              <div class="modal-field">
                <input type="text" v-model="depositTxHash" class="modal-input"
                  placeholder="TX hash (optional)" style="font-size:12px" />
              </div>
              <div v-if="depositLoading" class="loading-row"><span class="spinner-small"></span> Sending…</div>
              <div v-if="depositDone" class="success-msg">✓ Request sent! Admin will credit your balance.</div>
              <div class="modal-btns" v-if="!depositDone">
                <button class="modal-cancel" @click="depositStep=2">← Back</button>
                <button class="modal-confirm" @click="submitDepositRequest" :disabled="depositLoading">Submit</button>
              </div>
              <button v-if="depositDone" class="modal-confirm" style="width:100%;margin-top:8px" @click="closeModal">Done</button>
            </div>
          </div>

          <!-- WITHDRAW -->
          <div v-if="modal === 'withdraw'">
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
            <div class="dep-note">Withdrawals processed manually within 24h.</div>
            <div v-if="withdrawLoading" class="loading-row" style="margin-top:12px">
              <span class="spinner-small"></span> Sending request…
            </div>
            <div v-if="withdrawDone" class="success-msg">✓ Withdrawal request submitted!</div>
            <div class="modal-btns" style="margin-top:14px" v-if="!withdrawDone">
              <button class="modal-cancel" @click="closeModal">Cancel</button>
              <button class="modal-confirm" @click="submitWithdrawRequest"
                :disabled="withdrawAmt<0.1||withdrawAmt>balance||!withdrawWallet||withdrawLoading">Request</button>
            </div>
            <button v-if="withdrawDone" class="modal-confirm" style="width:100%;margin-top:8px" @click="closeModal">Done</button>
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
  where, setDoc, increment, writeBatch
} from 'firebase/firestore';

const EMOJIS = ['😎','🦊','🐸','🐼','🦁','🐨','🐯','🦅','🐺','🦝','🐻','🦋'];
const COLORS  = ['#e05252','#52a0e0','#52c77a','#e0a052','#9b52e0','#52d4e0','#e0527a','#7ae052'];
const ROUND_TIME  = 30;
const HOUSE_FEE   = 0.05;
const HOUSE_WALLET = 'UQD2NmD_lDYc33Ph1zwweWbgKHPGdVJMhBRWKl_VC7g3KHum'; // ← замените на свой

function randInt(n) { return Math.floor(Math.random() * n); }

function weightedRandom(players) {
  const total = players.reduce((s, p) => s + p.bet, 0);
  let r = Math.random() * total;
  for (const p of players) { r -= p.bet; if (r <= 0) return p; }
  return players[players.length - 1];
}

export default {
  name: 'App',

  data() {
    return {
      ROUND_TIME, HOUSE_WALLET,
      user: null, tab: 'game', balance: 0,
      isConnected: false,

      betAmount: 1, betLoading: false, betError: '',
      game: { id: null, players: [], totalBet: 0, status: 'waiting', endsAt: null },
      isSpinning: false, timeLeft: ROUND_TIME,
      timerHandle: null, spinAngle: 0, animFrame: null, winner: null,

      _unsubGame: null, _unsubUser: null,
      _unsubDeposits: null, _unsubWithdraws: null,

      stats: { played: 0, won: 0, earned: 0 },
      history: [], copied: false,

      modal: null,
      depositStep: 1, depositAmt: 10, depositTxHash: '',
      depositLoading: false, depositDone: false, currentDepComment: '',

      withdrawAmt: 10, withdrawWallet: '', withdrawLoading: false, withdrawDone: false,

      adminData: {
        totalUsers: 0, totalGames: 0, totalVolume: 0, houseBalance: 0,
        deposits: [], withdraws: [], users: [],
      },

      toastMsg: '', _toastTimer: null,
    };
  },

  computed: {
    isAdmin() { return this.user?.handle === 'whsxg'; },

    canBet() {
      return !this.isSpinning && !this.userAlreadyBet
        && this.betAmount >= 0.1 && this.betAmount <= this.balance
        && this.game.status === 'waiting' && this.isConnected;
    },

    userAlreadyBet() {
      return this.game.players.some(p => p.userId === this.user?.id);
    },

    referralLink() {
      return `https://t.me/YourBotName?start=ref_${this.user?.id}`;
    },

    winRate() {
      if (!this.stats.played) return 0;
      return Math.round(this.stats.won / this.stats.played * 100);
    },
  },

  mounted() {
    this.tryTelegram();
  },

  beforeUnmount() {
    this.stopTimer();
    this._unsubGame?.();
    this._unsubUser?.();
    this._unsubDeposits?.();
    this._unsubWithdraws?.();
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
  },

  methods: {

    // ══════════════════════════════════
    // AUTH (без Firebase Auth — только ID из Telegram)
    // ══════════════════════════════════

    tryTelegram() {
      const tg = window.Telegram?.WebApp;
      if (tg?.initDataUnsafe?.user) {
        tg.ready(); tg.expand();
        const u = tg.initDataUnsafe.user;
        this.doLogin({
          id: String(u.id),
          name: u.first_name + (u.last_name ? ' ' + u.last_name : ''),
          handle: u.username || String(u.id),
          emoji: EMOJIS[u.id % EMOJIS.length],
        });
      } else {
        this.quickLogin();
      }
    },

    quickLogin() {
      const id = randInt(99999);
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
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          // Новый пользователь — создаём запись
          await setDoc(userRef, {
            name: userData.name,
            handle: userData.handle,
            emoji: userData.emoji,
            balance: 0,
            stats: { played: 0, won: 0, earned: 0 },
            createdAt: serverTimestamp(),
          });
        } else {
          // Обновляем имя/хэндл если изменились
          await updateDoc(userRef, {
            name: userData.name,
            handle: userData.handle,
            emoji: userData.emoji,
          });
        }

        // Слушаем баланс в реальном времени
        this._unsubUser = onSnapshot(userRef, snap => {
          if (!snap.exists()) return;
          const d = snap.data();
          this.balance = d.balance || 0;
          this.stats   = d.stats   || { played: 0, won: 0, earned: 0 };
        });

        await this.loadHistory();
        this.subscribeGame();

      } catch (e) {
        console.error('Firebase error:', e);
        this.showToast('Firebase not configured — using offline mode');
        this.balance = 100;
        this.isConnected = true;
        this.$nextTick(() => this.drawWheel());
      }
    },

    // ══════════════════════════════════
    // GAME
    // ══════════════════════════════════

    subscribeGame() {
      const gameRef = doc(db, 'config', 'currentGame');
      let prevStatus = '';

      this._unsubGame = onSnapshot(gameRef, async snap => {
        this.isConnected = true;

        if (!snap.exists()) {
          if (this.isAdmin) await this.createFirestoreRound();
          else {
            // Не-admin ждёт пока admin создаст раунд
            this.$nextTick(() => this.drawWheel());
          }
          return;
        }

        const d = snap.data();

        this.game = {
          id: d.id,
          players:   d.players   || [],
          totalBet:  d.totalBet  || 0,
          status:    d.status,
          endsAt:    d.endsAt?.toMillis?.() || null,
          winnerId:  d.winnerId  || null,
        };

        // Синхронизируем таймер с сервером
        if (d.status === 'waiting' && d.endsAt) {
          this.timeLeft = Math.max(0, Math.round((d.endsAt.toMillis() - Date.now()) / 1000));
        }

        // Спин — только когда статус меняется на spinning
        if (d.status === 'spinning' && prevStatus !== 'spinning' && !this.isSpinning) {
          this.isSpinning = true;
          this.stopTimer();
          const winnerPlayer = (d.players || []).find(p => p.userId === d.winnerId);
          if (winnerPlayer) {
            setTimeout(() => this.animateSpin(winnerPlayer), 600);
          } else {
            setTimeout(() => { if (this.isAdmin) this.createFirestoreRound(); }, 3000);
          }
        }

        if (d.status === 'waiting') {
          this.isSpinning = false;
          this.winner = null;
          this.startClientTimer();
        }

        prevStatus = d.status;
        this.drawWheel();
      }, err => {
        console.error('Game snapshot error:', err);
        this.showToast('Connection error: ' + err.message);
      });
    },

    startClientTimer() {
      this.stopTimer();
      this.timerHandle = setInterval(() => {
        if (this.isSpinning || this.game.status !== 'waiting') return;
        if (this.game.endsAt) {
          this.timeLeft = Math.max(0, Math.round((this.game.endsAt - Date.now()) / 1000));
        } else {
          this.timeLeft = Math.max(0, this.timeLeft - 1);
        }
        if (this.timeLeft <= 0 && this.isAdmin) {
          this.stopTimer();
          this.adminEndRound();
        }
      }, 500);
    },

    stopTimer() {
      if (this.timerHandle) { clearInterval(this.timerHandle); this.timerHandle = null; }
    },

    async createFirestoreRound() {
      try {
        const endsAt = new Date(Date.now() + ROUND_TIME * 1000);
        await setDoc(doc(db, 'config', 'currentGame'), {
          id: 'g_' + Date.now(),
          players: [], totalBet: 0,
          status: 'waiting', endsAt,
          winnerId: null, createdAt: serverTimestamp(),
        });
        this.spinAngle = 0;
        this.timeLeft  = ROUND_TIME;
      } catch (e) {
        console.error('Create round error:', e);
        this.showToast('Error creating round: ' + e.message);
      }
    },

    // ══════════════════════════════════
    // PLACE BET — без runTransaction (проще, работает без Auth)
    // ══════════════════════════════════
    async placeBet() {
      if (!this.canBet) return;
      this.betLoading = true;
      this.betError   = '';

      try {
        // Читаем актуальные данные
        const [userSnap, gameSnap] = await Promise.all([
          getDoc(doc(db, 'users', this.user.id)),
          getDoc(doc(db, 'config', 'currentGame')),
        ]);

        if (!userSnap.exists()) throw new Error('User not found');
        if (!gameSnap.exists()) throw new Error('No active game');

        const bal = userSnap.data().balance || 0;
        const gd  = gameSnap.data();

        if (bal < this.betAmount)             throw new Error('Insufficient balance');
        if (gd.status !== 'waiting')          throw new Error('Round already started');
        if ((gd.players || []).some(p => p.userId === this.user.id))
                                              throw new Error('Already placed a bet');

        // Batch write: списываем баланс + добавляем игрока
        const batch = writeBatch(db);

        batch.update(doc(db, 'users', this.user.id), {
          balance: increment(-this.betAmount),
        });

        const newPlayers = [...(gd.players || []), {
          userId: this.user.id,
          name:   this.user.name,
          emoji:  this.user.emoji,
          bet:    this.betAmount,
        }];

        batch.update(doc(db, 'config', 'currentGame'), {
          players:  newPlayers,
          totalBet: +((gd.totalBet || 0) + this.betAmount).toFixed(2),
        });

        await batch.commit();

        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');

      } catch (e) {
        this.betError = e.message || 'Error placing bet';
        setTimeout(() => { this.betError = ''; }, 3000);
      } finally {
        this.betLoading = false;
      }
    },

    // ══════════════════════════════════
    // SPIN
    // ══════════════════════════════════
    animateSpin(winnerPlayer) {
      const players = this.game.players;
      if (!players.length) return;

      const total = this.game.totalBet;
      let angle = 0, winStart = 0, winEnd = 0;

      for (const p of players) {
        const sweep = (p.bet / total) * Math.PI * 2;
        if (p.userId === winnerPlayer.userId) { winStart = angle; winEnd = angle + sweep; }
        angle += sweep;
      }

      const winMid      = (winStart + winEnd) / 2;
      const targetBase  = -Math.PI / 2 - winMid;
      const spins       = 6 + Math.random() * 3;
      const targetAngle = targetBase + spins * Math.PI * 2;

      const duration  = 5000;
      const t0        = performance.now();
      const startAng  = this.spinAngle;
      const ease = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;

      const tick = now => {
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
      const house = +(this.game.totalBet * HOUSE_FEE).toFixed(2);
      const isMe  = winnerPlayer.userId === this.user.id;
      const myBet = this.game.players.find(p => p.userId === this.user.id);

      try {
        const batch = writeBatch(db);

        // Начисляем призовые победителю
        batch.update(doc(db, 'users', winnerPlayer.userId), {
          balance:        increment(prize),
          'stats.won':    increment(1),
          'stats.played': increment(1),
          'stats.earned': increment(prize),
        });

        // Статистика проигравших (только текущего юзера знаем)
        if (!isMe && myBet) {
          batch.update(doc(db, 'users', this.user.id), {
            'stats.played': increment(1),
          });
        }

        // Глобальная статистика
        const statsRef = doc(db, 'config', 'stats');
        batch.set(statsRef, {
          totalGames:   increment(1),
          totalVolume:  increment(this.game.totalBet),
          houseBalance: increment(house),
          totalUsers:   increment(0), // просто ensure поле существует
        }, { merge: true });

        await batch.commit();

        // История для текущего пользователя
        if (myBet) {
          await addDoc(collection(db, 'users', this.user.id, 'history'), {
            won:    isMe,
            amount: isMe ? prize : myBet.bet,
            ts:     serverTimestamp(),
            gameId: this.game.id,
          });
          this.loadHistory();
        }

      } catch (e) {
        console.error('Resolve round error:', e);
      }

      this.winner = {
        name:   winnerPlayer.name,
        prize,
        isMe,
        myLoss: myBet && !isMe ? myBet.bet : 0,
      };

      // Admin создаёт следующий раунд через 5 сек
      if (this.isAdmin) {
        setTimeout(() => this.createFirestoreRound(), 5000);
      }
    },

    dismissWinner() { this.winner = null; },

    // ══════════════════════════════════
    // CANVAS WHEEL
    // ══════════════════════════════════
    drawWheel() {
      const canvas = this.$refs.wheelCanvas;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const cx = 140, cy = 140, r = 128;
      ctx.clearRect(0, 0, 280, 280);

      const players = this.game.players;

      if (!players.length) {
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = '#141416'; ctx.fill();
        ctx.strokeStyle = '#2a2a2e'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.font = '13px DM Sans, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('Waiting for players…', cx, cy);
        return;
      }

      const total = this.game.totalBet;
      let angle   = this.spinAngle;

      for (const p of players) {
        const sweep = (p.bet / total) * Math.PI * 2;
        const hash  = String(p.userId).split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        const color = COLORS[hash % COLORS.length];

        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, angle, angle + sweep); ctx.closePath();
        ctx.fillStyle = color; ctx.fill();
        ctx.strokeStyle = '#0d0d0f'; ctx.lineWidth = 1.5; ctx.stroke();

        if (sweep > 0.22) {
          const la = angle + sweep / 2;
          const lx = cx + Math.cos(la) * r * 0.65;
          const ly = cy + Math.sin(la) * r * 0.65;
          ctx.save();
          ctx.translate(lx, ly); ctx.rotate(la + Math.PI / 2);
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.font = 'bold 10px DM Sans, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(p.name.length > 8 ? p.name.slice(0,7)+'…' : p.name, 0, -6);
          ctx.font = '9px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.fillText(p.bet + ' TON', 0, 6);
          ctx.restore();
        }
        angle += sweep;
      }

      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 3; ctx.stroke();
    },

    // ══════════════════════════════════
    // DEPOSIT
    // ══════════════════════════════════
    openModal(type) {
      this.modal = type;
      this.depositStep     = 1;
      this.depositDone     = false;
      this.depositLoading  = false;
      this.depositTxHash   = '';
      this.withdrawDone    = false;
      this.withdrawLoading = false;
      this.currentDepComment = `dep_${this.user?.id}_${Date.now()}`.slice(0, 30);
    },

    closeModal() { this.modal = null; },

    openTonLink() {
      const nano    = Math.round(this.depositAmt * 1e9);
      const comment = encodeURIComponent(this.currentDepComment);
      window.open(`ton://transfer/${HOUSE_WALLET}?amount=${nano}&text=${comment}`, '_blank');
    },

    async copyText(text, msg) {
      try { await navigator.clipboard.writeText(text); } catch {}
      this.showToast(msg || 'Copied!');
    },

    async submitDepositRequest() {
      this.depositLoading = true;
      try {
        await addDoc(collection(db, 'deposit_requests'), {
          userId:     this.user.id,
          userName:   this.user.name,
          userHandle: this.user.handle,
          amount:     this.depositAmt,
          txHash:     this.depositTxHash || '',
          comment:    this.currentDepComment,
          status:     'pending',
          ts:         serverTimestamp(),
        });
        this.depositDone = true;
        this.showToast('Deposit request sent!');
      } catch (e) {
        this.showToast('Error: ' + e.message);
      } finally {
        this.depositLoading = false;
      }
    },

    // ══════════════════════════════════
    // WITHDRAW
    // ══════════════════════════════════
    async submitWithdrawRequest() {
      if (this.withdrawAmt < 0.1 || this.withdrawAmt > this.balance || !this.withdrawWallet) return;
      this.withdrawLoading = true;
      try {
        // Блокируем баланс сразу
        await updateDoc(doc(db, 'users', this.user.id), {
          balance: increment(-this.withdrawAmt),
        });

        await addDoc(collection(db, 'withdraw_requests'), {
          userId:     this.user.id,
          userName:   this.user.name,
          userHandle: this.user.handle,
          amount:     this.withdrawAmt,
          wallet:     this.withdrawWallet,
          status:     'pending',
          ts:         serverTimestamp(),
        });

        this.withdrawDone = true;
        this.showToast('Withdrawal request submitted!');
      } catch (e) {
        this.showToast('Error: ' + e.message);
      } finally {
        this.withdrawLoading = false;
      }
    },

    // ══════════════════════════════════
    // ADMIN
    // ══════════════════════════════════
    switchAdmin() {
      this.tab = 'admin';
      this.subscribeAdmin();
    },

    async subscribeAdmin() {
      // Глобальная статистика
      try {
        const snap = await getDoc(doc(db, 'config', 'stats'));
        if (snap.exists()) {
          const d = snap.data();
          this.adminData.totalGames   = d.totalGames   || 0;
          this.adminData.totalVolume  = d.totalVolume  || 0;
          this.adminData.houseBalance = d.houseBalance || 0;
        }
      } catch {}

      // Слушаем депозиты
      this._unsubDeposits?.();
      this._unsubDeposits = onSnapshot(
        query(collection(db, 'deposit_requests'), where('status','==','pending'), orderBy('ts','desc')),
        snap => {
          this.adminData.deposits = snap.docs.map(d => ({ id: d.id, ...d.data(), processing: false }));
        },
        err => console.error('Deposits listener:', err)
      );

      // Слушаем выводы
      this._unsubWithdraws?.();
      this._unsubWithdraws = onSnapshot(
        query(collection(db, 'withdraw_requests'), where('status','==','pending'), orderBy('ts','desc')),
        snap => {
          this.adminData.withdraws = snap.docs.map(d => ({ id: d.id, ...d.data(), processing: false }));
        },
        err => console.error('Withdraws listener:', err)
      );

      // Загружаем пользователей
      try {
        const uSnap = await getDocs(query(collection(db, 'users'), orderBy('balance','desc'), limit(100)));
        this.adminData.users      = uSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        this.adminData.totalUsers = this.adminData.users.length;
      } catch (e) { console.error('Users load:', e); }
    },

    async approveDeposit(r) {
      r.processing = true;
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'users', r.userId), { balance: increment(r.amount) });
        batch.update(doc(db, 'deposit_requests', r.id), {
          status: 'approved', approvedAt: serverTimestamp(),
        });
        await batch.commit();
        this.showToast(`✓ +${r.amount} TON → ${r.userName}`);
      } catch (e) { this.showToast('Error: ' + e.message); r.processing = false; }
    },

    async rejectDeposit(r) {
      r.processing = true;
      try {
        await updateDoc(doc(db, 'deposit_requests', r.id), {
          status: 'rejected', rejectedAt: serverTimestamp(),
        });
        this.showToast('Deposit rejected');
      } catch (e) { this.showToast('Error: ' + e.message); r.processing = false; }
    },

    async approveWithdraw(r) {
      r.processing = true;
      try {
        await updateDoc(doc(db, 'withdraw_requests', r.id), {
          status: 'approved', approvedAt: serverTimestamp(),
        });
        this.showToast(`✓ Send ${r.amount} TON → ${r.wallet}`);
      } catch (e) { this.showToast('Error: ' + e.message); r.processing = false; }
    },

    async rejectWithdraw(r) {
      r.processing = true;
      try {
        const batch = writeBatch(db);
        // Возврат баланса
        batch.update(doc(db, 'users', r.userId), { balance: increment(r.amount) });
        batch.update(doc(db, 'withdraw_requests', r.id), {
          status: 'rejected', rejectedAt: serverTimestamp(),
        });
        await batch.commit();
        this.showToast('Withdrawal rejected, balance refunded');
      } catch (e) { this.showToast('Error: ' + e.message); r.processing = false; }
    },

    async adminEndRound() {
      if (!this.isAdmin || this.isSpinning) return;
      if (this.game.players.length < 2) {
        await this.createFirestoreRound(); return;
      }
      const winner = weightedRandom(this.game.players);
      try {
        await updateDoc(doc(db, 'config', 'currentGame'), {
          status: 'spinning', winnerId: winner.userId,
        });
      } catch (e) { console.error('End round:', e); }
    },

    adminForceEnd()  { this.adminEndRound(); },
    adminResetRound() { this.createFirestoreRound().then(() => this.showToast('Round reset')); },

    async adminAddBalance(u, amount) {
      try {
        await updateDoc(doc(db, 'users', u.id), { balance: increment(amount) });
        u.balance = +(u.balance + amount).toFixed(2);
        this.showToast(`+${amount} TON → ${u.name}`);
      } catch (e) { this.showToast('Error: ' + e.message); }
    },

    adminSetBalance(u) {
      const val = prompt(`Set balance for ${u.name} (current: ${u.balance} TON):`);
      if (val === null || isNaN(+val)) return;
      updateDoc(doc(db, 'users', u.id), { balance: +val })
        .then(() => { u.balance = +val; this.showToast(`Balance → ${val} TON`); })
        .catch(e => this.showToast('Error: ' + e.message));
    },

    // ══════════════════════════════════
    // HELPERS
    // ══════════════════════════════════
    async loadHistory() {
      try {
        const q = query(
          collection(db, 'users', this.user.id, 'history'),
          orderBy('ts','desc'), limit(20)
        );
        const snap = await getDocs(q);
        this.history = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch {}
    },

    fmt(n) { return Number(n || 0).toFixed(2); },

    playerColor(userId) {
      const hash = String(userId).split('').reduce((a, b) => a + b.charCodeAt(0), 0);
      return COLORS[hash % COLORS.length];
    },

    playerChance(p) {
      if (!this.game.totalBet) return 0;
      return (p.bet / this.game.totalBet * 100).toFixed(1);
    },

    adjustBet(delta) {
      this.betAmount = Math.max(0.1, Math.min(this.balance, +(this.betAmount + delta).toFixed(1)));
    },

    async copyRef() {
      try { await navigator.clipboard.writeText(this.referralLink); } catch {}
      this.copied = true; setTimeout(() => { this.copied = false; }, 2000);
    },

    showToast(msg) {
      this.toastMsg = msg;
      if (this._toastTimer) clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => { this.toastMsg = ''; }, 3200);
    },

    formatTime(ts) {
      if (!ts) return '';
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    },
  },
};
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@300;400;500;600&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

.app{
  --bg:#0d0d0f;--s1:#141416;--s2:#1c1c1f;--s3:#242428;
  --bd:rgba(255,255,255,0.07);--bd2:rgba(255,255,255,0.13);
  --gold:#f0b429;--gold-bg:rgba(240,180,41,0.10);
  --green:#3ec97b;--red:#e05252;--blue:#52a0e0;
  --txt:#f0f0f0;--txt2:rgba(240,240,240,0.55);--txt3:rgba(240,240,240,0.28);
  --r:14px;
  font-family:'DM Sans',system-ui,sans-serif;
  background:var(--bg);color:var(--txt);
  min-height:100vh;max-width:430px;margin:0 auto;
  padding-bottom:40px;-webkit-tap-highlight-color:transparent;
}
button{font-family:inherit;cursor:pointer;border:none;outline:none;background:none}
input{font-family:inherit;outline:none;border:none;background:none;color:inherit}
input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}

.splash{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px}
.splash-logo{display:flex;flex-direction:column;align-items:center;gap:8px}
.splash-icon{font-size:52px;color:var(--gold)}
.splash-title{font-size:30px;font-weight:600;letter-spacing:-.02em}
.splash-sub{font-size:13px;color:var(--txt3);margin-bottom:8px}
.splash-btn{padding:14px 44px;background:var(--gold);color:#0d0d0f;border-radius:40px;font-size:15px;font-weight:600;transition:opacity .15s}
.splash-btn:hover{opacity:.88}

.hdr{display:flex;align-items:center;justify-content:space-between;padding:18px 18px 0}
.hdr-user{display:flex;align-items:center;gap:10px}
.hdr-avatar{width:38px;height:38px;border-radius:50%;background:var(--s2);border:1px solid var(--bd2);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
.hdr-name{font-size:14px;font-weight:500}
.hdr-handle{font-size:11px;color:var(--txt3);font-family:'DM Mono',monospace}
.hdr-balance{display:flex;align-items:baseline;gap:4px;background:var(--gold-bg);border:1px solid rgba(240,180,41,.18);border-radius:40px;padding:8px 14px;cursor:pointer;transition:border-color .15s}
.hdr-balance:hover{border-color:rgba(240,180,41,.38)}
.hdr-bal-num{font-family:'DM Mono',monospace;font-size:14px;color:var(--gold)}
.hdr-bal-cur{font-size:10px;color:rgba(240,180,41,.6);text-transform:uppercase;margin-left:3px}

.nav{display:flex;gap:6px;padding:14px 18px;position:sticky;top:0;z-index:40;background:var(--bg);border-bottom:1px solid var(--bd)}
.nav-btn{flex:1;padding:9px 6px;border-radius:10px;border:1px solid transparent;font-size:13px;color:var(--txt2);transition:all .15s}
.nav-btn.active{background:var(--s2);border-color:var(--bd2);color:var(--txt)}

.tab{padding:16px 18px;display:flex;flex-direction:column;gap:14px}

.conn-banner{background:var(--s1);border:1px solid var(--bd);border-radius:10px;padding:10px 14px;display:flex;align-items:center;gap:8px;font-size:13px;color:var(--txt2)}
.conn-dot{width:8px;height:8px;border-radius:50%;background:var(--gold);animation:blink 1s ease infinite;flex-shrink:0}

.stats-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.stat-box{background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);padding:14px 10px;text-align:center}
.stat-val{display:block;font-family:'DM Mono',monospace;font-size:20px;line-height:1;margin-bottom:5px}
.stat-val.danger{color:var(--red);animation:blink 1s ease infinite}
.stat-val.gold{color:var(--gold)}
.stat-lbl{font-size:10px;color:var(--txt3);text-transform:uppercase;letter-spacing:.08em}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.4}}

.timer-track{height:3px;background:var(--s2);border-radius:2px;overflow:hidden}
.timer-fill{height:100%;background:var(--gold);border-radius:2px}
.timer-fill.danger{background:var(--red)}

.wheel-section{display:flex;justify-content:center}
.wheel-wrap{position:relative;width:280px;height:280px}
.wheel-canvas{display:block;border-radius:50%}
.wheel-pointer{position:absolute;top:-4px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:13px solid var(--gold);filter:drop-shadow(0 2px 6px rgba(240,180,41,.5));z-index:5}
.wheel-center{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:46px;height:46px;background:var(--bg);border-radius:50%;border:2px solid var(--bd2);display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--txt3);z-index:4;pointer-events:none}

.bet-card{background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);padding:16px;display:flex;flex-direction:column;gap:10px}
.bet-row{display:flex;align-items:center;gap:8px}
.adj-btn{width:44px;height:44px;border-radius:10px;background:var(--s2);border:1px solid var(--bd2);color:var(--txt);font-size:22px;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0}
.adj-btn:hover:not(:disabled){border-color:var(--gold);color:var(--gold)}
.adj-btn:disabled{opacity:.3;cursor:not-allowed}
.bet-field{flex:1;height:44px;border-radius:10px;background:var(--s2);border:1px solid var(--bd2);display:flex;align-items:center;justify-content:center;gap:6px;padding:0 12px}
.bet-input{flex:1;font-family:'DM Mono',monospace;font-size:16px;text-align:center}
.bet-input:disabled{opacity:.5}
.bet-cur{font-size:11px;color:var(--txt3)}
.bet-error{font-size:12px;color:var(--red);text-align:center}
.quick-row{display:flex;gap:6px}
.quick-btn{flex:1;padding:8px 4px;border:1px solid var(--bd);border-radius:8px;color:var(--txt2);font-size:12px;font-family:'DM Mono',monospace;transition:all .15s}
.quick-btn:hover:not(:disabled){border-color:var(--bd2);color:var(--txt)}
.quick-btn:disabled{opacity:.3;cursor:not-allowed}
.place-btn{width:100%;padding:13px;border-radius:11px;border:1px solid var(--bd);color:var(--txt2);font-size:14px;font-weight:500;transition:all .2s}
.place-btn.active{background:var(--gold);border-color:transparent;color:#0d0d0f;font-weight:600}
.place-btn.active:hover{opacity:.9}
.place-btn.done{background:var(--s2);border-color:var(--green);color:var(--green)}
.place-btn:disabled:not(.done){cursor:not-allowed}

.players-card{background:var(--s1);border:1px solid var(--bd);border-radius:var(--r);padding:16px}
.players-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.card-title{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--txt2)}
.players-count{font-family:'DM Mono',monospace;font-size:11px;color:var(--txt3);background:var(--s2);padding:2px 8px;border-radius:20px}
.empty-msg{font-size:13px;color:var(--txt3);text-align:center;padding:16px 0}
.players-list{display:flex;flex-direction:column;gap:6px}
.player-row{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--s2);border-radius:10px;border-left:3px solid transparent;animation:slideUp .2s ease}
@keyframes slideUp{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
.pr-left{display:flex;align-items:center;gap:8px}
.pr-emoji{font-size:18px}
.pr-name{font-size:13px}
.pr-me{font-weight:600}
.pr-you{font-size:10px;color:var(--gold);margin-left:4px}
.pr-right{display:flex;align-items:center;gap:10px}
.pr-chance{font-size:11px;color:var(--txt3);font-family:'DM Mono',monospace}
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
.req-info{display:flex;flex-direction:column;gap:2px}
.req-user{font-size:13px;font-weight:500}
.req-uid{font-size:11px;color:var(--txt3);font-family:'DM Mono',monospace}
.req-meta{font-size:11px;color:var(--txt3)}
.req-txhash{font-size:10px;color:var(--txt3);font-family:'DM Mono',monospace}
.req-wallet{font-size:10px;color:var(--blue);font-family:'DM Mono',monospace}
.req-actions{display:flex;gap:6px}
.req-approve,.req-reject{padding:6px 10px;border-radius:8px;font-size:13px;transition:all .15s;white-space:nowrap}
.req-approve{background:rgba(62,201,123,.1);border:1px solid rgba(62,201,123,.25);color:var(--green)}
.req-approve:hover:not(:disabled){background:rgba(62,201,123,.2)}
.req-reject{background:rgba(224,82,82,.1);border:1px solid rgba(224,82,82,.25);color:var(--red)}
.req-reject:hover:not(:disabled){background:rgba(224,82,82,.2)}
.req-approve:disabled,.req-reject:disabled{opacity:.4;cursor:not-allowed}
.user-row{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--s2);border-radius:10px}
.user-info{display:flex;align-items:center;gap:10px}
.user-emoji{font-size:20px}
.user-name-txt{display:block;font-size:13px}
.user-bal{display:block;font-size:11px;color:var(--gold);font-family:'DM Mono',monospace}
.user-actions{display:flex;gap:6px}
.small-btn{padding:5px 10px;border-radius:7px;font-size:12px;border:1px solid var(--bd2);color:var(--txt2);transition:all .15s}
.small-btn:hover{background:var(--s1);color:var(--txt)}
.danger-sm{border-color:rgba(224,82,82,.3)!important;color:var(--red)!important}

.overlay{position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:20px}
.winner-card{background:var(--s1);border:1px solid var(--bd2);border-radius:22px;padding:32px 28px;text-align:center;max-width:300px;width:100%}
.wc-trophy{font-size:52px;margin-bottom:12px}
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
.step{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--txt3)}
.step.active{color:var(--txt)}
.step-num{width:20px;height:20px;border-radius:50%;background:var(--s2);border:1px solid var(--bd2);display:flex;align-items:center;justify-content:center;font-size:10px}
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
.modal-input{flex:1;font-family:'DM Mono',monospace;font-size:15px}
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
.fade-enter-active,.fade-leave-active{transition:opacity .2s}
.fade-enter-from,.fade-leave-to{opacity:0}
.toast-anim-enter-active,.toast-anim-leave-active{transition:all .25s}
.toast-anim-enter-from,.toast-anim-leave-to{opacity:0;transform:translateX(-50%) translateY(10px)}
.gold{color:var(--gold)}.green{color:var(--green)}

@media(max-width:380px){
  .pstats{grid-template-columns:repeat(2,1fr)}
  .admin-stats{grid-template-columns:repeat(2,1fr)}
}
</style>
