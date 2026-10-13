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
  const isImage = src => /^(https?:\/\/|data:image\/)/i.test(src || '');

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
      ? `เรียนทำ ${course.menus.length} เมนูในแพ็กเกจเดียว`
      : `คอร์สเดี่ยว ${course.lessonCount} บทเรียน${course.durationText ? ' · ' + course.durationText : ''}`;
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
    const video = $('#detail-video');
    video.hidden = !/^https?:\/\//i.test(course.videoUrl);
    if (!video.hidden) video.href = course.videoUrl;
    icons();
    openDialog(detail);
  }

  /* ---------- Modal สร้าง / แก้ไขคอร์ส ---------- */
  const formDialog = $('#course-form-dialog');
  const form = $('#course-form');
  const errorsBox = $('#course-form-errors');
  const lessonsSingle = $('[data-panel="single"] [data-lessons]', form);
  const menusBox = $('[data-menus]', form);
  let mode = { type: 'single', editing: null };

  /** เพิ่มแถวบทเรียน 1 แถวลงในกล่อง */
  function addLesson(box, value = '') {
    const row = $('#tpl-lesson').content.firstElementChild.cloneNode(true);
    $('input', row).value = value;
    box.append(row);
    renumber();
    return row;
  }

  /** เพิ่มเมนูย่อย 1 เมนูในแพ็กเกจ */
  function addMenu(menu = { name: '', imageUrl: '', lessons: [''] }) {
    const block = $('#tpl-menu').content.firstElementChild.cloneNode(true);
    $('[data-menu-name]', block).value = menu.name;
    $('[data-menu-image]', block).value = menu.imageUrl;
    const box = $('[data-lessons]', block);
    (menu.lessons.length ? menu.lessons : ['']).forEach(l => addLesson(box, l));
    menusBox.append(block);
    renumber();
    return block;
  }

  /** เรียงเลขบทเรียน/เมนูใหม่ และซ่อนปุ่มลบเมื่อเหลืออันเดียว */
  function renumber() {
    $$('[data-lessons]', form).forEach(box => {
      const rows = $$('.chef-lesson', box);
      rows.forEach((row, i) => {
        $('.chef-lesson-no', row).textContent = i + 1;
        $('[data-remove-lesson]', row).hidden = rows.length === 1;
      });
    });
    const menus = $$('.chef-menu', menusBox);
    menus.forEach((m, i) => {
      $('.chef-menu-no', m).textContent = `เมนูที่ ${i + 1}`;
      $('[data-remove-menu]', m).hidden = menus.length === 1;
    });
  }

  /** สลับแท็บคอร์สเดี่ยว/แพ็กเกจ และเปิด-ปิด required ของช่องที่ซ่อนอยู่ */
  function setType(type) {
    mode.type = type;
    $$('[data-tab]', form).forEach(tab => tab.setAttribute('aria-selected', String(tab.dataset.tab === type)));
    $$('[data-panel]', form).forEach(panel => {
      const on = panel.dataset.panel === type;
      panel.hidden = !on;
      $$('input', panel).forEach(input => { input.disabled = !on; });
    });
    const editing = !!mode.editing;
    $('#course-form-title').textContent = editing ? 'แก้ไขคอร์สเรียน' : type === 'package' ? 'สร้างคอร์สแพ็กเกจ' : 'สร้างคอร์สเรียนใหม่';
  }

  /** เปิดฟอร์ม: course = null คือสร้างใหม่, มีค่าคือแก้ไข */
  function openForm(type, course = null) {
    mode = { type, editing: course };
    form.reset();
    errorsBox.hidden = true;
    lessonsSingle.replaceChildren();
    menusBox.replaceChildren();

    const f = form.elements;
    f.title.value = course ? course.title : '';
    setCategory(course ? course.category : '');
    f.price.value = course ? course.price : '';
    f.videoUrl.value = course ? course.videoUrl : '';
    f.imageUrl.value = course ? course.imageUrl : '';
    f.description.value = course ? course.description : '';
    setDifficulty(course ? course.difficulty : 'EASY');

    (course && course.type === 'single' && course.lessons.length ? course.lessons : ['']).forEach(l => addLesson(lessonsSingle, l));
    const menus = course && course.type === 'package' && course.menus.length ? course.menus : [{ name: '', imageUrl: '', lessons: [''] }];
    menus.forEach(m => addMenu(m));

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
    const addBtn = e.target.closest('[data-add-lesson]');
    if (addBtn) {
      const box = $('[data-lessons]', addBtn.closest('.chef-menu') || addBtn.closest('[data-panel]'));
      $('input', addLesson(box)).focus();
    }
    if (e.target.closest('[data-remove-lesson]')) { e.target.closest('.chef-lesson').remove(); renumber(); }
    if (e.target.closest('[data-add-menu]')) {
      const block = addMenu();
      block.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      $('[data-menu-name]', block).focus({ preventScroll: true });
    }
    if (e.target.closest('[data-remove-menu]')) { e.target.closest('.chef-menu').remove(); renumber(); }
  });

  /* ---------- dropdown แบบกำหนดเอง (หมวดหมู่ / ระดับความยาก) ให้หน้าตาเหมือนกันทุกเบราว์เซอร์ ---------- */
  const selects = $$('.chef-select', form);

  /** ตั้งค่าที่เลือกของ dropdown: เก็บใน hidden input + ติ๊กถูก + แสดงชื่อบนปุ่ม */
  function setSelect(box, value) {
    const items = $$('li', box);
    const item = items.find(li => li.dataset.value === value) || items[0];
    $('input', box).value = item.dataset.value;
    items.forEach(li => li.classList.toggle('selected', li === item));
    $('.chef-select-btn > span', box).textContent = item.dataset.label;
  }
  const setDifficulty = value => setSelect($('#difficulty-select'), value);
  const setCategory = value => setSelect($('#category-select'), value);

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
    const lessonsOf = box => $$('.chef-lesson input', box).map(i => i.value.trim()).filter(Boolean);
    return {
      _csrf: page.csrfToken, type: mode.type,
      title: f.title.value, category: f.category.value, difficulty: f.difficulty.value,
      price: f.price.value, videoUrl: f.videoUrl.value, imageUrl: f.imageUrl.value, description: f.description.value,
      lessons: mode.type === 'single' ? lessonsOf(lessonsSingle) : [],
      menus: mode.type === 'package' ? $$('.chef-menu', menusBox).map(m => ({
        name: $('[data-menu-name]', m).value, imageUrl: $('[data-menu-image]', m).value, lessons: lessonsOf(m),
      })) : [],
    };
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
      if (!res.ok) throw new Error(res.status === 403 ? 'ฟอร์มหมดอายุ กรุณารีเฟรชหน้าแล้วลองใหม่' : 'บันทึกไม่สำเร็จ กรุณาลองใหม่');
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
    const warn = $('#delete-warning');
    warn.hidden = !course.students;
    warn.textContent = course.students ? `คอร์สนี้มีผู้ซื้อแล้ว ${course.students} คน จึงลบไม่ได้` : '';
    $('#delete-confirm').disabled = !!course.students;
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
