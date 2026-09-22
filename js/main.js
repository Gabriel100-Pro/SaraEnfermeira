(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const isMobileViewport = () => window.matchMedia('(max-width: 768px)').matches;

  /* =====================================================================
     ENTRADA DE PÁGINA (fade + leve subida do conteúdo) — index e atendimento
     ===================================================================== */
  function initPageEnter() {
    const main = document.querySelector('.page-main');
    if (!main) return;

    // Ao chegar de outra página (ou dar refresh) com #hash, posiciona a âncora de imediato:
    // a suavidade fica por conta do fade de entrada, sem depender do smooth scroll inicial.
    if (location.hash.length > 1) {
      let target = null;
      try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (e) { target = null; }
      if (target) {
        const html = document.documentElement;
        html.style.scrollBehavior = 'auto';
        target.scrollIntoView({ block: 'start' });
        requestAnimationFrame(() => { html.style.scrollBehavior = ''; });
      }
    }

    requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.add('is-page-ready')));
    // garantia: se algo impedir o frame, o conteúdo aparece mesmo assim
    setTimeout(() => document.documentElement.classList.add('is-page-ready'), 900);
  }

  /* =====================================================================
     ESTADO ATIVO DO MENU (conforme a seção visível na página atual)
     ===================================================================== */
  function initActiveNav() {
    // Header desktop e banner mobile apontam para as mesmas seções
    const links = Array.from(document.querySelectorAll('.nav__link, .menu__link'));
    if (!links.length) return;

    const currentFile = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    const entries = [];
    const homeLinks = [];

    links.forEach((link) => {
      let url;
      try { url = new URL(link.getAttribute('href'), location.href); } catch (e) { return; }
      const file = (url.pathname.split('/').pop() || 'index.html').toLowerCase();
      if (file !== currentFile) return;
      if (!url.hash) { homeLinks.push(link); return; }
      const target = document.getElementById(url.hash.slice(1));
      if (target) entries.push({ link, target });
    });

    if (!entries.length && !homeLinks.length) return;

    let ticking = false;
    const update = () => {
      ticking = false;
      const probe = window.innerHeight * 0.4;
      let section = null;
      entries.forEach((entry) => {
        const rect = entry.target.getBoundingClientRect();
        if (rect.top <= probe && rect.bottom > probe) section = entry.target;
      });
      const atTop = !section && window.scrollY < window.innerHeight * 0.6;
      links.forEach((link) => link.classList.remove('is-active'));
      if (section) entries.forEach((entry) => { if (entry.target === section) entry.link.classList.add('is-active'); });
      else if (atTop) homeLinks.forEach((link) => link.classList.add('is-active'));
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  /* =====================================================================
     ENTRADA DA HERO (logo → menu → linha → título → subtítulo → botão)
     ===================================================================== */
  function initHeroEntrance() {
    if (!document.querySelector('.hero')) {
      // Sem Hero nesta página: apenas revela logo e menu
      document.body.classList.add('is-loaded', 'is-settled');
      return;
    }
    const start = () => {
      document.body.classList.add('is-loaded');
      // Depois da sequência, libera o botão para responder ao hover sem delay
      setTimeout(() => document.body.classList.add('is-settled'), 2200);
    };

    if (prefersReducedMotion.matches) {
      start();
      return;
    }

    // Aguarda as fontes (com limite) para evitar troca de fonte no meio da animação
    let started = false;
    const go = () => { if (!started) { started = true; requestAnimationFrame(() => setTimeout(start, 80)); } };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(go);
    setTimeout(go, 700);
  }

  /* =====================================================================
     HEADER (sólido ao rolar) + MENU MOBILE (banner central)
     O menu mobile é um diálogo modal centralizado: overlay desfocado +
     banner com a logo e os mesmos links do header. O header desktop não
     participa deste fluxo (o banner só existe em telas <= 768px).
     ===================================================================== */
  function initHeader() {
    const header = document.getElementById('header');
    const menu = document.getElementById('mobileMenu');
    const toggle = document.querySelector('.nav-toggle');
    if (!header) return;

    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    if (!menu || !toggle) return;

    const panel = menu.querySelector('.menu__panel');
    const overlay = menu.querySelector('.menu__overlay');
    const links = Array.from(menu.querySelectorAll('.menu__link'));
    const desktopMq = window.matchMedia('(min-width: 769px)');

    const isOpen = () => menu.classList.contains('is-open');

    /* Elementos focáveis dentro do banner (base do focus trap) */
    const focusables = () => Array.from(
      panel.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
    ).filter((el) => el.offsetWidth || el.offsetHeight || el.getClientRects().length);

    const setOpen = (open, restoreFocus) => {
      if (open === isOpen()) return;
      menu.classList.toggle('is-open', open);
      document.body.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');

      if (open) {
        // Foco no primeiro link assim que o banner começa a aparecer
        const first = focusables()[0];
        if (first) first.focus({ preventScroll: true });
      } else if (restoreFocus !== false && panel.contains(document.activeElement)) {
        toggle.focus();
      }
    };

    const close = (restoreFocus) => setOpen(false, restoreFocus);

    // 1. botão hambúrguer
    toggle.addEventListener('click', () => setOpen(!isOpen()));

    // 2. clique no overlay
    overlay.addEventListener('click', () => close());

    // 3. clique em qualquer link (o scroll é liberado antes da navegação)
    links.forEach((link) => link.addEventListener('click', () => close(false)));

    document.addEventListener('keydown', (e) => {
      if (!isOpen()) return;

      // 4. ESC
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }

      // Focus trap: o Tab circula apenas dentro do banner
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (!panel.contains(active)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return; }
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    });

    // 5. navegação para outra âncora/página (inclui volta pelo histórico)
    window.addEventListener('hashchange', () => close(false));
    window.addEventListener('popstate', () => close(false));
    window.addEventListener('pageshow', () => close(false));

    // Volta ao desktop: o banner não existe mais, fecha sem restaurar foco
    desktopMq.addEventListener('change', (e) => { if (e.matches) close(false); });
  }

  /* =====================================================================
     PARALLAX DISCRETO DO FUNDO DA HERO (máx. 40px, desktop apenas)
     ===================================================================== */
  function initParallax() {
    const bg = document.querySelector('.hero__bg');
    const hero = document.querySelector('.hero');
    if (!bg || !hero) return;

    const MAX = 40;
    const FACTOR = 0.08;
    let ticking = false;
    let enabled = false;

    const update = () => {
      ticking = false;
      const y = Math.min(MAX, window.scrollY * FACTOR);
      bg.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
    };

    const onScroll = () => {
      if (window.scrollY > hero.offsetHeight + MAX) return;
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    };

    const enable = () => {
      if (enabled) return;
      enabled = true;
      bg.style.willChange = 'transform';
      window.addEventListener('scroll', onScroll, { passive: true });
      update();
    };
    const disable = () => {
      if (!enabled) return;
      enabled = false;
      window.removeEventListener('scroll', onScroll);
      bg.style.willChange = '';
      bg.style.transform = '';
    };

    const evaluate = () => {
      if (prefersReducedMotion.matches || isMobileViewport()) disable();
      else enable();
    };

    evaluate();
    prefersReducedMotion.addEventListener('change', evaluate);
    window.matchMedia('(max-width: 768px)').addEventListener('change', evaluate);
  }

  /* =====================================================================
     PARALLAX MUITO DISCRETO DO FUNDO DA SEÇÃO "COMO FUNCIONA" (±20px, desktop)
     ===================================================================== */
  function initHowParallax() {
    const section = document.getElementById('como-funciona');
    const bg = section && section.querySelector('.how__bg');
    if (!section || !bg) return;

    const MAX = 20;
    let ticking = false;
    let enabled = false;

    const update = () => {
      ticking = false;
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight;
      if (rect.bottom < 0 || rect.top > vh) return;
      const p = (vh - rect.top) / (vh + rect.height);          // 0 → 1 enquanto a seção atravessa a tela
      const y = (0.5 - Math.min(1, Math.max(0, p))) * 2 * MAX;  // +20px → -20px
      bg.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };

    const evaluate = () => {
      const on = !prefersReducedMotion.matches && !isMobileViewport();
      if (on && !enabled) { enabled = true; window.addEventListener('scroll', onScroll, { passive: true }); update(); }
      if (!on && enabled) { enabled = false; window.removeEventListener('scroll', onScroll); bg.style.transform = ''; }
    };
    evaluate();
    prefersReducedMotion.addEventListener('change', evaluate);
    window.matchMedia('(max-width: 768px)').addEventListener('change', evaluate);
  }

  /* =====================================================================
     PROGRESSO DE LEITURA
     Linha de 2px no topo que cresce com o scroll. Só escreve transform,
     e apenas uma vez por frame.
     ===================================================================== */
  function initScrollProgress() {
    const bar = document.getElementById('scrollProgress');
    if (!bar) return;

    let ticking = false;
    const update = () => {
      ticking = false;
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const p = max > 4 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  /* =====================================================================
     TRANSIÇÃO ENTRE PÁGINAS (index ↔ atendimento)
     O conteúdo recua e some em 280ms antes de a navegação acontecer.
     Links externos (WhatsApp, Instagram), target="_blank", downloads e
     âncoras da própria página seguem o comportamento normal do navegador.
     ===================================================================== */
  function initPageTransition() {
    if (!document.querySelector('.page-main')) return;

    const DURATION = 280;
    const currentFile = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    let leaving = false;

    document.addEventListener('click', (e) => {
      if (leaving || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (prefersReducedMotion.matches) return;

      const link = e.target.closest && e.target.closest('a[href]');
      if (!link || link.hasAttribute('download')) return;
      if (link.target && link.target !== '_self') return;              // abre em nova aba: não atrasa

      const href = link.getAttribute('href') || '';
      if (/^(mailto:|tel:|javascript:|#)/i.test(href)) return;

      let url;
      try { url = new URL(href, location.href); } catch (err) { return; }
      if (url.origin !== location.origin) return;                      // WhatsApp, Instagram, etc.

      const file = (url.pathname.split('/').pop() || 'index.html').toLowerCase();
      if (file === currentFile) return;                                // âncora interna: scroll normal

      e.preventDefault();
      leaving = true;
      document.documentElement.classList.add('is-page-leaving');
      setTimeout(() => { location.href = url.href; }, DURATION);
    });

    // Voltar pelo histórico (inclusive bfcache) devolve a página visível
    window.addEventListener('pageshow', () => {
      leaving = false;
      document.documentElement.classList.remove('is-page-leaving');
    });
  }

  /* =====================================================================
     PARALLAX SUAVE (foto da seção 4 + formas orgânicas dos fundos)
     Um único listener de scroll alimenta todos os alvos dentro de um rAF.
     Amplitude máxima de 14px — profundidade sem que o movimento apareça.
     Desktop apenas.
     ===================================================================== */
  function initSoftParallax() {
    const targets = [];

    const photo = document.querySelector('.who__photo');
    if (photo) targets.push({ el: photo, props: [['--parallax-y', 14]] });

    ['.faq', '.contact'].forEach((selector) => {
      const section = document.querySelector(selector);
      // as duas formas derivam em sentidos opostos, o que cria a sensação de camadas
      if (section) targets.push({ el: section, props: [['--shape-a', -12], ['--shape-b', 9]] });
    });

    if (!targets.length) return;

    let ticking = false;
    let enabled = false;

    const update = () => {
      ticking = false;
      const vh = window.innerHeight;
      targets.forEach((target) => {
        const rect = target.el.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > vh + 200) return;         // fora de cena: nada a fazer
        const p = Math.min(1, Math.max(0, (vh - rect.top) / (vh + rect.height)));
        const q = (0.5 - p) * 2;                                       // +1 (entrando) → -1 (saindo)
        target.props.forEach((prop) => {
          target.el.style.setProperty(prop[0], (q * prop[1]).toFixed(2) + 'px');
        });
      });
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };

    const clear = () => targets.forEach((target) => {
      target.props.forEach((prop) => target.el.style.removeProperty(prop[0]));
    });

    const evaluate = () => {
      const on = !prefersReducedMotion.matches && !isMobileViewport();
      if (on && !enabled) { enabled = true; window.addEventListener('scroll', onScroll, { passive: true }); update(); }
      if (!on && enabled) { enabled = false; window.removeEventListener('scroll', onScroll); clear(); }
    };

    evaluate();
    window.addEventListener('resize', () => { if (enabled) onScroll(); });
    prefersReducedMotion.addEventListener('change', evaluate);
    window.matchMedia('(max-width: 768px)').addEventListener('change', evaluate);
  }

  /* =====================================================================
     FLUTUAÇÃO DO CARD DA SEÇÃO 4
     Movimento de 4px em 6s, ligado só enquanto a seção está na tela para
     não manter uma animação rodando no fundo da página.
     ===================================================================== */
  function initCardFloat() {
    const card = document.querySelector('.who__card');
    const section = document.getElementById('indicado');
    if (!card || !section || prefersReducedMotion.matches || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => card.classList.toggle('is-floating', entry.isIntersecting));
    }, { threshold: 0 });

    observer.observe(section);
  }

  /* =====================================================================
     REVEAL DA SEÇÃO SOBRE MIM (IntersectionObserver, executa uma vez)
     ===================================================================== */
  function initReveal() {
    document.querySelectorAll('[data-reveal]').forEach((section) => {
      const show = () => {
        section.classList.add('is-visible');
        setTimeout(() => section.classList.add('is-settled'), 2400);
      };

      if (prefersReducedMotion.matches || !('IntersectionObserver' in window)) {
        show();
        return;
      }

      const threshold = parseFloat(section.dataset.reveal) || 0.2;
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            show();
            observer.unobserve(entry.target);
          }
        });
      }, { threshold });

      observer.observe(section);
    });
  }

  /* =====================================================================
     CARROSSEL (3 cards visíveis, loop infinito, autoplay 2,3s)
     ===================================================================== */
  class Carousel {
    constructor(root) {
      this.root = root;
      this.viewport = root.querySelector('.carousel__viewport');
      this.slides = Array.from(root.querySelectorAll('.carousel__slide'));
      this.prevBtn = root.querySelector('.carousel__btn--prev');
      this.nextBtn = root.querySelector('.carousel__btn--next');
      this.dotsWrap = root.querySelector('.carousel__dots');

      this.count = this.slides.length;
      this.index = 0;
      this.interval = 2300;
      this.timer = null;
      this.hovering = false;
      this.interacting = false;
      this.lockCheck = null;        // função externa que trava o autoplay (transição para a seção 3)
      this.listeners = [];          // observadores do índice ativo
      this.parkTimer = null;        // devolve o slide que saiu (só no caso de 2 fotos)

      this.buildDots();
      this.bindEvents();
      this.render();
      this.start();
    }

    /* Distância circular do slide i até o ativo, limitada a -2..2 */
    offsetFor(i) {
      let d = ((i - this.index) % this.count + this.count) % this.count; // 0..count-1
      if (d > this.count / 2) d -= this.count;                             // -count/2..count/2
      return Math.max(-2, Math.min(2, d));
    }

    render() {
      this.slides.forEach((slide, i) => {
        let pos = this.offsetFor(i);
        const prev = slide.dataset.pos === undefined ? pos : Number(slide.dataset.pos);
        // Com 2 fotos não existe um terceiro card para ocupar os dois lados:
        // quem deixa o centro sai pela esquerda e, terminada a transição,
        // volta sem animação para a direita (ver parkIdle).
        if (this.count === 2 && pos !== 0 && prev === 0) pos = -1;
        // Um slide que "dá a volta" (ex.: de -1 para +1) troca de lado sem animar,
        // para não atravessar a área visível.
        const jump = prev !== 0 && pos !== 0 && Math.abs(pos - prev) >= 2;
        if (jump) {
          slide.classList.add('is-jump');
          slide.dataset.pos = String(pos);
          void slide.offsetWidth;                 // força o reflow antes de reativar a transição
          slide.classList.remove('is-jump');
        } else {
          slide.dataset.pos = String(pos);
        }
        slide.setAttribute('aria-hidden', pos !== 0 ? 'true' : 'false');
      });
      this.dots.forEach((dot, i) => {
        const active = i === this.index;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-selected', String(active));
        dot.tabIndex = active ? 0 : -1;
      });
      if (this.count === 2) this.parkIdle();
    }

    /* Recoloca (sem animar) o slide inativo na posição de "próxima foto",
       assim que a saída pela esquerda termina — mantém a fatia espiando
       à direita mesmo com apenas 2 imagens no carrossel. */
    parkIdle() {
      clearTimeout(this.parkTimer);
      this.parkTimer = setTimeout(() => {
        this.slides.forEach((slide, i) => {
          if (i === this.index || slide.dataset.pos === '1') return;
          slide.classList.add('is-jump');
          slide.dataset.pos = '1';
          void slide.offsetWidth;
          slide.classList.remove('is-jump');
        });
      }, 760);
    }

    goTo(i) {
      const next = ((i % this.count) + this.count) % this.count;
      if (next === this.index) return;
      this.index = next;
      this.render();
      this.listeners.forEach((fn) => fn(this.index));
    }

    /* Fonte única do índice ativo: quem precisar da foto atual assina aqui */
    onChange(fn) { this.listeners.push(fn); }
    setLockCheck(fn) { this.lockCheck = typeof fn === 'function' ? fn : null; }
    isLocked() { return Boolean(this.lockCheck && this.lockCheck()); }
    activeSlide() { return this.slides[this.index]; }
    activeImage() { return this.slides[this.index].querySelector('img'); }
    next() { this.goTo(this.index + 1); }
    prev() { this.goTo(this.index - 1); }

    /* ---- autoplay ---- */
    start() {
      if (prefersReducedMotion.matches) return;
      this.stop();
      this.timer = setInterval(() => {
        if (document.hidden || this.hovering || this.interacting || this.isLocked()) return;
        this.next();
      }, this.interval);
    }
    stop() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }
    restart() { this.start(); }

    buildDots() {
      this.dots = this.slides.map((_, i) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'carousel__dot';
        dot.setAttribute('role', 'tab');
        dot.setAttribute('aria-label', `Ver foto ${i + 1} de ${this.count}`);
        dot.addEventListener('click', () => { this.goTo(i); this.restart(); });
        this.dotsWrap.appendChild(dot);
        return dot;
      });
    }

    bindEvents() {
      this.prevBtn.addEventListener('click', () => { this.prev(); this.restart(); });
      this.nextBtn.addEventListener('click', () => { this.next(); this.restart(); });

      // Clique nos cards laterais leva ao respectivo slide
      this.slides.forEach((slide, i) => {
        slide.addEventListener('click', () => {
          if (this.swiped) return;
          const pos = this.offsetFor(i);
          if (pos === 1) { this.next(); this.restart(); }
          else if (pos === -1) { this.prev(); this.restart(); }
        });
      });

      // Pausa no hover
      this.root.addEventListener('mouseenter', () => { this.hovering = true; });
      this.root.addEventListener('mouseleave', () => { this.hovering = false; });

      // Pausa enquanto há foco por teclado dentro do carrossel (clique de mouse não deve travar o autoplay)
      this.root.addEventListener('focusin', (e) => {
        this.interacting = e.target.matches ? e.target.matches(':focus-visible') : false;
      });
      this.root.addEventListener('focusout', (e) => {
        if (!this.root.contains(e.relatedTarget)) this.interacting = false;
      });

      // Teclado
      this.root.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); this.next(); this.restart(); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); this.prev(); this.restart(); }
      });

      // Swipe / drag (Pointer Events)
      let startX = 0, startY = 0, pointerId = null;
      this.swiped = false;

      this.viewport.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        pointerId = e.pointerId;
        startX = e.clientX;
        startY = e.clientY;
        this.swiped = false;
        this.interacting = true;
      });

      const finish = (e) => {
        if (pointerId === null || e.pointerId !== pointerId) return;
        pointerId = null;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
          this.swiped = true;
          dx < 0 ? this.next() : this.prev();
          this.restart();
        }
        // Libera o autoplay logo após a interação
        setTimeout(() => { this.interacting = false; }, 150);
      };
      this.viewport.addEventListener('pointerup', finish);
      this.viewport.addEventListener('pointercancel', finish);
      this.viewport.addEventListener('dragstart', (e) => e.preventDefault());

      // Pausa quando a aba não está visível; retoma ao voltar
      document.addEventListener('visibilitychange', () => { if (!document.hidden) this.restart(); });

      prefersReducedMotion.addEventListener('change', (e) => { e.matches ? this.stop() : this.start(); });
    }
  }

  function initCarousel() {
    const root = document.getElementById('carousel');
    return root ? new Carousel(root) : null;
  }

  /* Carrossel dos pacientes (seção 3): instância independente, mesma mecânica */
  function initPatientsCarousel() {
    const root = document.getElementById('patientsCarousel');
    return root ? new Carousel(root) : null;
  }

  /* =====================================================================
     TRANSIÇÃO SEÇÃO 2 → SEÇÃO 3
     A foto ativa do carrossel "se desprende" e viaja até o slot da seção
     de serviços. Técnica FLIP dirigida pelo scroll: a cada frame medimos o
     retângulo do slide ativo (First) e o do slot de destino (Last) e
     interpolamos posição/tamanho/raio de um clone fixo (o "traveler").
     ===================================================================== */
  function initServicesTransition(carousel) {
    const traveler = document.getElementById('traveler');
    const section = document.getElementById('servicos');
    const slot = document.getElementById('servicesPhoto');
    const slotImg = document.getElementById('servicesPhotoImg');
    if (!carousel || !traveler || !section || !slot || !slotImg) return;

    const travelerImg = traveler.querySelector('img');
    const compactMq = window.matchMedia('(max-width: 900px)');   // layout de uma coluna (foto no fluxo, sem sticky)
    const enabled = () => !prefersReducedMotion.matches;

    const clamp01 = (v) => Math.min(1, Math.max(0, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    const radiusOf = (el) => parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;

    /* ---- sincroniza a foto da seção 3 (e do clone) com o índice ativo ---- */
    const sync = () => {
      const img = carousel.activeImage();
      if (!img) return;
      const src = img.getAttribute('src');
      if (slotImg.getAttribute('src') !== src) {
        slotImg.setAttribute('src', src);
        slotImg.alt = img.alt;
      }
      slotImg.style.objectPosition = img.style.objectPosition;
      if (travelerImg.getAttribute('src') !== src) travelerImg.setAttribute('src', src);
      travelerImg.style.objectPosition = img.style.objectPosition;

      // Se o índice mudar no meio da viagem, o slide escondido passa a ser o novo ativo
      if (state === 'travel') {
        if (hiddenSlide && hiddenSlide !== carousel.activeSlide()) hiddenSlide.classList.remove('is-traveling');
        hiddenSlide = carousel.activeSlide();
        hiddenSlide.classList.add('is-traveling');
      }
    };

    let state = 'idle';       // 'idle' (na seção 2) | 'travel' (viajando) | 'done' (na seção 3)
    let hiddenSlide = null;
    let ticking = false;

    /* Progresso 0 → 1 da viagem.
       Desktop: começa com o topo da seção 3 a 90% da tela e termina com ele no topo da tela
       (o slot está sticky logo abaixo do header).
       Mobile: o slot fica no fluxo, abaixo do texto de introdução; a viagem começa no mesmo
       ponto e termina quando o slot chega a ~22% da altura da tela. */
    const progress = () => {
      const vh = window.innerHeight;
      const top = section.getBoundingClientRect().top;
      if (!compactMq.matches) return clamp01((vh * 0.9 - top) / (vh * 0.9));

      const y = window.scrollY;
      const startY = top + y - vh * 0.9;
      const endY = slot.getBoundingClientRect().top + y - vh * 0.22;
      if (endY <= startY) return clamp01((vh * 0.9 - top) / (vh * 0.9));
      return clamp01((y - startY) / (endY - startY));
    };

    const begin = () => {
      state = 'travel';
      hiddenSlide = carousel.activeSlide();
      hiddenSlide.classList.add('is-traveling');
      slot.classList.add('is-hidden');
      traveler.classList.add('is-active');
    };

    const finish = (arrived) => {
      state = arrived ? 'done' : 'idle';
      if (hiddenSlide) hiddenSlide.classList.remove('is-traveling');
      hiddenSlide = null;
      // A foto real reaparece sem o fade de 400ms: o clone sai e ela já está
      // no lugar, no mesmo frame — é o que evita a piscada na chegada.
      slot.classList.add('is-handoff');
      slot.classList.remove('is-hidden');
      traveler.classList.remove('is-active');
      requestAnimationFrame(() => slot.classList.remove('is-handoff'));
    };

    const teardown = () => {
      if (state === 'travel') finish(false);
      state = 'idle';
      slotImg.style.removeProperty('--photo-scale');
    };

    // Autoplay pausado enquanto a foto está viajando ou já mora na seção 3; volta a rodar
    // quando o usuário retorna à seção 2. A checagem é feita no próprio tick do autoplay,
    // de forma síncrona, para que a foto nunca troque no meio da viagem.
    carousel.setLockCheck(() => enabled() && progress() > 0);

    const update = () => {
      ticking = false;
      if (!enabled()) { teardown(); return; }

      const p = progress();

      if (p <= 0 || p >= 1) {
        if (state === 'travel') finish(p >= 1);

        // Detalhe sutil: leve scale (1 → 1.015) na foto enquanto a seção 3 é percorrida
        if (p >= 1) {
          const rect = section.getBoundingClientRect();
          const span = Math.max(1, rect.height - window.innerHeight);
          const q = clamp01(-rect.top / span);
          slotImg.style.setProperty('--photo-scale', (1 + 0.015 * q).toFixed(4));
        }
        return;
      }

      if (state !== 'travel') begin();

      const a = carousel.activeSlide().getBoundingClientRect();   // First
      const b = slot.getBoundingClientRect();                      // Last
      const e = easeInOut(p);
      const ex = easeInOut(clamp01((p - 0.12) / 0.88));            // desce primeiro, depois desliza para a esquerda

      const x = lerp(a.left, b.left, ex);
      const y = lerp(a.top, b.top, e);
      const w = lerp(a.width, b.width, e);
      const h = lerp(a.height, b.height, e);
      const r = lerp(radiusOf(carousel.activeSlide()), radiusOf(slot), e);

      traveler.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;   // Invert/Play
      traveler.style.width = `${w.toFixed(2)}px`;
      traveler.style.height = `${h.toFixed(2)}px`;
      traveler.style.borderRadius = `${r.toFixed(2)}px`;
    };

    const request = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    };

    carousel.onChange(() => { sync(); request(); });
    sync();

    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    compactMq.addEventListener('change', request);
    prefersReducedMotion.addEventListener('change', request);
    request();
  }

  /* =====================================================================
     FAQ (accordion acessível — um item aberto por vez)
     ===================================================================== */
  function initFaq() {
    const root = document.querySelector('.faq__list');
    if (!root) return;
    const items = Array.from(root.querySelectorAll('.faq__item'));
    if (!items.length) return;

    const setOpen = (item, open) => {
      const trigger = item.querySelector('.faq__trigger');
      const panel = item.querySelector('.faq__panel');
      if (!trigger || !panel) return;
      item.classList.toggle('is-open', open);
      trigger.setAttribute('aria-expanded', String(open));
      if (open) panel.removeAttribute('aria-hidden');
      else panel.setAttribute('aria-hidden', 'true');
    };

    items.forEach((item) => {
      const trigger = item.querySelector('.faq__trigger');
      if (!trigger) return;
      trigger.addEventListener('click', () => {
        const willOpen = !item.classList.contains('is-open');
        items.forEach((other) => setOpen(other, other === item && willOpen));
      });
    });
  }

  /* =====================================================================
     INIT
     ===================================================================== */
  initPageEnter();
  initHeader();
  initActiveNav();
  initHeroEntrance();
  initParallax();
  initSoftParallax();
  initScrollProgress();
  initPageTransition();
  initReveal();
  initCardFloat();
  const carousel = initCarousel();
  initServicesTransition(carousel);
  initPatientsCarousel();
  initHowParallax();
  initFaq();
})();
