(() => {
  const data = JSON.parse(document.getElementById('dashboard-data').textContent);
  const period = document.getElementById('revenue-period');
  const picker = document.querySelector('.period-picker');
  const trigger = picker.querySelector('.period-trigger');
  const menu = picker.querySelector('.period-menu');
  const closePeriod = () => { menu.hidden = true; trigger.setAttribute('aria-expanded', 'false'); };
  trigger.addEventListener('click', () => {
    menu.hidden = !menu.hidden;
    trigger.setAttribute('aria-expanded', String(!menu.hidden));
    if (!menu.hidden) menu.querySelector('[aria-pressed="true"]').focus();
  });
  menu.querySelectorAll('[data-period]').forEach(option => option.addEventListener('click', () => {
    period.value = option.dataset.period;
    trigger.querySelector('span').textContent = option.textContent;
    menu.querySelectorAll('[data-period]').forEach(item => item.setAttribute('aria-pressed', String(item === option)));
    period.dispatchEvent(new Event('change'));
    closePeriod(); trigger.focus();
  }));
  document.addEventListener('click', event => { if (!picker.contains(event.target)) closePeriod(); });
  picker.addEventListener('keydown', event => {
    if (event.key === 'Escape') { closePeriod(); trigger.focus(); }
    if (!menu.hidden && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      const options = [...menu.querySelectorAll('button')];
      const index = options.indexOf(document.activeElement);
      options[(index + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length].focus();
    }
  });
  period.addEventListener('change', () => {
    const entries = data.periods[period.value];
    document.querySelectorAll('.chart-bar').forEach((bar,i) => {
      bar.style.setProperty('--bar-height', `${entries[i].value / data.chartMax * 100}%`);
      bar.title = `${entries[i].label} ฿${entries[i].value.toLocaleString('th-TH')}`;
    });
    document.querySelectorAll('.chart-day').forEach((label,i) => {label.textContent=entries[i].label;});
    document.getElementById('revenue-description').textContent = entries.map(d=>`${d.label}: ${d.value.toLocaleString('th-TH')} บาท`).join(', ');
  });
  const button = document.getElementById('toggle-orders');
  if (!document.querySelector('.extra-order')) button.hidden = true;
  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') !== 'true';
    document.querySelectorAll('.extra-order').forEach(row => { row.hidden = !expanded; });
    button.setAttribute('aria-expanded', String(expanded));
    button.textContent = expanded ? 'แสดงน้อยลง ↑' : 'ดูเพิ่ม (สูงสุด 50 รายการ) →';
  });
})();
