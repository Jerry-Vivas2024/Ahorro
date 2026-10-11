import { createClient } from 'https://esm.sh/@insforge/sdk';

const BASE_URL = 'https://b8smvs4p.us-east.insforge.app';
const ANON_KEY = 'anon_49af547348ff7839405a020820fa593aa342755916284aa2dbac201a0f031286';
const STORAGE_KEY = 'ahorro-y-prestamos-state-v1';
const ANUAL_RATE = 36;

const insforge = createClient({ baseUrl: BASE_URL, anonKey: ANON_KEY });

const financeState = {
  capital: 0,
  loans: []
};

const authState = {
  user: null,
  pendingResetEmail: null
};

const capitalTotalEl = document.querySelector('#capital-total');
const capitalForm = document.querySelector('#capital-form');
const capitalInput = document.querySelector('#capital-amount');
const loanForm = document.querySelector('#loan-form');
const loanAmountInput = document.querySelector('#loan-amount');
const loanMonthsInput = document.querySelector('#loan-months');
const loanErrorEl = document.querySelector('#loan-error');
const loansListEl = document.querySelector('#loans-list');
const loanCardTemplate = document.querySelector('#loan-card-template');
const authPanel = document.querySelector('#auth-panel');
const dashboard = document.querySelector('#dashboard');
const authTitle = document.querySelector('#auth-title');
const authMessage = document.querySelector('#auth-message');
const userBox = document.querySelector('#user-box');
const userName = document.querySelector('#user-name');
const logoutBtn = document.querySelector('#logout-btn');
const loginForm = document.querySelector('#login-form');
const registerForm = document.querySelector('#register-form');
const resetForm = document.querySelector('#reset-form');
const resetConfirmForm = document.querySelector('#reset-confirm-form');
const tabs = [...document.querySelectorAll('.tab-btn')];

function formatCurrency(value) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function setMessage(text, type = 'info') {
  authMessage.textContent = text;
  authMessage.className = `message-box ${type}`;
}

function toggleAuthMode(mode) {
  tabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.mode === mode);
  });

  const isLogin = mode === 'login';
  const isRegister = mode === 'register';
  const isReset = mode === 'reset';

  loginForm.classList.toggle('hidden', !isLogin);
  loginForm.classList.toggle('visible', isLogin);
  registerForm.classList.toggle('hidden', !isRegister);
  registerForm.classList.toggle('visible', isRegister);
  resetForm.classList.toggle('hidden', !isReset);
  resetForm.classList.toggle('visible', isReset);
  resetConfirmForm.classList.toggle('hidden', !(authState.pendingResetEmail && !isRegister && !isLogin));

  authTitle.textContent = mode === 'login' ? 'Iniciar sesión' : mode === 'register' ? 'Crear cuenta' : 'Recuperar contraseña';
}

function saveFinanceState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(financeState));
}

function loadFinanceState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    financeState.capital = 0;
    financeState.loans = [];
    return;
  }

  try {
    const parsed = JSON.parse(saved);
    financeState.capital = Number(parsed.capital) || 0;
    financeState.loans = Array.isArray(parsed.loans) ? parsed.loans : [];
  } catch (error) {
    financeState.capital = 0;
    financeState.loans = [];
  }
}

function monthlyRate() {
  return (ANUAL_RATE / 100) / 12;
}

function calculateFixedPayment(principal, months) {
  if (principal <= 0 || months <= 0) return 0;
  const rate = monthlyRate();

  if (rate === 0) {
    return principal / months;
  }

  return (principal * rate) / (1 - Math.pow(1 + rate, -months));
}

function buildSchedule(principal, months) {
  if (principal <= 0 || months <= 0) {
    return [];
  }

  const cuota = calculateFixedPayment(principal, months);
  let balance = principal;
  const rows = [];

  for (let month = 1; month <= months; month += 1) {
    const interest = balance * monthlyRate();
    let principalPaid = cuota - interest;
    let closingBalance = balance - principalPaid;

    if (month === months) {
      principalPaid = balance;
      closingBalance = 0;
    }

    rows.push({
      month,
      openingBalance: Number(balance.toFixed(2)),
      interest: Number(interest.toFixed(2)),
      principalPaid: Number(principalPaid.toFixed(2)),
      cuota: Number((interest + principalPaid).toFixed(2)),
      closingBalance: Number(closingBalance.toFixed(2))
    });

    balance = closingBalance;
  }

  return rows;
}

function updateCapitalDisplay() {
  capitalTotalEl.textContent = formatCurrency(financeState.capital);
  const available = Number(financeState.capital) || 0;
  loanAmountInput.max = String(available);
  loanAmountInput.placeholder = available > 0 ? `Máximo ${formatCurrency(available)}` : 'Agrega capital primero';
}

