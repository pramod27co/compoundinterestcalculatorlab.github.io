(() => {
  'use strict';

  // ---------- Utilities ----------
  const $ = (id) => document.getElementById(id);
  const fmt0 = (n) => (Number.isFinite(n) ? n : 0);

  const CURRENCIES = {
    USD: { symbol: '$', locale: 'en-US' },
    EUR: { symbol: '€', locale: 'de-DE' },
    GBP: { symbol: '£', locale: 'en-GB' },
    INR: { symbol: '₹', locale: 'en-IN' },
    JPY: { symbol: '¥', locale: 'ja-JP' },
    CAD: { symbol: 'C$', locale: 'en-CA' },
    AUD: { symbol: 'A$', locale: 'en-AU' },
    CHF: { symbol: 'Fr', locale: 'de-CH' },
  };

  const PERIOD_DAYS = { weekly: 7, biweekly: 14, monthly: 30.4375, quarterly: 91.3125, halfyearly: 182.625, yearly: 365 };
  const RATE_PERIOD_TO_YEARLY = {
    daily: 365,
    weekly: 52,
    monthly: 12,
    quarterly: 4,
    annual: 1,
  };

  function getCurrency() {
    const code = $('currency').value;
    return CURRENCIES[code] || CURRENCIES.USD;
  }

  function money(value) {
    const { symbol, locale } = getCurrency();
    const code = $('currency').value;
    const abs = Math.abs(value);
    const digits = code === 'JPY' ? 0 : 2;
    const formatted = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(abs);
    return value < 0 ? '-' + formatted : formatted;
  }

  function moneyCompact(value) {
    const { locale } = getCurrency();
    const code = $('currency').value;
    const digits = code === 'JPY' ? 0 : 0;
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      notation: 'compact',
      maximumFractionDigits: 1,
      minimumFractionDigits: digits,
    }).format(value);
  }

  function pct(value, digits = 2) {
    if (!Number.isFinite(value)) return '—';
    return `${value.toFixed(digits)}%`;
  }

  function clampNum(v, min, max) {
    v = Number(v);
    if (!Number.isFinite(v)) v = min;
    return Math.min(max, Math.max(min, v));
  }

  // ---------- Theme ----------
  const themeBtn = $('themeBtn');
  const storedTheme = localStorage.getItem('compoundlab-theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (storedTheme === 'dark' || (!storedTheme && prefersDark)) document.documentElement.setAttribute('data-theme', 'dark');
  themeBtn.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'light' : 'dark');
    localStorage.setItem('compoundlab-theme', isDark ? 'light' : 'dark');
    renderChart(lastResult);
  });

  // ---------- UI State ----------
  let mode = 'compound';
  let breakdownView = 'yearly';
  let mainView = 'chart';
  let lastResult = null;
  let chart = null;

  const modeTabs = document.querySelectorAll('.mode-tab');
  modeTabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      modeTabs.forEach((b) => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      mode = btn.dataset.mode;
      if (mode === 'daily') {
        $('compoundFrequency').value = '365';
        $('contributionType').value = 'none';
      } else if (mode === 'forex') {
        $('compoundFrequency').value = '365';
        $('contributionType').value = 'deposits';
        $('depositFrequency').value = 'monthly';
        if (Number($('depositAmount').value) === 0) $('depositAmount').value = 100;
      } else if (mode === 'compound') {
        if ($('compoundFrequency').value === '365' && $('ratePeriod').value === 'annual') $('compoundFrequency').value = '12';
      }
      syncVisibility();
      calculateAndRender();
    });
  });

  // period toggle (monthly / yearly)
  document.querySelectorAll('[data-period]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-period]').forEach((b) => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      breakdownView = btn.dataset.period;
      renderBreakdown(lastResult);
      renderChart(lastResult);
      writeParamsToURL();
    });
  });

  // view toggle (Table / Chart / Summary)
  document.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-view]').forEach((b) => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      mainView = btn.dataset.view;
      applyMainView();
    });
  });

  function applyMainView() {
    $('chartCard').hidden = mainView !== 'chart';
    $('summaryCard').hidden = mainView !== 'summary';
    $('tableCard').hidden = mainView !== 'table';
    document.querySelectorAll('[data-view]').forEach((b) => {
      const on = b.dataset.view === mainView;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (mainView === 'chart') renderChart(lastResult);
    writeParamsToURL();
  }

  function syncVisibility() {
    const isCompoundLike = mode !== 'simple';
    const compoundOnly = document.querySelectorAll('.compound-only');
    compoundOnly.forEach((el) => { el.style.display = isCompoundLike ? '' : 'none'; });

    const cf = $('compoundFrequency').value;
    const customField = $('customCompoundField');
    customField.hidden = !(isCompoundLike && cf === 'custom');
    customField.style.display = customField.hidden ? 'none' : '';

    const ctype = $('contributionType').value;
    document.querySelectorAll('.contribution-deposit').forEach((el) => {
      el.style.display = (ctype === 'deposits' || ctype === 'both') ? '' : 'none';
    });
    document.querySelectorAll('.contribution-withdrawal').forEach((el) => {
      el.style.display = (ctype === 'withdrawals' || ctype === 'both') ? '' : 'none';
    });

    // withdrawal affix
    const wt = $('withdrawType').value;
    const isPercent = wt.startsWith('percent_') || wt.startsWith('earnings_');
    $('withdrawAffix').textContent = isPercent ? '%' : getCurrency().symbol;
    const depIncType = $('depositIncreaseType').value;
    $('depositIncreaseType').previousElementSibling.placeholder = depIncType === 'percent' ? '0' : '0';
    // update split select label for deposit increase fixed currency
    const depFixedOpt = $('depositIncreaseType').querySelector('option[value="fixed"]');
    depFixedOpt.textContent = getCurrency().symbol;

    // currency symbols
    document.querySelectorAll('.currency-symbol').forEach((el) => { el.textContent = getCurrency().symbol; });
    if (!isPercent) $('withdrawAffix').textContent = getCurrency().symbol;
  }

  // ---------- Inputs ----------
  const inputIds = [
    'currency','principal','rate','ratePeriod','compoundFrequency','customCompound','years','months',
    'contributionType','depositAmount','depositFrequency','depositTiming','depositIncrease','depositIncreaseType',
    'withdrawAmount','withdrawType','withdrawIncrease'
  ];
  inputIds.forEach((id) => {
    const el = $(id);
    const evt = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(evt, () => { syncVisibility(); calculateAndRender(); });
    if (evt !== 'change') el.addEventListener('change', () => { syncVisibility(); calculateAndRender(); });
  });

  $('calcForm').addEventListener('submit', (e) => { e.preventDefault(); calculateAndRender(); scrollToResults(); });
  $('resetBtn').addEventListener('click', resetForm);
  $('exportBtn').addEventListener('click', exportCSV);
  const exportTop = $('exportBtnTop');
  if (exportTop) exportTop.addEventListener('click', exportCSV);

  function scrollToResults() {
    const target = document.querySelector('.results-panel') || document.querySelector('.calculator-shell');
    if (!target) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const top = target.getBoundingClientRect().top + window.scrollY - 72;
    window.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' });
  }

  function resetForm() {
    $('currency').value = 'USD';
    $('principal').value = 5000;
    $('rate').value = 5;
    $('ratePeriod').value = 'annual';
    $('compoundFrequency').value = '12';
    $('customCompound').value = 12;
    $('years').value = 5;
    $('months').value = 0;
    $('contributionType').value = 'none';
    $('depositAmount').value = 100;
    $('depositFrequency').value = 'monthly';
    $('depositTiming').value = 'end';
    $('depositIncrease').value = 0;
    $('depositIncreaseType').value = 'percent';
    $('withdrawAmount').value = 0;
    $('withdrawType').value = 'fixed_monthly';
    $('withdrawIncrease').value = 0;
    mode = 'compound';
    breakdownView = 'yearly';
    mainView = 'chart';
    modeTabs.forEach((b) => { const on = b.dataset.mode === 'compound'; b.classList.toggle('active', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    document.querySelectorAll('[data-period]').forEach((b) => { const on = b.dataset.period === 'yearly'; b.classList.toggle('active', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    document.querySelectorAll('[data-view]').forEach((b) => { const on = b.dataset.view === 'chart'; b.classList.toggle('active', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    applyMainView();
    syncVisibility();
    calculateAndRender();
  }

  // ---------- Calculation ----------
  function getInputs() {
    const years = clampNum($('years').value, 0, 100);
    const months = clampNum($('months').value, 0, 11);
    const totalMonths = Math.round(years * 12 + months);
    const principal = Math.max(0, Number($('principal').value) || 0);
    const rateRaw = Math.max(0, Number($('rate').value) || 0);
    const ratePeriod = $('ratePeriod').value;
    const annualRate = (rateRaw / 100) * (RATE_PERIOD_TO_YEARLY[ratePeriod] || 1);

    let compoundsPerYear = Number($('compoundFrequency').value);
    if ($('compoundFrequency').value === 'custom') compoundsPerYear = clampNum($('customCompound').value, 1, 365);
    compoundsPerYear = Math.max(1, compoundsPerYear);

    const ctype = $('contributionType').value;
    const depositAmount = Math.max(0, Number($('depositAmount').value) || 0);
    const depositFrequency = $('depositFrequency').value;
    const depositTiming = $('depositTiming').value;
    const depositIncrease = Math.max(0, Number($('depositIncrease').value) || 0);
    const depositIncreaseType = $('depositIncreaseType').value;

    const withdrawAmount = Math.max(0, Number($('withdrawAmount').value) || 0);
    const withdrawType = $('withdrawType').value;
    const withdrawIncrease = Math.max(0, Number($('withdrawIncrease').value) || 0);

    return {
      principal, annualRate, rateRaw, ratePeriod, compoundsPerYear, totalMonths,
      ctype, depositAmount, depositFrequency, depositTiming, depositIncrease, depositIncreaseType,
      withdrawAmount, withdrawType, withdrawIncrease
    };
  }

  function getCompoundingIntervalDays(n) {
    // n times per year. For 365/360 daily use 1 day. For others, spread across year.
    if (n >= 365) return 1;
    return 365 / n;
  }

  function getDepositIntervalMonths(freq) {
    return { weekly: 7/30.4375, biweekly: 14/30.4375, monthly: 1, quarterly: 3, halfyearly: 6, yearly: 12 }[freq] || 1;
  }

  function shouldDeposit(monthIndex, dayInMonth, freq, timing, totalDaysInMonth) {
    // We simulate daily. Determine if deposit occurs on this day.
    // For simplicity, map frequencies to day positions within month/year.
    return false; // handled in simulation by schedule
  }

  function buildDepositSchedule(totalDays, inp) {
    const sched = new Map(); // day -> [{amount, timing}]
    if (!(inp.ctype === 'deposits' || inp.ctype === 'both') || inp.depositAmount <= 0) return sched;
    const freq = inp.depositFrequency;
    const timing = inp.depositTiming;

    const add = (day, amt) => {
      if (day < 0 || day >= totalDays) return;
      if (!sched.has(day)) sched.set(day, []);
      sched.get(day).push({ amount: amt, timing });
    };

    if (freq === 'monthly' || freq === 'quarterly' || freq === 'halfyearly' || freq === 'yearly') {
      const monthStep = { monthly: 1, quarterly: 3, halfyearly: 6, yearly: 12 }[freq];
      for (let m = 0; m < Math.ceil(totalDays / 30.4375) + 1; m += monthStep) {
        const yearIndex = Math.floor(m / 12);
        const incAmount = inp.depositIncreaseType === 'percent'
          ? inp.depositAmount * Math.pow(1 + inp.depositIncrease / 100, yearIndex)
          : inp.depositAmount + inp.depositIncrease * yearIndex;
        const monthStart = Math.round(m * 30.4375);
        const monthEnd = Math.round((m + 1) * 30.4375) - 1;
        const day = timing === 'beginning' ? monthStart : monthEnd;
        add(day, incAmount);
      }
    } else {
      const stepDays = freq === 'weekly' ? 7 : 14;
      let day = timing === 'beginning' ? 0 : stepDays - 1;
      let lastYear = -1;
      let incAmount = inp.depositAmount;
      while (day < totalDays) {
        const yearIndex = Math.floor(day / 365);
        if (yearIndex !== lastYear) {
          incAmount = inp.depositIncreaseType === 'percent'
            ? inp.depositAmount * Math.pow(1 + inp.depositIncrease / 100, yearIndex)
            : inp.depositAmount + inp.depositIncrease * yearIndex;
          lastYear = yearIndex;
        }
        add(day, incAmount);
        day += stepDays;
      }
    }
    return sched;
  }

  function buildWithdrawalSchedule(totalDays, inp) {
    // returns array of {day, type, value, isPercent, isEarnings}
    const events = [];
    if (!(inp.ctype === 'withdrawals' || inp.ctype === 'both') || inp.withdrawAmount <= 0) return events;
    const t = inp.withdrawType;
    let freq = 'monthly';
    let isPercent = false;
    let isEarnings = false;
    if (t.startsWith('fixed_')) { freq = t.replace('fixed_', ''); }
    else if (t.startsWith('percent_')) { freq = t.replace('percent_', ''); isPercent = true; }
    else if (t.startsWith('earnings_')) { freq = t.replace('earnings_', ''); isPercent = true; isEarnings = true; }

    const pushMonthEvent = (m, yearIndex) => {
      const base = inp.withdrawAmount;
      const inc = base * Math.pow(1 + inp.withdrawIncrease / 100, yearIndex);
      const day = Math.round((m + 1) * 30.4375) - 1; // end of period
      if (day >= 0 && day < totalDays) events.push({ day, value: inc, isPercent, isEarnings });
    };

    const monthStep = { monthly: 1, quarterly: 3, halfyearly: 6, yearly: 12 }[freq] || 1;
    const totalMonths = Math.ceil(totalDays / 30.4375);
    for (let m = 0; m < totalMonths; m += monthStep) {
      const yearIndex = Math.floor(m / 12);
      pushMonthEvent(m, yearIndex);
    }
    return events;
  }

  function simulate(inp) {
    const totalDays = Math.max(0, Math.round(inp.totalMonths * 30.4375));
    const principal = inp.principal;
    const annualRate = inp.annualRate;
    const n = inp.compoundsPerYear;
    const dailyRate = annualRate / 365; // nominal annual spread over days for simple/compounding base

    const depositSched = buildDepositSchedule(totalDays, inp);
    const withdrawEvents = buildWithdrawalSchedule(totalDays, inp);
    const withdrawByDay = new Map();
    for (const e of withdrawEvents) {
      if (!withdrawByDay.has(e.day)) withdrawByDay.set(e.day, []);
      withdrawByDay.get(e.day).push(e);
    }

    let balance = principal;
    let totalDeposits = principal;
    let totalWithdrawals = 0;
    let accruedInterest = 0;
    let earningsSinceLastWithdrawal = 0;

    const monthly = [];
    const yearly = [];
    let monthDeposits = 0, monthWithdrawals = 0, monthInterest = 0;
    let yearDeposits = 0, yearWithdrawals = 0, yearInterest = 0;
    let prevMonthSnapshot = null;
    let prevYearSnapshot = null;

    // Compounding: for compound mode, compound at interval; for simple, no compounding on interest
    const isSimple = mode === 'simple';
    // For compound: apply interest each day based on compounding frequency.
    // We use an accumulator approach: accrue daily, compound at boundaries.
    let interestBucket = 0;
    const compoundInterval = isSimple ? Infinity : getCompoundingIntervalDays(n);
    let daysSinceCompound = 0;

    // For simple interest, interest is only on principal (initial + deposits - withdrawals? standard simple: on principal only).
    // We'll use: simple interest on current principal base, not compounding. Contributions earn simple interest from deposit time.
    // To keep it intuitive, simple mode: interest = principal * annualRate * time, plus deposits earn from their time. No compounding.
    let simplePrincipalBase = principal; // tracks principal for simple interest
    const simpleDeposits = [{ day: 0, amount: principal }];

    if (totalDays === 0) {
      const result = {
        futureValue: principal, totalInterest: 0, totalDeposits: principal, totalWithdrawals: 0,
        accruedInterest: 0, effectiveAnnualRate: annualRate * 100, ror: 0, doubleTime: calcDoubleTime(inp),
        monthly: [{ label: 'Start', deposits: principal, withdrawals: 0, interest: 0, totalDeposits: principal, accruedInterest: 0, balance: principal }],
        yearly: [{ label: 'Start', deposits: principal, withdrawals: 0, interest: 0, totalDeposits: principal, accruedInterest: 0, balance: principal }],
        inputs: inp
      };
      return result;
    }

    // Initial snapshot
    monthly.push({ label: 'Start', deposits: principal, withdrawals: 0, interest: 0, totalDeposits: principal, totalWithdrawals: 0, accruedInterest: 0, balance: principal });
    yearly.push({ label: 'Start', deposits: principal, withdrawals: 0, interest: 0, totalDeposits: principal, totalWithdrawals: 0, accruedInterest: 0, balance: principal });

    let currentMonth = 0;
    let currentYear = 0;

    for (let day = 0; day < totalDays; day++) {
      const monthIndex = Math.floor(day / 30.4375);
      const yearIndex = Math.floor(day / 365.25);

      // roll month
      if (monthIndex !== currentMonth) {
        monthly.push({
          label: `Month ${currentMonth + 1}`,
          deposits: monthDeposits, withdrawals: monthWithdrawals, interest: monthInterest,
          totalDeposits, totalWithdrawals, accruedInterest, balance
        });
        monthDeposits = 0; monthWithdrawals = 0; monthInterest = 0;
        currentMonth = monthIndex;
      }
      // roll year
      if (yearIndex !== currentYear) {
        yearly.push({
          label: `Year ${currentYear + 1}`,
          deposits: yearDeposits, withdrawals: yearWithdrawals, interest: yearInterest,
          totalDeposits, totalWithdrawals, accruedInterest, balance
        });
        yearDeposits = 0; yearWithdrawals = 0; yearInterest = 0;
        currentYear = yearIndex;
      }

      // Deposits (beginning of period)
      const dayDeposits = depositSched.get(day) || [];
      for (const d of dayDeposits) {
        if (d.timing === 'beginning') {
          balance += d.amount;
          totalDeposits += d.amount;
          monthDeposits += d.amount;
          yearDeposits += d.amount;
        }
      }

      // Interest
      let dayInterest = 0;
      if (isSimple) {
        dayInterest = Math.max(0, balance - accruedInterest) * dailyRate;
        balance += dayInterest;
        accruedInterest += dayInterest;
        monthInterest += dayInterest;
        yearInterest += dayInterest;
        earningsSinceLastWithdrawal += dayInterest;
      } else {
        daysSinceCompound += 1;
        if (daysSinceCompound >= compoundInterval - 1e-9) {
          const periods = daysSinceCompound / compoundInterval;
          const wholePeriods = Math.floor(periods + 1e-9);
          for (let p = 0; p < wholePeriods; p++) {
            const i = balance * (annualRate / n);
            balance += i;
            accruedInterest += i;
            monthInterest += i;
            yearInterest += i;
            earningsSinceLastWithdrawal += i;
            dayInterest += i;
          }
          daysSinceCompound = Math.max(0, (periods - wholePeriods) * compoundInterval);
        }
      }

      // Deposits (end of period)
      for (const d of dayDeposits) {
        if (d.timing === 'end') {
          balance += d.amount;
          totalDeposits += d.amount;
          monthDeposits += d.amount;
          yearDeposits += d.amount;
        }
      }

      // Withdrawals at end of day
      const wdEvents = withdrawByDay.get(day);
      if (wdEvents) {
        for (const e of wdEvents) {
          let amt = 0;
          if (e.isEarnings) {
            amt = Math.max(0, earningsSinceLastWithdrawal) * (e.value / 100);
          } else if (e.isPercent) {
            amt = Math.max(0, balance) * (e.value / 100);
          } else {
            amt = e.value;
          }
          amt = Math.min(amt, Math.max(0, balance));
          if (amt > 0) {
            balance -= amt;
            totalWithdrawals += amt;
            monthWithdrawals += amt;
            yearWithdrawals += amt;
          }
          if (e.isEarnings) earningsSinceLastWithdrawal = 0;
        }
        // For percent-of-balance withdrawals, earnings tracking resets at period boundary too
        if (wdEvents.some(e => e.isPercent && !e.isEarnings)) earningsSinceLastWithdrawal = 0;
      }
    }

    // final snapshots (only if the last partial period had activity)
    if (monthDeposits || monthWithdrawals || monthInterest) {
      monthly.push({
        label: `Month ${currentMonth + 1}`,
        deposits: monthDeposits, withdrawals: monthWithdrawals, interest: monthInterest,
        totalDeposits, totalWithdrawals, accruedInterest, balance
      });
    }
    if (yearDeposits || yearWithdrawals || yearInterest) {
      yearly.push({
        label: `Year ${currentYear + 1}`,
        deposits: yearDeposits, withdrawals: yearWithdrawals, interest: yearInterest,
        totalDeposits, totalWithdrawals, accruedInterest, balance
      });
    }

    const effectiveAnnualRate = isSimple ? annualRate * 100 : (Math.pow(1 + annualRate / n, n) - 1) * 100;
    const netInvested = totalDeposits - totalWithdrawals;
    const ror = netInvested > 0 ? ((balance - netInvested) / netInvested) * 100 : 0;

    return {
      futureValue: balance,
      totalInterest: accruedInterest,
      totalDeposits,
      totalWithdrawals,
      accruedInterest,
      effectiveAnnualRate,
      ror,
      doubleTime: calcDoubleTime(inp),
      monthly,
      yearly,
      inputs: inp
    };
  }

  function calcDoubleTime(inp) {
    const r = inp.annualRate;
    if (r <= 0) return null;
    if (mode === 'simple') {
      // simple: P*(1+r*t)=2P => t=1/r
      const years = 1 / r;
      return years;
    }
    const n = inp.compoundsPerYear;
    // (1+r/n)^(nt)=2 => t = ln(2)/(n*ln(1+r/n))
    const t = Math.log(2) / (n * Math.log(1 + r / n));
    return t;
  }

  function formatDoubleTime(years) {
    if (years === null || !Number.isFinite(years) || years < 0) return '—';
    if (years > 1000) return '1000+ years';
    const totalMonths = Math.round(years * 12);
    const y = Math.floor(totalMonths / 12);
    const m = totalMonths % 12;
    if (y === 0) return `${m} month${m !== 1 ? 's' : ''}`;
    if (m === 0) return `${y} year${y !== 1 ? 's' : ''}`;
    return `${y}y ${m}m`;
  }

  // ---------- Render ----------
  function calculateAndRender() {
    const inp = getInputs();
    // guard
    if (inp.totalMonths <= 0) {
      inp.totalMonths = 0;
    }
    lastResult = simulate(inp);
    renderResults(lastResult);
    renderChart(lastResult);
    renderBreakdown(lastResult);
    renderSummary(lastResult);
    writeParamsToURL();
  }

  function renderResults(r) {
    $('futureValue').textContent = money(r.futureValue);
    $('totalInterest').textContent = money(r.totalInterest);
    $('totalDeposits').textContent = money(r.totalDeposits);
    $('totalWithdrawals').textContent = money(r.totalWithdrawals);

    const totalMonths = r.inputs.totalMonths;
    const y = Math.floor(totalMonths / 12);
    const m = totalMonths % 12;
    let term = [];
    if (y) term.push(`${y} year${y !== 1 ? 's' : ''}`);
    if (m) term.push(`${m} month${m !== 1 ? 's' : ''}`);
    $('futureMeta').textContent = term.length ? `After ${term.join(', ')}` : 'Initial amount';

    $('effectiveRate').textContent = pct(r.effectiveAnnualRate, 2);
    $('rorValue').textContent = pct(r.ror, 2);
    $('doubleTime').textContent = formatDoubleTime(r.doubleTime);

    const nominalAnnual = r.inputs.annualRate * 100;
    $('rateCompare').textContent = `${pct(nominalAnnual, 2)} → ${pct(r.effectiveAnnualRate, 2)}`;

    const freqLabel = mode === 'simple' ? 'Simple interest' : `Compounded ${$('compoundFrequency').selectedOptions[0].textContent.toLowerCase()}`;
    $('chartNote').textContent = freqLabel;
  }

  function renderChart(r) {
    const ctx = $('growthChart');
    if (!ctx || !r) return;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.18)';
    const textColor = isDark ? '#9fb0cc' : '#64748b';
    const ink = isDark ? '#e8f5ee' : '#14231a';

    const isMonthly = breakdownView === 'monthly';
    const data = isMonthly ? r.monthly : r.yearly;
    const principal = r.inputs.principal;

    const labels = data.map((d, i) => (i === 0 ? 'Start' : d.label));
    const initialBal = data.map(() => principal);
    const deposits = data.map((d) => Math.max(0, d.totalDeposits - principal));
    const interest = data.map((d) => d.accruedInterest);
    const withdrawals = data.map((d) => -d.totalWithdrawals);
    const balances = data.map((d) => d.balance);

    // axis range (stacked positives top + negative withdrawals)
    const topStack = data.map((d, i) => principal + deposits[i] + interest[i]);
    const maxVal = Math.max(1, ...topStack, ...balances);
    const minVal = Math.min(0, ...withdrawals);
    const span = maxVal - minVal || 1;
    const yMax = maxVal + span * 0.08;
    const yMin = minVal < 0 ? minVal - span * 0.08 : 0;

    const barBlue = isDark ? '#38bdf8' : '#2f9fe0';
    const barLight = isDark ? '#a5e3fb' : '#bfe4f8';
    const barOrange = isDark ? '#fb923c' : '#f5871f';
    const barRed = isDark ? '#f87171' : '#e06666';
    const lineInk = isDark ? '#f8fafc' : '#14231a';

    const tickStep = Math.max(1, Math.ceil(data.length / 12));
    const dense = data.length > 60;

    const config = {
      data: {
        labels,
        datasets: [
          {
            type: 'bar',
            label: 'Initial Balance',
            data: initialBal,
            backgroundColor: barBlue,
            borderColor: barBlue,
            borderWidth: 0,
            borderRadius: 0,
            stack: 's',
            order: 2,
          },
          {
            type: 'bar',
            label: 'Deposits',
            data: deposits,
            backgroundColor: barLight,
            borderColor: barLight,
            borderWidth: 0,
            stack: 's',
            order: 2,
          },
          {
            type: 'bar',
            label: 'Accrued Interest',
            data: interest,
            backgroundColor: barOrange,
            borderColor: barOrange,
            borderWidth: 0,
            stack: 's',
            order: 2,
          },
          {
            type: 'bar',
            label: 'Withdrawals',
            data: withdrawals,
            backgroundColor: barRed,
            borderColor: barRed,
            borderWidth: 0,
            stack: 's',
            order: 2,
          },
          {
            type: 'line',
            label: 'Balance',
            data: balances,
            yAxisID: 'y1',
            borderColor: lineInk,
            backgroundColor: lineInk,
            borderWidth: 2,
            tension: 0.25,
            fill: false,
            pointRadius: dense ? 0 : 3.5,
            pointHoverRadius: dense ? 4 : 5,
            pointBackgroundColor: '#ffffff',
            pointBorderColor: lineInk,
            pointBorderWidth: 1.6,
            order: 1,
          },
        ].filter((ds) => {
          if (ds.label === 'Withdrawals') return withdrawals.some((v) => v !== 0);
          if (ds.label === 'Deposits') return deposits.some((v) => v !== 0);
          if (ds.label === 'Initial Balance') return principal > 0;
          return true;
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        datasets: { bar: { barPercentage: dense ? 0.98 : 0.72, categoryPercentage: dense ? 0.98 : 0.82 } },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              boxWidth: 9,
              boxHeight: 9,
              padding: 14,
              color: textColor,
              font: { size: 11, weight: '600' },
            },
          },
          tooltip: {
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            titleColor: isDark ? '#e8f5ee' : '#14231a',
            bodyColor: isDark ? '#9ab0a4' : '#5f7268',
            borderColor: isDark ? 'rgba(148,163,184,0.2)' : 'rgba(148,163,184,0.25)',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 10,
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            callbacks: {
              title: (items) => (items.length ? items[0].label : ''),
              label: (c) => ` ${c.dataset.label}: ${money(c.parsed.y)}`,
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: {
              color: textColor,
              font: { size: 10.5 },
              autoSkip: false,
              maxRotation: 0,
              callback: function (val, i) { return i % tickStep === 0 ? this.getLabelForValue(val) : ''; },
            },
            border: { display: false },
            title: { display: true, text: isMonthly ? 'Months' : 'Years', color: textColor, font: { size: 11, weight: '600' } },
          },
          y: {
            stacked: true,
            min: yMin,
            max: yMax,
            grid: { color: gridColor },
            ticks: { color: textColor, font: { size: 10.5 }, callback: (v) => moneyCompact(v) },
            border: { display: false },
          },
          y1: {
            display: false,
            stacked: false,
            min: yMin,
            max: yMax,
            grid: { display: false },
          },
        },
      },
    };

    if (chart) {
      chart.data = config.data;
      chart.options = config.options;
      chart.update();
    } else {
      chart = new Chart(ctx, config);
    }

    $('chartTitle').textContent = isMonthly ? 'Monthly chart' : 'Yearly chart';
  }

  function renderSummary(r) {
    const grid = $('summaryGrid');
    if (!grid || !r) return;
    const totalMonths = r.inputs.totalMonths;
    const y = Math.floor(totalMonths / 12);
    const m = totalMonths % 12;
    const term = [y ? `${y} year${y !== 1 ? 's' : ''}` : '', m ? `${m} month${m !== 1 ? 's' : ''}` : ''].filter(Boolean).join(', ') || '0';
    const freqLabel = mode === 'simple' ? 'Simple (no compounding)' : $('compoundFrequency').selectedOptions[0].textContent;
    const rows = [
      ['Initial deposit', money(r.inputs.principal)],
      ['Interest rate', `${r.inputs.rateRaw}% ${r.inputs.ratePeriod}`],
      ['Effective rate (APY)', pct(r.effectiveAnnualRate, 2)],
      ['Nominal → effective', `${pct(r.inputs.annualRate * 100, 2)} → ${pct(r.effectiveAnnualRate, 2)}`],
      ['Time', term],
      ['Compounding', freqLabel],
      ['Future value', money(r.futureValue)],
      ['Total interest', money(r.totalInterest)],
      ['Total deposits', money(r.totalDeposits)],
      ['Total withdrawals', money(r.totalWithdrawals)],
      ['Rate of return', pct(r.ror, 2)],
      ['Time to double', formatDoubleTime(r.doubleTime)],
    ];
    grid.innerHTML = rows.map(([k, v]) => `<div class="summary-row"><span>${k}</span><strong>${v}</strong></div>`).join('');
  }

  function renderBreakdown(r) {
    const tbody = $('breakdownBody');
    $('periodCol').textContent = breakdownView === 'monthly' ? 'Month' : 'Year';
    $('breakdownTitle').textContent = breakdownView === 'monthly' ? 'Monthly detail' : 'Yearly detail';
    if (!r) { tbody.innerHTML = ''; return; }
    const data = breakdownView === 'monthly' ? r.monthly : r.yearly;
    const rows = data.map((d, i) => {
      const dep = d.deposits;
      const wd = d.withdrawals;
      const interest = d.interest;
      const depClass = dep > 0 ? 'num-positive' : 'num-muted';
      const wdClass = wd > 0 ? 'num-negative' : 'num-muted';
      const intClass = interest > 0 ? 'num-positive' : (interest < 0 ? 'num-negative' : 'num-muted');
      return `<tr>
        <td>${i === 0 ? 'Start' : d.label}</td>
        <td class="${depClass}">${dep > 0 ? money(dep) : '—'}</td>
        <td class="${wdClass}">${wd > 0 ? money(wd) : '—'}</td>
        <td class="${intClass}">${interest !== 0 ? money(interest) : '—'}</td>
        <td>${money(d.totalDeposits)}</td>
        <td>${money(d.accruedInterest)}</td>
        <td><strong>${money(d.balance)}</strong></td>
      </tr>`;
    }).join('');
    tbody.innerHTML = rows;
  }

  function exportCSV() {
    if (!lastResult) return;
    const data = breakdownView === 'monthly' ? lastResult.monthly : lastResult.yearly;
    const headers = ['Period','Deposits','Withdrawals','Interest','Total Deposits','Total Withdrawals','Accrued Interest','Balance'];
    const lines = [headers.join(',')];
    data.forEach((d, i) => {
      const row = [
        i === 0 ? 'Start' : d.label,
        d.deposits.toFixed(2),
        d.withdrawals.toFixed(2),
        d.interest.toFixed(2),
        d.totalDeposits.toFixed(2),
        d.totalWithdrawals.toFixed(2),
        d.accruedInterest.toFixed(2),
        d.balance.toFixed(2)
      ];
      lines.push(row.join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compound-interest-${breakdownView}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ---------- Shareable URLs ----------
  const URL_PARAM_MAP = [
    ['c', 'currency'], ['p', 'principal'], ['r', 'rate'], ['rp', 'ratePeriod'],
    ['cf', 'compoundFrequency'], ['cc', 'customCompound'], ['y', 'years'], ['m', 'months'],
    ['ct', 'contributionType'], ['da', 'depositAmount'], ['df', 'depositFrequency'],
    ['dt', 'depositTiming'], ['di', 'depositIncrease'], ['dit', 'depositIncreaseType'],
    ['wa', 'withdrawAmount'], ['wt', 'withdrawType'], ['wi', 'withdrawIncrease'],
  ];
  const VALID_MODES = ['compound', 'daily', 'forex', 'simple'];
  const VALID_VIEWS = ['table', 'chart', 'summary'];
  const VALID_PERIODS = ['monthly', 'yearly'];

  function applyParamsFromURL() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (Array.from(params.keys()).length === 0) return;
      for (const [key, id] of URL_PARAM_MAP) {
        const v = params.get(key);
        if (v === null) continue;
        const el = $(id);
        if (!el) continue;
        if (el.tagName === 'SELECT') {
          const ok = Array.from(el.options).some((o) => o.value === v);
          if (ok) el.value = v;
        } else {
          el.value = v;
        }
      }
      const modeParam = params.get('mode');
      if (modeParam && VALID_MODES.includes(modeParam)) {
        mode = modeParam;
        modeTabs.forEach((b) => {
          const on = b.dataset.mode === mode;
          b.classList.toggle('active', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
      }
      const viewParam = params.get('view');
      if (viewParam && VALID_VIEWS.includes(viewParam)) mainView = viewParam;
      const periodParam = params.get('period');
      if (periodParam && VALID_PERIODS.includes(periodParam)) breakdownView = periodParam;
      document.querySelectorAll('[data-period]').forEach((b) => {
        const on = b.dataset.period === breakdownView;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
    } catch (e) { /* ignore malformed URLs */ }
  }

  function writeParamsToURL() {
    try {
      const params = new URLSearchParams();
      for (const [key, id] of URL_PARAM_MAP) {
        const el = $(id);
        if (!el) continue;
        const v = String(el.value === undefined || el.value === null ? '' : el.value).trim();
        if (!v) continue;
        params.set(key, v);
      }
      params.set('mode', mode);
      params.set('period', breakdownView);
      params.set('view', mainView);
      const qs = params.toString();
      const url = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
      window.history.replaceState(null, '', url);
    } catch (e) { /* ignore */ }
  }

  // ---------- Init ----------
  applyParamsFromURL();
  syncVisibility();
  calculateAndRender();
  applyMainView();
})();
