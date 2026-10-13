// chefCourses.js — หน้าจัดการคอร์สของเชฟ: modal รายละเอียด / สร้าง-แก้ไข / ลบ และช่องค้นหา
// ข้อมูลคอร์สทั้งหมดมาจาก <script id="course-data"> ที่เซิร์ฟเวอร์ใส่ไว้ในหน้า (ดึงจาก MongoDB)
(() => {
  const page = JSON.parse(document.getElementById('course-data').textContent);
  const courses = new Map(page.courses.map(c => [`${c.type}:${c.id}`, c]));
  const levelText = { EASY: 'ง่าย', MEDIUM: 'ปานกลาง', HARD: 'ยาก' };
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const icons = () => window.lucide && window.lucide.createIcons();
  const baht = n => '฿' + Number(n || 0).toLocaleString('en-US');
  const isImage = src => /^(https?:\/\/|data:image\/|\/uploads\/)/i.test(src || '');

  /* ---------- เปิด/ปิด dialog ---------- */

  /** เปิด dialog และล็อกการเลื่อนหน้าหลัง */
  function openDialog(dialog) {
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('chef-modal-open');
  }
  $$('dialog.chef-dialog').forEach(dialog => {
    dialog.addEventListener('close', () => {
      if (!$('dialog[open]')) document.body.classList.remove('chef-modal-open');
    });
    // คลิกพื้นหลังมืดนอกกล่อง = ปิด
    dialog.addEventListener('click', e => {
      if (e.target === dialog) {
        const r = dialog.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
      }
      if (e.target.closest('[data-close]')) dialog.close();
    });
  });

  /** สร้างรูปย่อ (หรือไอคอนแทนเมื่อไม่มีรูป) */
  function thumb(src, alt, cls = 'chef-thumb') {
    if (isImage(src)) {
      const img = document.createElement('img');
      img.className = cls; img.src = src; img.alt = alt || ''; img.referrerPolicy = 'no-referrer';
      return img;
    }
    const span = document.createElement('span');
    span.className = `${cls} chef-thumb-empty`;
    span.innerHTML = '<i data-lucide="utensils"></i>';
    return span;
  }

  /* ---------- Modal รายละเอียดคอร์ส ---------- */
  const detail = $('#course-detail');

  /** เติมข้อมูลคอร์สลง modal รายละเอียด แล้วเปิด */
  function showDetail(course) {
    const images = $('#detail-images');
    images.replaceChildren();
    const pics = course.type === 'package' && course.menus.length
      ? course.menus.map((m, i) => ({ src: m.imageUrl, title: `${i + 1}. ${m.name}`, sub: `${m.lessons.length} บทเรียน` }))
      : [{ src: course.imageUrl, title: '', sub: '' }];
    pics.forEach(p => {
      const fig = document.createElement('figure');
      fig.className = 'chef-detail-figure';
      fig.append(thumb(p.src, p.title));
      if (p.title) {
        const cap = document.createElement('figcaption');
        const strong = document.createElement('strong'); strong.textContent = p.title;
        const small = document.createElement('small'); small.textContent = p.sub;
        cap.append(strong, small); fig.append(cap);
      }
      images.append(fig);
    });

    const tags = $('#detail-tags');
    tags.replaceChildren();
    [[course.category, 'chef-tag'], course.type === 'package' && ['แพ็กคอร์ส', 'chef-tag chef-tag-gold']]
      .filter(Boolean).forEach(([label, cls]) => {
        const t = document.createElement('span'); t.className = cls; t.textContent = label; tags.append(t);
      });

    $('#detail-title').textContent = course.title;
    $('#detail-sub').textContent = course.type === 'package'
      ? `เรียนทำ ${course.menus.length} เมนูในแพ็กเกจเดียว${course.durationText ? ' · ' + course.durationText : ''}`
      : `อิงสูตร "${course.recipeTitle}" · ${course.lessonCount} บทเรียน${course.durationText ? ' · ' + course.durationText : ''}`;
    $('#detail-level').textContent = levelText[course.difficulty] || '-';
    $('#detail-lessons').textContent = `${course.lessonCount} บทเรียน`;
    $('#detail-students').textContent = `${course.students.toLocaleString('en-US')} คน`;
    $('#detail-desc').textContent = course.description || 'ยังไม่มีคำอธิบายคอร์ส';

    // สิ่งที่จะได้เรียนรู้ = รายชื่อบทเรียน (แพ็กเกจแสดงชื่อเมนูนำหน้า)
    const learn = $('#detail-learn');
    learn.replaceChildren();
    const items = course.type === 'package'
      ? course.menus.flatMap(m => m.lessons.map(l => `${m.name}: ${l}`))
      : course.lessons;
    items.forEach(text => { const li = document.createElement('li'); li.textContent = text; learn.append(li); });

    $('#detail-price').textContent = course.price ? baht(course.price) : 'ฟรี';
    // ลิงก์ไปหน้าคอร์สฝั่งผู้เรียน (routes/courses.js ของทีม)
    $('#detail-link').href = course.type === 'package' ? `/courses/pack/${course.id}` : `/courses/${course.id}`;
    icons();
    openDialog(detail);
  }

  /* ---------- Modal สร้าง / แก้ไขคอร์ส ---------- */
  const formDialog = $('#course-form-dialog');
  const form = $('#course-form');
  const errorsBox = $('#course-form-errors');
  const lessonsBox = $('[data-panel="single"] [data-lessons]', form);
  let mode = { type: 'single', editing: null };

  /** เพิ่มแถวบทเรียน 1 แถว (ชื่อ / ลิงก์วิดีโอ / นาที) */
  function addLesson(video = { title: '', videoUrl: '', duration: '' }) {
    const row = $('#tpl-lesson').content.firstElementChild.cloneNode(true);
    $('[data-video-title]', row).value = video.title || '';
    $('[data-video-url]', row).value = video.videoUrl || '';
    $('[data-video-duration]', row).value = video.duration ?? '';
    lessonsBox.append(row);
    renumber();
    return row;
  }

  /** เรียงเลขบทเรียนใหม่ และซ่อนปุ่มลบเมื่อเหลือบทเดียว */
  function renumber() {
    const rows = $$('.chef-lesson', lessonsBox);
    rows.forEach((row, i) => {
      $('.chef-lesson-no', row).textContent = i + 1;
      $('[data-remove-lesson]', row).hidden = rows.length === 1;
    });
  }

  /** อัปเดตจำนวนคอร์สที่เลือก + ราคารวม เพื่อช่วยตั้งราคาแพ็กเกจ */
  function updatePackSummary() {
    const picked = $$('[name=includedCourses]:checked', form);
    const count = $('#pack-count');
    if (count) count.textContent = `เลือกแล้ว ${picked.length} คอร์ส`;
    const sum = $('#pack-sum');
    if (sum) {
      const total = picked.reduce((s, c) => s + Number(c.dataset.price || 0), 0);
      sum.textContent = picked.length ? `ราคารวมถ้าซื้อแยก ${baht(total)} — ตั้งราคาแพ็กเกจให้ต่ำกว่านี้เพื่อจูงใจผู้เรียน` : '';
    }
  }
  form.addEventListener('change', e => { if (e.target.name === 'includedCourses') updatePackSummary(); });

  /** สลับแท็บคอร์สเดี่ยว/แพ็กเกจ และปิดช่องของแท็บที่ซ่อน (ไม่ให้ติด required) */
  function setType(type) {
    mode.type = type;
    $$('[data-tab]', form).forEach(tab => tab.setAttribute('aria-selected', String(tab.dataset.tab === type)));
    $$('[data-panel]', form).forEach(panel => {
      const on = panel.dataset.panel === type;
      panel.hidden = !on;
      $$('input, button', panel).forEach(el => { el.disabled = !on; });
    });
    const editing = !!mode.editing;
    $('#course-form-title').textContent = editing ? 'แก้ไขคอร์สเรียน' : type === 'package' ? 'สร้างคอร์สแพ็กเกจ' : 'สร้างคอร์สเรียนใหม่';
  }

  /** เปิดฟอร์ม: course = null คือสร้างใหม่, มีค่าคือแก้ไข */
  function openForm(type, course = null) {
    mode = { type, editing: course };
    form.reset();
    errorsBox.hidden = true;
    lessonsBox.replaceChildren();

    const f = form.elements;
    f.title.value = course ? course.title : '';
    f.price.value = course ? course.price : '';
    f.description.value = course ? course.description : '';
    setRecipe(course && course.type === 'single' ? course.recipeId : '');

    (course && course.type === 'single' && course.videos.length ? course.videos : [undefined]).forEach(v => addLesson(v));

    const picked = new Set(course && course.type === 'package' ? course.includedIds.map(String) : []);
    $$('[name=includedCourses]', form).forEach(c => { c.checked = picked.has(c.value); });
    updatePackSummary();

    // ตอนแก้ไขเปลี่ยนประเภทคอร์สไม่ได้ จึงซ่อนแท็บอีกฝั่ง
    $$('[data-tab]', form).forEach(tab => { tab.hidden = !!course && tab.dataset.tab !== type; });
    $('.chef-tabs', form).classList.toggle('single-tab', !!course);
    $('#course-form-sub').textContent = course ? 'แก้ไขรายละเอียดคอร์สและจัดการบทเรียนของคุณ' : 'กรอกรายละเอียดคอร์ส และสร้างบทเรียนให้ครบตามเมนูอาหาร';
    $('#course-submit').textContent = course ? 'บันทึกการแก้ไข' : 'สร้างคอร์สเรียน';
    $('#course-submit').disabled = false;
    setType(type);
    icons();
    openDialog(formDialog);
    formDialog.scrollTop = 0;
    f.title.focus({ preventScroll: true });
  }

  form.addEventListener('click', e => {
    const tab = e.target.closest('[data-tab]');
    if (tab && !mode.editing) setType(tab.dataset.tab);
    if (e.target.closest('[data-add-lesson]')) $('[data-video-title]', addLesson()).focus();
    if (e.target.closest('[data-remove-lesson]')) { e.target.closest('.chef-lesson').remove(); renumber(); }
  });

  /* ---------- dropdown แบบกำหนดเอง (หมวดหมู่ / ระดับความยาก) ให้หน้าตาเหมือนกันทุกเบราว์เซอร์ ---------- */
  const selects = $$('.chef-select', form);

  /** ตั้งค่าที่เลือกของ dropdown: เก็บใน hidden input + ติ๊กถูก + แสดงชื่อบนปุ่ม */
  function setSelect(box, value) {
    const items = $$('li', box);
    const item = items.find(li => li.dataset.value === String(value)) || items[0];
    $('input', box).value = item.dataset.value;
    items.forEach(li => li.classList.toggle('selected', li === item));
    $('.chef-select-btn > span', box).textContent = item.dataset.label;
  }
  /** เลือกสูตรตั้งต้น ('' = ยังไม่เลือก) */
  function setRecipe(value) {
    const box = $('#recipe-select');
    if (!box) return;
    if (value === '' || value == null) {
      $('input', box).value = '';
      $$('li', box).forEach(li => li.classList.remove('selected'));
      $('.chef-select-btn > span', box).textContent = 'เลือกสูตรอาหาร';
    } else setSelect(box, String(value));
  }

  /** เปิด/ปิดรายการตัวเลือก (เปิดอันหนึ่งจะปิดอันอื่นให้) */
  function toggleSelect(box, open) {
    const list = $('.chef-select-list', box);
    if (open) selects.filter(other => other !== box).forEach(other => toggleSelect(other, false));
    list.hidden = !open;
    $('.chef-select-btn', box).setAttribute('aria-expanded', String(open));
    if (open) ($('li.selected', list) || $('li', list)).focus();
  }

  selects.forEach(box => {
    const btn = $('.chef-select-btn', box);
    const list = $('.chef-select-list', box);
    btn.addEventListener('click', () => toggleSelect(box, list.hidden));
    list.addEventListener('click', e => {
      const li = e.target.closest('li');
      if (li) { setSelect(box, li.dataset.value); toggleSelect(box, false); btn.focus(); }
    });
    list.addEventListener('keydown', e => {
      const items = $$('li', list);
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[Math.min(i + 1, items.length - 1)].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); items[Math.max(i - 1, 0)].focus(); }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.activeElement.click(); }
      if (e.key === 'Escape' || e.key === 'Tab') {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); }
        toggleSelect(box, false); btn.focus();
      }
    });
  });
  // คลิกนอก dropdown = ปิด
  document.addEventListener('click', e => {
    selects.forEach(box => { if (!box.contains(e.target)) toggleSelect(box, false); });
  });

  /** รวมค่าจากฟอร์มเป็น JSON ตามที่ routes/chef.js ต้องการ */
  function collect() {
    const f = form.elements;
    const data = { _csrf: page.csrfToken, type: mode.type, title: f.title.value, price: f.price.value, description: f.description.value };
    if (mode.type === 'single') {
      data.baseRecipe = f.baseRecipe ? f.baseRecipe.value : '';
      data.videos = $$('.chef-lesson', lessonsBox).map(row => ({
        title: $('[data-video-title]', row).value,
        videoUrl: $('[data-video-url]', row).value,
        duration: $('[data-video-duration]', row).value,
      }));
    } else {
      data.includedCourses = $$('[name=includedCourses]:checked', form).map(c => c.value);
    }
    return data;
  }

  /** แสดงข้อความ error จากเซิร์ฟเวอร์ด้านบนฟอร์ม */
  function showErrors(list) {
    errorsBox.replaceChildren(...list.map(msg => { const d = document.createElement('div'); d.textContent = msg; return d; }));
    errorsBox.hidden = false;
    errorsBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const submit = $('#course-submit');
    submit.disabled = true;
    const url = mode.editing ? `/chef/courses/${mode.editing.type}/${mode.editing.id}` : '/chef/courses';
    try {
      const res = await fetch(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(collect()),
      });
      if (res.status === 422) { showErrors((await res.json()).errors); submit.disabled = false; return; }
      if (!res.ok) {
        // แสดงสาเหตุจาก server (errorHandler ตอบ { error }) ถ้าไม่มีค่อยใช้ข้อความกลาง
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || (res.status === 403 ? 'ฟอร์มหมดอายุ กรุณารีเฟรชหน้าแล้วลองใหม่' : `บันทึกไม่สำเร็จ (รหัส ${res.status}) กรุณาลองใหม่`));
      }
      window.location.assign((await res.json()).location);
    } catch (err) {
      showErrors([err.message]);
      submit.disabled = false;
    }
  });

  /* ---------- Modal ยืนยันการลบ ---------- */
  const del = $('#course-delete');
  let pendingDelete = null;

  document.addEventListener('submit', e => {
    const delForm = e.target.closest('[data-delete-course]');
    if (!delForm) return;
    e.preventDefault();
    const course = courses.get(delForm.dataset.deleteCourse);
    pendingDelete = delForm;
    $('#delete-thumb').replaceChildren(thumb(course.imageUrl, course.title));
    $('#delete-name').textContent = course.title;
    $('#delete-desc').textContent = course.description || '';
    // กันลบไว้ 2 กรณี (เซิร์ฟเวอร์ก็เช็คซ้ำ): มีผู้ซื้อแล้ว / คอร์สเดี่ยวที่ยังอยู่ในแพ็กเกจ
    const packs = course.type === 'single'
      ? page.courses.filter(c => c.type === 'package' && c.includedIds.includes(course.id)).map(c => c.title)
      : [];
    const reason = course.students ? `คอร์สนี้มีผู้ซื้อแล้ว ${course.students} คน จึงลบไม่ได้`
      : packs.length ? `คอร์สนี้อยู่ในแพ็กเกจ "${packs.join('", "')}" ให้เอาออกจากแพ็กเกจก่อน` : '';
    const warn = $('#delete-warning');
    warn.hidden = !reason;
    warn.textContent = reason;
    $('#delete-confirm').disabled = !!reason;
    icons();
    openDialog(del);
    $('[data-close]', $('.chef-delete-actions')).focus();
  });
  $('#delete-confirm').addEventListener('click', () => {
    if (!pendingDelete) return;
    $('#delete-confirm').disabled = true;
    pendingDelete.submit();
  });

  /* ---------- ปุ่มต่างๆ บนหน้า ---------- */
  document.addEventListener('click', e => {
    const view = e.target.closest('[data-view-course]');
    if (view) showDetail(courses.get(view.dataset.viewCourse));
    const edit = e.target.closest('[data-edit-course]');
    if (edit) { const c = courses.get(edit.dataset.editCourse); openForm(c.type, c); }
    const create = e.target.closest('[data-new-course]');
    if (create) openForm(create.dataset.newCourse);
  });

  /* ---------- ค้นหาคอร์สในหน้า ---------- */
  const search = $('#course-search');
  if (search) {
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      let shown = 0;
      $$('.chef-course-card').forEach(card => {
        const hit = !q || card.dataset.search.includes(q);
        card.hidden = !hit;
        if (hit) shown++;
      });
      $('#course-no-match').hidden = shown > 0;
    });
  }

  // ลิงก์ /chef/courses?new=single หรือ ?new=package (เช่นปุ่มจาก Dashboard) เปิดฟอร์มทันที
  const params = new URLSearchParams(location.search);
  if (['single', 'package'].includes(params.get('new'))) {
    openForm(params.get('new'));
    history.replaceState(null, '', '/chef/courses');
  }
})();
