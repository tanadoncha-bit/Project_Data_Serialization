(() => {
  const form = document.getElementById('meal-search');
  const results = document.getElementById('meal-results');
  const status = document.getElementById('meal-status');
  const detail = document.getElementById('meal-detail');
  let searchVersion = 0;
  let detailVersion = 0;
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  async function json(url) {
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'ไม่สามารถโหลดเมนูได้');
    return data;
  }
  async function showDetail(id) {
    const version = ++detailVersion;
    detail.hidden = true;
    status.textContent = 'กำลังโหลดรายละเอียด...';
    try {
      const { meal } = await json(`/api/meals/${encodeURIComponent(id)}`);
      if (version !== detailVersion) return;
      detail.replaceChildren(element('h2', meal.title), element('p', `${meal.category || ''} · ${meal.area || ''}`));
      const ingredients = element('ul');
      meal.ingredients.forEach(item => ingredients.appendChild(element('li', `${item.name} — ${item.amount}`)));
      detail.append(element('h3', 'วัตถุดิบ'), ingredients, element('h3', 'วิธีทำ'), element('p', meal.instructions, 'recipe-description'));
      if (/^https?:\/\//i.test(meal.videoUrl || '')) {
        const link = element('a', 'เปิดวิดีโอ', 'recipe-btn');
        link.href = meal.videoUrl; link.target = '_blank'; link.rel = 'noopener noreferrer';
        detail.appendChild(link);
      }
      detail.hidden = false;
      status.textContent = '';
      detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) { if (version === detailVersion) status.textContent = error.message; }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const version = ++searchVersion;
    ++detailVersion;
    status.textContent = 'กำลังค้นหา...'; results.replaceChildren(); detail.hidden = true;
    try {
      const { meals } = await json(`/api/meals/search?q=${encodeURIComponent(form.elements.q.value.trim())}`);
      if (version !== searchVersion) return;
      status.textContent = meals.length ? `พบ ${meals.length} เมนูจาก TheMealDB` : 'ไม่พบเมนู ลองคำค้นหาอื่น';
      meals.forEach(meal => {
        const card = element('article', '', 'recipe-card');
        if (/^https?:\/\//i.test(meal.image || '')) {
          const image = element('img', '', 'recipe-image'); image.src = meal.image; image.alt = meal.title; image.loading = 'lazy'; card.appendChild(image);
        }
        const body = element('div', '', 'recipe-card-body');
        const button = element('button', 'ดูรายละเอียด', 'recipe-btn'); button.type = 'button'; button.addEventListener('click', () => showDetail(meal.id));
        body.append(element('span', meal.category, 'recipe-tag'), element('h2', meal.title), element('p', meal.area, 'recipe-muted'), button);
        card.appendChild(body); results.appendChild(card);
      });
    } catch (error) { if (version === searchVersion) status.textContent = error.message; }
  });
})();
