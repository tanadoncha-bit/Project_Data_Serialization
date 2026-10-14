

(function () {
  const player = document.getElementById('course-player');
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-play-video]');
    if (!btn || !player) return;
    player.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(btn.dataset.playVideo) + '?autoplay=1';
    player.title = btn.dataset.title || '';
    document.querySelectorAll('.course-lessons li').forEach(li => li.classList.toggle('is-playing', li.contains(btn)));
    player.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
})();