function renderLoans() {
  if (!financeState.loans.length) {
    loansListEl.innerHTML = `
      <div class="empty-state">
        Todavía no hay préstamos activos. Cuando agregues capital, podrás aprobar el primero.
      </div>
    `;
    return;
  }

  loansListEl.innerHTML = '';

  financeState.loans.forEach((loan) => {
    const card = loanCardTemplate.content.cloneNode(true);
    const idLabel = card.querySelector('.loan-id');
    const nameEl = card.querySelector('.loan-name');
    const statusEl = card.querySelector('.loan-status');
    const amountEl = card.querySelector('.amount-value');
    const balanceEl = card.querySelector('.balance-value');
    const feeEl = card.querySelector('.fee-value');
    const monthsEl = card.querySelector('.months-value');
    const extraInput = card.querySelector('.extra-payment-input');
    const paymentBtn = card.querySelector('.extra-payment-btn');
    const scheduleBody = card.querySelector('.schedule-body');

    idLabel.textContent = `ID ${loan.id}`;
    nameEl.textContent = `Préstamo #${loan.id}`;
    statusEl.textContent = loan.isPaid ? 'Pagado' : 'Activo';
    statusEl.style.background = loan.isPaid ? 'rgba(13,159,110,0.12)' : 'rgba(63,157,253,0.12)';
    statusEl.style.color = loan.isPaid ? '#0d9f6e' : '#2d5b9d';
    amountEl.textContent = formatCurrency(loan.amount);
    balanceEl.textContent = formatCurrency(loan.balance);
    feeEl.textContent = formatCurrency(loan.cuotaFija || 0);
    monthsEl.textContent = `${loan.months} meses`;

    if (loan.schedule.length) {
      loan.schedule.forEach((row) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${row.month}</td>
          <td>${formatCurrency(row.openingBalance)}</td>
          <td>${formatCurrency(row.interest)}</td>
          <td>${formatCurrency(row.principalPaid)}</td>
          <td>${formatCurrency(row.cuota)}</td>
          <td>${formatCurrency(row.closingBalance)}</td>
        `;
        scheduleBody.appendChild(tr);
      });
    }

    paymentBtn.addEventListener('click', () => {
      const amount = Number(extraInput.value);
      if (!amount || amount <= 0) {
        return;
      }

      const currentLoan = financeState.loans.find((item) => item.id === loan.id);
      if (!currentLoan) {
        return;
      }

      currentLoan.balance = Math.max(0, currentLoan.balance - amount);
      currentLoan.isPaid = currentLoan.balance <= 0.01;
      const updatedSchedule = buildSchedule(currentLoan.balance, currentLoan.months);
      currentLoan.schedule = updatedSchedule.length ? updatedSchedule : [];
      currentLoan.cuotaFija = updatedSchedule.length ? updatedSchedule[0].cuota : 0;

      if (currentLoan.balance === 0) {
        currentLoan.isPaid = true;
      }

      saveFinanceState();
      renderFinance();
    });

    loansListEl.appendChild(card);
  });
}

function renderFinance() {
  updateCapitalDisplay();
  renderLoans();
}

function renderAuthenticatedUser() {
  if (!authState.user) {
    authPanel.classList.remove('hidden');
    dashboard.classList.add('hidden');
    userBox.classList.add('hidden');
    return;
  }

  authPanel.classList.add('hidden');
  dashboard.classList.remove('hidden');
  userBox.classList.remove('hidden');
  const displayName = authState.user?.user_metadata?.name || authState.user?.email || 'Usuario';
  userName.textContent = displayName;
}

async function loadUserSession() {
  try {
    const { data, error } = await insforge.auth.getCurrentUser();
    if (error) {
      authState.user = null;
      renderAuthenticatedUser();
      return;
    }

    authState.user = data;
    renderAuthenticatedUser();
  } catch (error) {
    authState.user = null;
    renderAuthenticatedUser();
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const email = document.querySelector('#login-email').value.trim();
  const password = document.querySelector('#login-password').value;

  try {
    setMessage('Iniciando sesión...');
    const { data, error } = await insforge.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(error.message || 'No se pudo iniciar sesión.', 'error');
      return;
    }

    authState.user = data?.user || data;
    setMessage('Sesión iniciada correctamente.', 'success');
    renderAuthenticatedUser();
    loginForm.reset();
  } catch (error) {
    setMessage(error.message || 'No se pudo iniciar sesión.', 'error');
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const name = document.querySelector('#register-name').value.trim();
  const email = document.querySelector('#register-email').value.trim();
  const password = document.querySelector('#register-password').value;

  try {
    setMessage('Creando cuenta...');
    const { data, error } = await insforge.auth.signUp({
      email,
      password,
      name,
      redirectTo: window.location.origin
    });

    if (error) {
      setMessage(error.message || 'No se pudo crear la cuenta.', 'error');
      return;
    }

    authState.user = data?.user || data;
    setMessage('Cuenta creada. Revisa tu correo para verificar la cuenta.', 'success');
    registerForm.reset();
  } catch (error) {
    setMessage(error.message || 'No se pudo crear la cuenta.', 'error');
  }
}

async function handleResetRequest(event) {
  event.preventDefault();
  const email = document.querySelector('#reset-email').value.trim();

  if (!email) {
    setMessage('Ingresa tu correo para recuperar la contraseña.', 'error');
    return;
  }

  try {
    setMessage('Enviando código de recuperación...');
    const { error } = await insforge.auth.sendResetPasswordEmail({
      email,
      redirectTo: window.location.origin
    });

    if (error) {
      setMessage(error.message || 'No se pudo enviar el correo de recuperación.', 'error');
      return;
    }

    authState.pendingResetEmail = email;
    setMessage('Código enviado. Ingresa el código y define tu nueva contraseña.', 'success');
    resetForm.classList.add('hidden');
    resetConfirmForm.classList.remove('hidden');
  } catch (error) {
    setMessage(error.message || 'No se pudo enviar el correo de recuperación.', 'error');
  }
}

async function handleResetConfirm(event) {
  event.preventDefault();
  const code = document.querySelector('#reset-code').value.trim();
  const newPassword = document.querySelector('#reset-new-password').value;
  const email = authState.pendingResetEmail;

  if (!email || !code || !newPassword) {
    setMessage('Completa el código y la nueva contraseña.', 'error');
    return;
  }

  try {
    setMessage('Actualizando contraseña...');
    const { data: resetToken, error: exchangeError } = await insforge.auth.exchangeResetPasswordToken({
      email,
      code
    });

    if (exchangeError) {
      setMessage(exchangeError.message || 'Código inválido.', 'error');
      return;
    }

    const { error: resetError } = await insforge.auth.resetPassword({
      newPassword,
      otp: resetToken.token
    });

    if (resetError) {
      setMessage(resetError.message || 'No se pudo actualizar la contraseña.', 'error');
      return;
    }

    authState.pendingResetEmail = null;
    resetConfirmForm.reset();
    toggleAuthMode('login');
    setMessage('Contraseña actualizada correctamente.', 'success');
  } catch (error) {
    setMessage(error.message || 'No se pudo actualizar la contraseña.', 'error');
  }
}

async function handleOAuth(provider) {
  try {
    setMessage(`Redirigiendo a ${provider}...`);
    const { data, error } = await insforge.auth.signInWithOAuth(provider, {
      redirectTo: window.location.origin
    });

    if (error) {
      setMessage(error.message || `No se pudo iniciar sesión con ${provider}.`, 'error');
      return;
    }

    if (data?.url) {
      window.location.assign(data.url);
    }
  } catch (error) {
    setMessage(error.message || `No se pudo iniciar sesión con ${provider}.`, 'error');
  }
}

async function handleLogout() {
  try {
    await insforge.auth.signOut();
    authState.user = null;
    renderAuthenticatedUser();
    setMessage('Sesión cerrada.', 'success');
  } catch (error) {
    setMessage(error.message || 'No se pudo cerrar la sesión.', 'error');
  }
}

capitalForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = Number(capitalInput.value);
  if (!value || value <= 0) {
    return;
  }

  financeState.capital += value;
  capitalInput.value = '';
  saveFinanceState();
  renderFinance();
});

loanForm.addEventListener('submit', (event) => {
  event.preventDefault();
  loanErrorEl.textContent = '';

  const amount = Number(loanAmountInput.value);
  const months = Number(loanMonthsInput.value);

  if (!amount || amount <= 0) {
    loanErrorEl.textContent = 'Ingresa un monto válido del préstamo.';
    return;
  }

  if (amount > financeState.capital) {
    loanErrorEl.textContent = 'El préstamo no puede superar el capital global disponible.';
    return;
  }

  if (!months || months <= 0) {
    loanErrorEl.textContent = 'Selecciona un plazo válido.';
    return;
  }

  const cuotaFija = calculateFixedPayment(amount, months);
  const loan = {
    id: Date.now(),
    amount,
    balance: amount,
    months,
    annualRate: ANUAL_RATE,
    cuotaFija,
    isPaid: false,
    schedule: buildSchedule(amount, months)
  };

  financeState.capital -= amount;
  financeState.loans.unshift(loan);
  loanAmountInput.value = '';
  saveFinanceState();
  renderFinance();
});

loginForm.addEventListener('submit', handleLogin);
registerForm.addEventListener('submit', handleRegister);
resetForm.addEventListener('submit', handleResetRequest);
resetConfirmForm.addEventListener('submit', handleResetConfirm);
logoutBtn.addEventListener('click', handleLogout);
tabs.forEach((tab) => tab.addEventListener('click', () => toggleAuthMode(tab.dataset.mode)));
document.querySelectorAll('.oauth-btn').forEach((button) => {
  button.addEventListener('click', () => handleOAuth(button.dataset.provider));
});

loadFinanceState();
renderFinance();
loadUserSession();
toggleAuthMode('login');
