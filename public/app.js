// Semsync's browser script, loaded with defer on every page. Everything works without it; it adds the light and dark
// toggle, reveal on scroll, the link guides and hero demo, the account menu, confirmation dialogs, copy buttons, and
// checks and a loading state for the setup form. The theme key matches THEME_KEY in src/views/styles.ts.
(() => {
  const toggle = document.querySelector('[data-theme-toggle]');
  if (toggle) {
    const root = document.documentElement;
    const isDark = () => (root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
    const label = () => toggle.setAttribute('aria-label', isDark() ? 'Switch to light mode' : 'Switch to dark mode');
    label();
    toggle.addEventListener('click', () => {
      root.dataset.theme = isDark() ? 'light' : 'dark';
      try { localStorage.setItem('semsync-theme', root.dataset.theme); } catch {}
      label();
    });
  }

  const io = 'IntersectionObserver' in window;
  document.querySelectorAll('.reveal').forEach((el) => {
    if (!io) return el.classList.add('in');
    const obs = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); }
    }), { rootMargin: '0px 0px -10% 0px' });
    obs.observe(el);
  });
  // A section you jump to ("How it works") is shown at once, so it doesn't slide up under the nav after the jump lands.
  const showTarget = (hash) => {
    const el = hash.length > 1 && document.getElementById(decodeURIComponent(hash.slice(1)));
    const r = el && (el.classList.contains('reveal') ? el : el.closest('.reveal'));
    if (r && !r.classList.contains('in')) { r.style.transition = 'none'; r.classList.add('in'); }
  };
  showTarget(location.hash);
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href*="#"]');
    if (a && a.pathname === location.pathname) showTarget(a.hash);
  }, true);
  const words = io && new IntersectionObserver((entries) => entries.forEach((e) => {
    e.target.classList.toggle('lit', e.isIntersecting || e.boundingClientRect.top < 0);
  }), { rootMargin: '0px 0px -40% 0px' });
  document.querySelectorAll('.tagline .w').forEach((el) => (words ? words.observe(el) : el.classList.add('lit')));

  // Link guides: each one clicks through its steps by itself while it's on screen, until someone picks a step.
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('[data-guide]').forEach((guide) => {
    const screen = guide.querySelector('.guide-screen');
    const cursor = guide.querySelector('.gs-cursor');
    const steps = [...guide.querySelectorAll('[data-go]')];
    let at = 0;
    let timers = [];
    const later = (fn, ms) => timers.push(setTimeout(fn, still ? 0 : ms));
    // Where a target sits inside the screen, from offsets so the dialog's entrance transform doesn't throw it off.
    const point = (el) => {
      let x = el.offsetWidth * 0.55, y = el.offsetHeight * 0.6;
      for (let n = el; n && n !== screen; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
      return [x, y];
    };
    const aim = (instant) => {
      const target = guide.querySelector('[data-target="' + at + '"]');
      if (!target) return;
      const [x, y] = point(target);
      if (instant) cursor.style.transition = 'none';
      cursor.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
      if (instant) { cursor.offsetWidth; cursor.style.transition = ''; }
    };
    const go = (i, instant) => {
      timers.forEach(clearTimeout);
      timers = [];
      at = i;
      guide.dataset.at = String(i);
      guide.classList.remove('copied');
      steps.forEach((s, j) => (j === i ? s.setAttribute('aria-current', 'step') : s.removeAttribute('aria-current')));
      // Let the dialog start opening before measuring, then move, then tap.
      later(() => {
        aim(instant);
        later(() => {
          cursor.classList.remove('tap'); cursor.offsetWidth; cursor.classList.add('tap');
          if (i === steps.length - 1) guide.classList.add('copied');
        }, 850);
      }, i === steps.length - 1 ? 150 : 0);
    };
    steps.forEach((s, i) => s.addEventListener('click', () => { guide.classList.remove('playing'); guide.dataset.stopped = '1'; go(i); }));
    guide.addEventListener('animationend', (e) => {
      if (!e.target.classList.contains('guide-progress') || !guide.classList.contains('playing')) return;
      go((at + 1) % steps.length);
    });
    if ('ResizeObserver' in window) new ResizeObserver(() => aim(true)).observe(screen);
    go(0, true);
    if (still || !io) return;
    new IntersectionObserver((entries) => entries.forEach((e) => {
      guide.classList.toggle('playing', e.isIntersecting && !guide.dataset.stopped);
    }), { threshold: 0.5 }).observe(screen);
  });

  // The hero follows a mouse pointer: it eases toward the target each frame and stops when it gets there.
  const stage = document.querySelector('.showcase');
  const cal = stage && stage.querySelector('.cal');
  if (stage && cal && !still && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let tx = 0, ty = 0, x = 0, y = 0, frame = 0;
    const step = () => {
      x += (tx - x) * 0.08;
      y += (ty - y) * 0.08;
      stage.style.setProperty('--gx', x.toFixed(3));
      stage.style.setProperty('--gy', y.toFixed(3));
      frame = Math.abs(tx - x) + Math.abs(ty - y) > 0.002 ? requestAnimationFrame(step) : 0;
    };
    const go = () => { if (!frame) frame = requestAnimationFrame(step); };
    const hero = stage.closest('.hero') || stage;
    hero.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
      const c = cal.getBoundingClientRect();
      stage.style.setProperty('--sx', e.clientX - c.left + 'px');
      stage.style.setProperty('--sy', e.clientY - c.top + 'px');
      stage.style.setProperty('--spot', '1');
      go();
    });
    hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; stage.style.setProperty('--spot', '0'); go(); });
  }

  // The hero demo, looping while it's on screen: the two links go in, Continue, the week fills, the reminder arrives.
  // With reduced motion the finished week stays as it is.
  const demo = document.querySelector('[data-demo]');
  if (demo && !still && io) {
    const fields = [...demo.querySelectorAll('[data-paste]')];
    const button = demo.querySelector('.demo-btn');
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const scene = (s) => { demo.dataset.scene = s; };
    let seen = false, playing = false;
    const play = async () => {
      playing = true;
      while (seen && !document.hidden) {
        fields.forEach((f) => { f.classList.remove('focus', 'done'); f.querySelector('.demo-text').textContent = ''; });
        button.classList.remove('pressed');
        scene('paste');
        for (const f of fields) {
          await wait(f === fields[0] ? 350 : 500); f.classList.add('focus');
          await wait(450);
          const text = f.querySelector('.demo-text');
          text.textContent = f.dataset.paste;
          text.scrollLeft = text.scrollWidth; // like a real field, it shows the end of the link
          f.classList.add('done');
          await wait(400); f.classList.remove('focus');
        }
        await wait(400); button.classList.add('pressed');
        await wait(300); scene('fill');
        await wait(1800); scene('remind');
        await wait(4000); scene('reset');
        await wait(700);
      }
      playing = false;
    };
    scene('reset');
    new IntersectionObserver(([e]) => { seen = e.isIntersecting; if (seen && !playing) play(); }, { threshold: 0.25 }).observe(demo);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && seen && !playing) play(); });
  }

  // Tabs: arrow keys move between them, as the ARIA tabs pattern expects.
  document.querySelectorAll('[data-tabs]').forEach((box) => {
    const tabs = [...box.querySelectorAll('[role=tab]')];
    const pick = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus();
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => pick(t));
      t.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (d) { e.preventDefault(); pick(tabs[(i + d + tabs.length) % tabs.length], true); }
      });
    });
    pick(tabs[0]);
  });

  // The account menu opens under its button (it falls back to the top right corner). Browsers without popovers
  // (iOS 16 and older) get the same menu from a click handler and the .open class.
  const menu = document.getElementById('account-menu');
  const avatar = document.querySelector('[popovertarget="account-menu"]');
  const place = () => {
    const r = avatar.getBoundingClientRect();
    menu.style.top = r.bottom + 8 + 'px';
    menu.style.right = Math.max(16, innerWidth - r.right) + 'px';
  };
  if (menu && avatar && 'popover' in HTMLElement.prototype) {
    menu.addEventListener('beforetoggle', (e) => { if (e.newState === 'open') place(); });
  } else if (menu && avatar) {
    avatar.setAttribute('aria-expanded', 'false');
    const set = (open) => { menu.classList.toggle('open', open); avatar.setAttribute('aria-expanded', String(open)); if (open) place(); };
    avatar.addEventListener('click', (e) => { e.stopPropagation(); set(!menu.classList.contains('open')); });
    document.addEventListener('click', (e) => { if (!menu.contains(e.target)) set(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  }

  // "Delete my data" opens a confirmation dialog; without JavaScript the link goes to the same confirmation as a page.
  document.querySelectorAll('[data-confirm]').forEach((link) => {
    const dialog = document.getElementById(link.dataset.confirm);
    if (!dialog || typeof dialog.showModal !== 'function') return;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const owner = link.closest('[popover]'); // close the account menu first
      if (owner) { owner.classList.remove('open'); if (owner.hidePopover && owner.matches(':popover-open')) owner.hidePopover(); }
      dialog.showModal();
    });
    dialog.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => dialog.close()));
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); }); // a click on the dimmed page
  });

  const busy = (form, label, submitter) => {
    const button = submitter && submitter.classList.contains('btn') ? submitter : form.querySelector('button.btn[type=submit]');
    if (!button) return;
    button.setAttribute('aria-busy', 'true');
    button.textContent = label;
  };
  document.querySelectorAll('form[data-busy-label]:not([data-setup])').forEach((f) => f.addEventListener('submit', (e) => busy(f, f.dataset.busyLabel, e.submitter)));

  // The subscribe link: Copy puts it on the clipboard (or selects it, where that's not allowed), and a click selects it.
  document.querySelectorAll('[data-select]').forEach((input) => input.addEventListener('focus', () => input.select()));
  document.querySelectorAll('[data-copy]').forEach((button) => button.addEventListener('click', async () => {
    const input = document.getElementById(button.dataset.copy);
    const label = button.querySelector('span');
    let copied = false;
    try {
      await navigator.clipboard.writeText(input.value);
      copied = true;
    } catch {
      // Some browsers refuse the clipboard API: fall back to the older copy command on the selected link.
      input.focus();
      input.select();
      try { copied = document.execCommand('copy'); } catch { copied = false; }
    }
    if (copied) {
      label.textContent = 'Copied';
      setTimeout(() => { label.textContent = 'Copy link'; }, 1800);
    }
  }));

  const setup = document.querySelector('form[data-setup]');
  if (!setup) return;
  const canvas = setup.elements.namedItem('canvas');
  const nusmods = setup.elements.namedItem('nusmods');
  const show = (input, message) => {
    const box = document.getElementById(input.id + '-error');
    box.querySelector('span').textContent = message || '';
    box.hidden = !message;
    if (message) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
  };
  [canvas, nusmods].forEach((input) => input.addEventListener('input', () => show(input, '')));
  setup.addEventListener('submit', (event) => {
    const c = canvas.value.trim();
    const n = nusmods.value.trim();
    const errors = [];
    const sample = setup.dataset.dev === '1' && c === 'sample';
    if (c && !sample && !/^(https|webcals?):\/\/[^\/\s]+\/feeds\/calendars\/\S+\.ics$/i.test(c)) {
      errors.push([canvas, "That isn't a Canvas calendar feed link. It should end in .ics."]);
    }
    if (!c && !n && setup.dataset.keepCanvas !== '1') errors.push([canvas, 'Paste your Canvas calendar feed link to get started.']);
    if (n && !/^https:\/\/(www\.)?nusmods\.com\/timetable\/sem-[12]\/share\?/i.test(n)) {
      errors.push([nusmods, 'Use the Share/Sync link from your Semester 1 or Semester 2 timetable on NUSMods.']);
    }
    show(canvas, '');
    show(nusmods, '');
    errors.forEach(([input, message]) => show(input, message));
    if (errors.length) {
      event.preventDefault();
      errors[0][0].focus();
      return;
    }
    busy(setup, setup.dataset.busyLabel, event.submitter);
    const panel = document.querySelector('[data-loading]');
    if (panel) panel.hidden = false;
  });
})();
