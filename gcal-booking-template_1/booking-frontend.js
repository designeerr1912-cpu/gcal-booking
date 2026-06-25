// ─── Вставь этот скрипт в конец HTML перед </body> ───────────────────────────
// Замени SERVER_URL на свой Railway URL

const SERVER_URL = 'https://ВАШ-ПРОЕКТ.railway.app';

(function () {
  const form      = document.querySelector('.booking-form') || document.querySelector('form');
  const masterSel = form?.querySelector('[name="master"]');
  const serviceSel= form?.querySelector('[name="service"]');
  const dateSel   = form?.querySelector('[name="date"]');
  const timeSel   = form?.querySelector('[name="time"]');
  const btn       = form?.querySelector('button[type="submit"]');

  if (!form) return;

  // ── 1. Загружаем мастеров и заполняем селект ───────────────────────────────
  async function loadMasters() {
    try {
      const res  = await fetch(`${SERVER_URL}/masters`);
      const data = await res.json();
      if (!data.ok) return;

      masterSel.innerHTML = '<option value="">— Выберите мастера —</option>';
      data.masters.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = `${m.name} · ${m.role}`;
        opt.dataset.services = JSON.stringify(m.services);
        masterSel.appendChild(opt);
      });
    } catch (e) {
      console.error('Ошибка загрузки мастеров:', e);
    }
  }

  // ── 2. При выборе мастера обновляем список услуг ───────────────────────────
  masterSel?.addEventListener('change', function () {
    const selected = this.options[this.selectedIndex];
    const services = JSON.parse(selected.dataset.services || '[]');

    if (serviceSel) {
      serviceSel.innerHTML = '<option value="">— Выберите услугу —</option>';
      services.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        serviceSel.appendChild(opt);
      });
    }

    // Сбрасываем слоты времени
    if (timeSel) {
      timeSel.innerHTML = '<option value="">— Сначала выберите дату —</option>';
    }

    // Если дата уже выбрана — грузим слоты
    if (dateSel?.value) loadSlots();
  });

  // ── 3. При выборе даты или услуги грузим слоты ────────────────────────────
  function onDateOrServiceChange() {
    if (masterSel?.value && dateSel?.value) loadSlots();
  }
  dateSel?.addEventListener('change', onDateOrServiceChange);
  serviceSel?.addEventListener('change', onDateOrServiceChange);

  // ── 4. Загрузка слотов с сервера ──────────────────────────────────────────
  async function loadSlots() {
    const masterId = masterSel?.value;
    const date     = dateSel?.value;
    const service  = serviceSel?.value;

    if (!masterId || !date) return;

    timeSel.innerHTML = '<option value="">Загружаем слоты...</option>';
    timeSel.disabled = true;

    try {
      const url = `${SERVER_URL}/slots?masterId=${masterId}&date=${date}&service=${encodeURIComponent(service || '')}`;
      const res  = await fetch(url);
      const data = await res.json();

      if (!data.ok) throw new Error(data.error);

      const freeSlots = data.slots.filter(s => s.free);

      timeSel.innerHTML = freeSlots.length
        ? '<option value="">— Выберите время —</option>'
        : '<option value="">Нет свободного времени</option>';

      freeSlots.forEach(slot => {
        const opt = document.createElement('option');
        opt.value = slot.time;
        opt.textContent = slot.time;
        timeSel.appendChild(opt);
      });

      timeSel.disabled = false;

    } catch (e) {
      timeSel.innerHTML = '<option value="">Ошибка загрузки — попробуйте снова</option>';
      timeSel.disabled = false;
      console.error('Ошибка загрузки слотов:', e);
    }
  }

  // ── 5. Отправка формы ─────────────────────────────────────────────────────
  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const data = {
      name:     form.querySelector('[name="name"]')?.value,
      phone:    form.querySelector('[name="phone"]')?.value,
      service:  serviceSel?.value,
      masterId: masterSel?.value,
      date:     dateSel?.value,
      time:     timeSel?.value,
      comment:  form.querySelector('[name="comment"]')?.value || '',
    };

    // Простая валидация
    if (!data.name || !data.phone || !data.service || !data.masterId || !data.date || !data.time) {
      showMessage('Пожалуйста, заполните все поля', 'error');
      return;
    }

    btn.textContent = 'Записываем...';
    btn.disabled = true;

    try {
      const res    = await fetch(`${SERVER_URL}/booking`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });
      const result = await res.json();

      if (result.ok) {
        showMessage(result.message, 'success');
        form.reset();
        if (timeSel) timeSel.innerHTML = '<option value="">— Сначала выберите дату —</option>';
        btn.textContent = '✓ Готово!';
        setTimeout(() => {
          btn.textContent = 'Записаться';
          btn.disabled = false;
        }, 3000);
      } else {
        throw new Error(result.error);
      }

    } catch (err) {
      showMessage(err.message || 'Ошибка. Попробуйте ещё раз.', 'error');
      btn.textContent = 'Записаться';
      btn.disabled = false;
    }
  });

  // ── 6. Показываем сообщение пользователю ──────────────────────────────────
  function showMessage(text, type) {
    let msg = form.querySelector('.booking-message');
    if (!msg) {
      msg = document.createElement('div');
      msg.className = 'booking-message';
      msg.style.cssText = 'margin-top:12px;padding:10px 14px;border-radius:6px;font-size:13px;font-weight:500;';
      form.appendChild(msg);
    }
    msg.textContent = text;
    msg.style.background = type === 'success' ? '#EAF3DE' : '#FCEBEB';
    msg.style.color       = type === 'success' ? '#27500A' : '#890202';
    setTimeout(() => { if (msg) msg.remove(); }, 5000);
  }

  // ── Инициализация ──────────────────────────────────────────────────────────
  loadMasters();

  // Минимальная дата — сегодня
  if (dateSel) {
    const today = new Date().toISOString().split('T')[0];
    dateSel.min = today;
    dateSel.value = today;
  }

})();
