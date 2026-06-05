// ── Mobile nav toggle ──
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');
if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
}

// ── Records tabs ──
document.querySelectorAll('[data-tab-btn]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-tab-btn');
    document.querySelectorAll('[data-tab-btn]').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('[data-tab-content]').forEach((c) => c.classList.remove('active'));
    btn.classList.add('active');
    const content = document.querySelector(`[data-tab-content="${target}"]`);
    if (content) content.classList.add('active');
  });
});

// ── Countdown ──
const countdownEl = document.getElementById('countdown');
if (countdownEl) {
  const raceISO = countdownEl.getAttribute('data-race');
  const raceTime = raceISO ? new Date(raceISO).getTime() : 0;
  const elDays = document.getElementById('cd-days');
  const elHours = document.getElementById('cd-hours');
  const elMins = document.getElementById('cd-mins');
  const elSecs = document.getElementById('cd-secs');

  const update = () => {
    const diff = raceTime - Date.now();
    if (diff <= 0) {
      countdownEl.innerHTML =
        '<span style="font-family:Oswald,sans-serif;font-size:1rem;letter-spacing:0.2em;color:var(--green);text-transform:uppercase;">Race Day Is Here!</span>';
      return false;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    if (elDays) elDays.textContent = String(d).padStart(2, '0');
    if (elHours) elHours.textContent = String(h).padStart(2, '0');
    if (elMins) elMins.textContent = String(m).padStart(2, '0');
    if (elSecs) elSecs.textContent = String(s).padStart(2, '0');
    return true;
  };

  if (raceTime) {
    update();
    const interval = setInterval(() => {
      if (!update()) clearInterval(interval);
    }, 1000);
  }
}

// ── Scroll reveal ──
const revealEls = document.querySelectorAll('.reveal');
if (revealEls.length) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          observer.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  revealEls.forEach((el) => observer.observe(el));
}

// ── Active nav highlight on scroll ──
const sectionsAll = document.querySelectorAll('section[id], #home');
const navAnchors = document.querySelectorAll('.nav-links a');
if (sectionsAll.length && navAnchors.length) {
  window.addEventListener('scroll', () => {
    let current = '';
    sectionsAll.forEach((s) => {
      if (window.scrollY >= s.offsetTop - 80) current = s.id;
    });
    navAnchors.forEach((a) => {
      a.style.color = a.getAttribute('href') === '#' + current ? 'var(--green)' : '';
    });
  });
}
