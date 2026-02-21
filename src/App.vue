<template>
  <div class="app">

    <!-- SPLASH -->
    <div v-if="!user" class="splash">
      <div class="splash-logo">
        <span class="splash-icon">◎</span>
        <span class="splash-title">TON Roulette</span>
      </div>
      <button class="splash-btn" @click="quickLogin">Enter</button>
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
        <button v-if="isAdmin" :class="['nav-btn', { active: tab === 'admin' }]" @click="tab = 'admin'; loadAdmin()">Admin</button>
      </nav>

      <!-- ═══ GAME TAB ═══ -->
      <div v-if="tab === 'game'" class="tab game-tab">

        <!-- Stats row -->
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

        <!-- Timer bar -->
        <div class="timer-track">
          <div
            class="timer-fill"
            :class="{ danger: timeLeft <= 5 && !isSpinning }"
            :style="{ width: isSpinning ? '0%' : (timeLeft / ROUND_TIME * 100) + '%' }"
          ></div>
        </div>

        <!-- Wheel -->
        <div class="wheel-section">
          <div class="wheel-wrap">
            <canvas ref="wheelCanvas" width="280" height="280" class="wheel-canvas"></canvas>
            <div class="wheel-pointer"></div>
            <div class="wheel-center">◎</div>
          </div>
        </div>

        <!-- Bet panel -->
        <div class="bet-card">
          <div class="bet-row">
            <button class="adj-btn" @click="adjustBet(-0.5)" :disabled="isSpinning || userAlreadyBet">−</button>
            <div class="bet-field">
              <input
                type="number"
                v-model.number="betAmount"
                min="0.1"
                step="0.1"
                :disabled="isSpinning || userAlreadyBet"
                class="bet-input"
              />
              <span class="bet-cur">TON</span>
            </div>
            <button class="adj-btn" @click="adjustBet(+0.5)" :disabled="isSpinning || userAlreadyBet">+</button>
          </div>

          <div class="quick-row">
            <button
              v-for="a in [0.5, 1, 5, 10]"
              :key="a"
              class="quick-btn"
              :disabled="isSpinning || userAlreadyBet || a > balance"
              @click="betAmount = a"
            >{{ a }}</button>
          </div>

          <button
            class="place-btn"
            :class="{ active: canBet, done: userAlreadyBet }"
            :disabled="!canBet && !userAlreadyBet"
            @click="placeBet"
          >
            <span v-if="isSpinning">Spinning…</span>
            <span v-else-if="userAlreadyBet">Bet placed ✓</span>
            <span v-else>Place Bet</span>
          </button>
        </div>

        <!-- Players -->
        <div class="players-card">
          <div class="players-head">
            <span class="card-title">Players</span>
            <span class="players-count">{{ game.players.length }}</span>
          </div>
          <div v-if="game.players.length === 0" class="empty-msg">Be the first to join!</div>
          <div v-else class="players-list">
            <div
              v-for="(p, i) in game.players"
              :key="p.userId + i"
              class="player-row"
              :style="{ borderLeftColor: playerColor(p.userId) }"
            >
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
            <span class="pstat-lbl">Rate</span>
          </div>
        </div>

        <div class="ref-card">
          <div class="ref-head">
            <span class="card-title">Referral</span>
            <span class="ref-bonus">+10% from friends</span>
          </div>
          <div class="ref-row">
            <input class="ref-input" :value="referralLink" readonly />
            <button class="copy-btn" @click="copyRef">{{ copied ? '✓' : '⎘' }}</button>
          </div>
        </div>

        <div class="fin-row">
          <button class="fin-btn green" @click="openModal('deposit')">Deposit</button>
          <button class="fin-btn red" @click="openModal('withdraw')" :disabled="balance < 0.1">Withdraw</button>
        </div>

        <!-- History -->
        <div v-if="history.length" class="history-card">
          <div class="card-title" style="margin-bottom:12px">History</div>
          <div class="history-list">
            <div v-for="(h, i) in history" :key="i" class="history-row">
              <span :class="['hist-result', h.won ? 'win' : 'loss']">{{ h.won ? 'WIN' : 'LOSS' }}</span>
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
          <div class="astat">
            <span class="astat-val">{{ adminData.users }}</span>
            <span class="astat-lbl">Users</span>
          </div>
          <div class="astat">
            <span class="astat-val">{{ adminData.games }}</span>
            <span class="astat-lbl">Games</span>
          </div>
          <div class="astat">
            <span class="astat-val gold">{{ fmt(adminData.volume) }}</span>
            <span class="astat-lbl">Volume</span>
          </div>
        </div>

        <div class="admin-section">
          <div class="card-title">Deposit Requests</div>
          <div v-if="!adminData.deposits.length" class="empty-msg">No requests</div>
          <div v-for="r in adminData.deposits" :key="r.id" class="req-row">
            <div class="req-info">
              <span class="req-user">{{ r.userId }}</span>
              <span class="req-amount gold">{{ r.amount }} TON</span>
            </div>
            <div class="req-actions">
              <button class="req-approve" @click="approveDeposit(r)">✓</button>
              <button class="req-reject" @click="rejectDeposit(r)">✗</button>
            </div>
          </div>
        </div>

        <div class="admin-section">
          <div class="card-title">Withdraw Requests</div>
          <div v-if="!adminData.withdraws.length" class="empty-msg">No requests</div>
          <div v-for="r in adminData.withdraws" :key="r.id" class="req-row">
            <div class="req-info">
              <span class="req-user">{{ r.userId }}</span>
              <span class="req-amount gold">{{ r.amount }} TON</span>
            </div>
            <div class="req-actions">
              <button class="req-approve" @click="approveWithdraw(r)">✓</button>
              <button class="req-reject" @click="rejectWithdraw(r)">✗</button>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- ═══ WINNER OVERLAY ═══ -->
    <transition name="fade">
      <div v-if="winner" class="overlay" @click="dismissWinner">
        <div class="winner-card" @click.stop>
          <div class="wc-trophy">🏆</div>
          <div class="wc-label">Winner</div>
          <div class="wc-name">{{ winner.name }}</div>
          <div class="wc-prize">+{{ fmt(winner.prize) }} TON</div>
          <div v-if="winner.isMe" class="wc-you">That's you! 🎉</div>
          <button class="wc-close" @click="dismissWinner">Continue</button>
        </div>
      </div>
    </transition>

    <!-- ═══ MODALS ═══ -->
    <transition name="fade">
      <div v-if="modal" class="overlay" @click.self="modal = null">
        <div class="modal-card">

          <!-- DEPOSIT -->
          <div v-if="modal === 'deposit'">
            <div class="modal-title">Deposit TON</div>
            <div class="preset-row">
              <button
                v-for="a in [5, 10, 25, 50, 100]"
                :key="a"
                :class="['preset-btn', { active: depositAmt === a }]"
                @click="depositAmt = a"
              >{{ a }}</button>
            </div>
            <div class="modal-field">
              <input type="number" v-model.number="depositAmt" min="0.1" step="0.1" class="modal-input" />
              <span class="modal-cur">TON</span>
            </div>
            <div class="modal-btns">
              <button class="modal-cancel" @click="modal = null">Cancel</button>
              <button class="modal-confirm" @click="doDeposit" :disabled="depositAmt < 0.1">Deposit</button>
            </div>
          </div>

          <!-- WITHDRAW -->
          <div v-if="modal === 'withdraw'">
            <div class="modal-title">Withdraw TON</div>
            <div class="modal-avail">Available: <strong>{{ fmt(balance) }} TON</strong></div>
            <div class="preset-row">
              <button
                v-for="a in [5, 10, 25, 50]"
                :key="a"
                :class="['preset-btn', { active: withdrawAmt === a }]"
                :disabled="a > balance"
                @click="withdrawAmt = a"
              >{{ a }}</button>
              <button :class="['preset-btn', { active: withdrawAmt === balance }]" @click="withdrawAmt = balance">MAX</button>
            </div>
            <div class="modal-field">
              <input type="number" v-model.number="withdrawAmt" min="0.1" :max="balance" step="0.1" class="modal-input" />
              <span class="modal-cur">TON</span>
            </div>
            <div class="modal-btns">
              <button class="modal-cancel" @click="modal = null">Cancel</button>
              <button class="modal-confirm" @click="doWithdraw" :disabled="withdrawAmt < 0.1 || withdrawAmt > balance">Withdraw</button>
            </div>
          </div>

        </div>
      </div>
    </transition>

  </div>
