(() => {
  const data = JSON.parse(document.getElementById('dashboard-data').textContent);
  const period = document.getElementById('revenue-period');
  period.addEventListener('change', () => {
    const entries = data.periods[period.value];
    document.querySelectorAll('.chart-bar').forEach((bar,i) => {
      bar.style.setProperty('--bar-height', `${entries[i].value / data.chartMax * 100}%`);
      bar.title = `${entries[i].label} ฿${entries[i].value.toLocaleString('th-TH')}`;
    });
    document.querySelectorAll('.chart-day').forEach((label,i) => {label.textContent=entries[i].label;});
    document.getElementById('revenue-comparison').textContent = period.value === 'current' ? data.comparison : 'ยอดขายจากการชำระเงินจริงใน 7 วันก่อนหน้า';
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