</template>

<script>
const EMOJIS = ['😎','🦊','🐸','🐼','🦁','🐨','🐯','🦅','🐺','🦝','🐻','🦋'];
const COLORS = ['#e05252','#52a0e0','#52c77a','#e0a052','#9b52e0','#52d4e0','#e0527a','#7ae052'];
const ROUND_TIME = 30;

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
      ROUND_TIME,
      user: null,
      tab: 'game',
      balance: 100,
      betAmount: 1,
      modal: null,
      depositAmt: 10,
      withdrawAmt: 10,
      copied: false,

      // Game state
      game: { players: [], totalBet: 0, status: 'waiting' },
      isSpinning: false,
      timeLeft: ROUND_TIME,
      timerHandle: null,
      spinAngle: 0,
      animFrame: null,

      // Winner overlay
      winner: null,

      // Profile
      stats: { played: 0, won: 0, earned: 0 },
      history: [],

      // Admin
      adminData: { users: 0, games: 0, volume: 0, deposits: [], withdraws: [] },
    };
  },

  computed: {
    isAdmin() { return this.user?.name === 'whsxg'; },
    canBet() {
      return !this.isSpinning
        && !this.userAlreadyBet
        && this.betAmount >= 0.1
        && this.betAmount <= this.balance
        && this.game.status === 'waiting';
    },
    userAlreadyBet() {
      return this.game.players.some(p => p.userId === this.user?.id);
    },
    referralLink() {
      return `${window.location.origin}?ref=${this.user?.id}`;
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
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
  },

  methods: {
    // ── Init ──
    tryTelegram() {
      const tg = window.Telegram?.WebApp;
      if (tg?.initDataUnsafe?.user) {
        tg.ready(); tg.expand();
        const u = tg.initDataUnsafe.user;
        this.user = { id: String(u.id), name: u.first_name, handle: u.username || u.first_name, emoji: EMOJIS[u.id % EMOJIS.length] };
        this.startRound();
      }
    },

    quickLogin() {
      const id = randInt(99999);
      this.user = { id: String(id), name: `Player${id}`, handle: `p${id}`, emoji: EMOJIS[id % EMOJIS.length] };
      this.startRound();
    },

    // ── Round logic ──
    startRound() {
      this.game = { players: [], totalBet: 0, status: 'waiting' };
      this.isSpinning = false;
      this.timeLeft = ROUND_TIME;
      this.drawWheel();
      this.stopTimer();
      this.timerHandle = setInterval(() => {
        if (this.isSpinning) return;
        this.timeLeft--;
        if (this.timeLeft <= 0) {
          this.endRound();
        }
      }, 1000);
    },

    endRound() {
      this.stopTimer();
      if (this.game.players.length < 2) {
        // Not enough players — restart
        this.startRound();
        return;
      }
      this.spin();
    },

    stopTimer() {
      if (this.timerHandle) { clearInterval(this.timerHandle); this.timerHandle = null; }
    },

    placeBet() {
      if (!this.canBet) return;
      this.balance = +(this.balance - this.betAmount).toFixed(2);
      this.game.players.push({
        userId: this.user.id,
        name: this.user.name,
        emoji: this.user.emoji,
        bet: this.betAmount,
      });
      this.game.totalBet = +(this.game.totalBet + this.betAmount).toFixed(2);
      this.drawWheel();

      // Haptic
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
    },

    playerChance(p) {
      if (!this.game.totalBet) return 0;
      return (p.bet / this.game.totalBet * 100).toFixed(1);
    },

    // ── Spin animation ──
    spin() {
      this.isSpinning = true;
      this.game.status = 'spinning';

      const players = this.game.players;
      const winnerPlayer = weightedRandom(players);

      // Figure out target angle to land on winner's segment
      const total = this.game.totalBet;
      let startAngle = 0;
      let winStart = 0, winEnd = 0;
      for (const p of players) {
        const sweep = (p.bet / total) * Math.PI * 2;
        if (p.userId === winnerPlayer.userId) {
          winStart = startAngle;
          winEnd = startAngle + sweep;
        }
        startAngle += sweep;
      }

      // Target: land pointer (top = -PI/2) on winner midpoint
      const winMid = (winStart + winEnd) / 2;
      // We want: spinAngle + winMid = -PI/2 + 2π*k  => spinAngle = -PI/2 - winMid + 2π*k
      const targetBase = -Math.PI / 2 - winMid;
      const spins = 5 + Math.random() * 3; // 5-8 full rotations
      const targetAngle = targetBase + spins * Math.PI * 2;

      const duration = 4000;
      const startTime = performance.now();
      const startAngleVal = this.spinAngle;

      const ease = (t) => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;

      const animate = (now) => {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / duration, 1);
        this.spinAngle = startAngleVal + (targetAngle - startAngleVal) * ease(t);
        this.drawWheel();
        if (t < 1) {
          this.animFrame = requestAnimationFrame(animate);
        } else {
          this.spinAngle = targetAngle % (Math.PI * 2);
          this.drawWheel();
          this.showWinner(winnerPlayer);
        }
      };
      this.animFrame = requestAnimationFrame(animate);
    },

    showWinner(winnerPlayer) {
      const prize = this.game.totalBet;
      const isMe = winnerPlayer.userId === this.user.id;

      if (isMe) {
        this.balance = +(this.balance + prize).toFixed(2);
        this.stats.won++;
        this.stats.earned = +(this.stats.earned + prize).toFixed(2);
        this.history.unshift({ won: true, amount: prize });
      } else {
        const myBet = this.game.players.find(p => p.userId === this.user.id);
        if (myBet) this.history.unshift({ won: false, amount: myBet.bet });
      }
      if (this.game.players.some(p => p.userId === this.user.id)) {
        this.stats.played++;
      }
      if (this.history.length > 20) this.history.length = 20;

      this.winner = { name: winnerPlayer.name, prize, isMe };
    },

    dismissWinner() {
      this.winner = null;
      setTimeout(() => this.startRound(), 300);
    },

    // ── Canvas wheel ──
    drawWheel() {
      const canvas = this.$refs.wheelCanvas;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const cx = 140, cy = 140, r = 128;
      ctx.clearRect(0, 0, 280, 280);

      const players = this.game.players;

      if (!players.length) {
        // Empty ring
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = '#141416';
        ctx.fill();
        ctx.strokeStyle = '#2a2a2e';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.font = '13px DM Sans, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Waiting for players…', cx, cy);
        return;
      }

      const total = this.game.totalBet;
      let angle = this.spinAngle;

      players.forEach((p, i) => {
        const sweep = (p.bet / total) * Math.PI * 2;
        const color = COLORS[p.userId.split('').reduce((a, b) => a + b.charCodeAt(0), 0) % COLORS.length];

        // Segment
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, angle, angle + sweep);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#0d0d0f';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Label (only if segment is big enough)
        if (sweep > 0.25) {
          const labelAngle = angle + sweep / 2;
          const lx = cx + Math.cos(labelAngle) * r * 0.65;
          const ly = cy + Math.sin(labelAngle) * r * 0.65;
          ctx.save();
          ctx.translate(lx, ly);
          ctx.rotate(labelAngle + Math.PI / 2);
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.font = 'bold 10px DM Sans, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const label = p.name.length > 8 ? p.name.slice(0, 7) + '…' : p.name;
          ctx.fillText(label, 0, -6);
          ctx.font = '9px DM Mono, monospace';
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.fillText(p.bet + ' TON', 0, 6);
          ctx.restore();
        }

        angle += sweep;
      });

      // Outer ring
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 3;
      ctx.stroke();
    },

    // ── Finance ──
    openModal(type) { this.modal = type; },

    doDeposit() {
      if (this.depositAmt < 0.1) return;
      this.balance = +(this.balance + this.depositAmt).toFixed(2);
      this.modal = null;
      this.toast(`Deposited ${this.depositAmt} TON`);
    },

    doWithdraw() {
      if (this.withdrawAmt < 0.1 || this.withdrawAmt > this.balance) return;
      this.balance = +(this.balance - this.withdrawAmt).toFixed(2);
      this.modal = null;
      this.toast(`Withdrawal request sent`);
    },

    // ── Admin ──
    loadAdmin() {
      this.adminData = {
        users: 42,
        games: 218,
        volume: 1847.5,
        deposits: [
          { id: 'd1', userId: 'User_3821', amount: 50 },
          { id: 'd2', userId: 'User_9104', amount: 25 },
        ],
        withdraws: [
          { id: 'w1', userId: 'User_7752', amount: 30 },
        ],
      };
    },

    approveDeposit(r) {
      this.balance = +(this.balance + r.amount).toFixed(2);
      this.adminData.deposits = this.adminData.deposits.filter(x => x.id !== r.id);
      this.toast(`Deposit ${r.amount} TON approved`);
    },
    rejectDeposit(r) {
      this.adminData.deposits = this.adminData.deposits.filter(x => x.id !== r.id);
    },
    approveWithdraw(r) {
      this.adminData.withdraws = this.adminData.withdraws.filter(x => x.id !== r.id);
      this.toast(`Withdrawal ${r.amount} TON approved`);
    },
    rejectWithdraw(r) {
      this.adminData.withdraws = this.adminData.withdraws.filter(x => x.id !== r.id);
    },

    // ── Helpers ──
    fmt(n) { return Number(n).toFixed(2); },

    playerColor(userId) {
      const hash = userId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
      return COLORS[hash % COLORS.length];
    },

    adjustBet(delta) {
      this.betAmount = Math.max(0.1, Math.min(this.balance, +(this.betAmount + delta).toFixed(1)));
    },

    async copyRef() {
      try { await navigator.clipboard.writeText(this.referralLink); } catch {}
      this.copied = true;
      setTimeout(() => this.copied = false, 2000);
    },

    toast(msg) {
      if (window.Telegram?.WebApp?.showPopup) {
        window.Telegram.WebApp.showPopup({ message: msg, buttons: [{ type: 'ok' }] });
      }
      // In browser: silently ignore (winner overlay handles UX)
    },
  },
};
</script>
