const header = document.querySelector('.site-header');
const menuToggle = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('.main-nav');
const dropdownHosts = document.querySelectorAll('.has-dropdown');
const track = document.getElementById('testimonialTrack');
const prevBtn = document.querySelector('.carousel-btn.prev');
const nextBtn = document.querySelector('.carousel-btn.next');
const photoElements = document.querySelectorAll('.hero-media img, .about-media img');
const openTestimonialFormBtn = document.getElementById('openTestimonialFormBtn');
const testimonialFormWrap = document.getElementById('testimonialFormWrap');
const testimonialForm = document.getElementById('testimonialForm');
const testimonialName = document.getElementById('testimonialName');
const testimonialMessage = document.getElementById('testimonialMessage');
const testimonialFormFeedback = document.getElementById('testimonialFormFeedback');

const testimonialsApiPath = '/api/testimonials';

function ensureSectionPhotos() {
  const fallbackSrc =
    'https://placehold.co/1200x900/e7dfd0/7c6e5a?text=Foto+de+terapia+e+bem-estar';

  photoElements.forEach((img) => {
    img.addEventListener('error', () => {
      if (img.dataset.fallbackApplied === 'true') return;
      img.dataset.fallbackApplied = 'true';
      img.src = fallbackSrc;
    });
  });
}

ensureSectionPhotos();

function setHeaderShadow() {
  if (!header) return;
  header.classList.toggle('scrolled', window.scrollY > 8);
}

function closeDropdown(dropdownHost) {
  const toggle = dropdownHost?.querySelector('.dropdown-toggle');
  if (!dropdownHost || !toggle) return;

  dropdownHost.classList.remove('open');
  toggle.setAttribute('aria-expanded', 'false');
}

function closeAllDropdowns() {
  dropdownHosts.forEach((dropdownHost) => closeDropdown(dropdownHost));
}

setHeaderShadow();
window.addEventListener('scroll', setHeaderShadow, { passive: true });

if (menuToggle && mainNav) {
  menuToggle.addEventListener('click', () => {
    const expanded = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!expanded));
    mainNav.classList.toggle('open');
  });
}

if (dropdownHosts.length) {
  // Guard against cached navigation state that may restore "open" class.
  closeAllDropdowns();

  dropdownHosts.forEach((dropdownHost) => {
    const dropdownToggle = dropdownHost.querySelector('.dropdown-toggle');
    if (!dropdownToggle) return;

    dropdownToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      const isOpen = dropdownHost.classList.contains('open');

      closeAllDropdowns();

      dropdownHost.classList.toggle('open', !isOpen);
      dropdownToggle.setAttribute('aria-expanded', String(!isOpen));
    });
  });

  document.addEventListener('click', (event) => {
    if (!Array.from(dropdownHosts).some((dropdownHost) => dropdownHost.contains(event.target))) {
      closeAllDropdowns();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeAllDropdowns();
    }
  });

  window.addEventListener('pageshow', closeAllDropdowns);
}

const navLinks = document.querySelectorAll('.main-nav a, .logo, .hero-actions a, .cta-content a');
navLinks.forEach((link) => {
  link.addEventListener('click', () => {
    if (!menuToggle || !mainNav) return;
    menuToggle.setAttribute('aria-expanded', 'false');
    mainNav.classList.remove('open');
    closeAllDropdowns();
  });
});

let currentIndex = 0;
let visibleCards = window.innerWidth >= 760 ? 3 : 1;

function totalCards() {
  if (!track) return 0;
  return track.children.length;
}

function maxIndex() {
  return Math.max(totalCards() - visibleCards, 0);
}

function updateCarouselButtons() {
  if (!prevBtn || !nextBtn) return;
  prevBtn.disabled = currentIndex <= 0;
  nextBtn.disabled = currentIndex >= maxIndex();
}

function updateCarousel() {
  if (!track) return;

  const cardWidth = track.firstElementChild ? track.firstElementChild.getBoundingClientRect().width : 0;
  const gap = 0;
  const offset = (cardWidth + gap) * currentIndex;
  track.style.transform = `translateX(-${offset}px)`;
  updateCarouselButtons();
}

function recalculateCarousel() {
  visibleCards = window.innerWidth >= 760 ? 3 : 1;
  currentIndex = Math.min(currentIndex, maxIndex());
  updateCarousel();
}

function sanitizeText(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function createStars(rating) {
  const safeRating = Math.max(1, Math.min(5, Number(rating) || 5));
  return '★'.repeat(safeRating);
}

function createTestimonialCard({ name, message, rating }) {
  const card = document.createElement('article');
  card.className = 'testimonial-card is-new';

  const quote = document.createElement('p');
  quote.className = 'quote';
  quote.textContent = `“${message}”`;

  const stars = document.createElement('p');
  stars.className = 'stars';
  stars.textContent = createStars(rating);

  const author = document.createElement('p');
  author.className = 'author';
  author.textContent = `— ${name}`;

  card.append(quote, stars, author);
  return card;
}

async function loadSavedTestimonials() {
  if (!track) return;

  try {
    const response = await fetch(testimonialsApiPath, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) return;

    const list = await response.json();
    if (!Array.isArray(list)) return;

    list.forEach((item) => {
      if (!item || !item.name || !item.message) return;
      track.prepend(createTestimonialCard(item));
    });
  } catch {
    // Ignore network errors to keep UI functional.
  }
}

async function saveTestimonial(entry) {
  const response = await fetch(testimonialsApiPath, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(entry)
  });

  if (!response.ok) {
    throw new Error('Failed to save testimonial.');
  }
}

if (prevBtn && nextBtn && track) {
  prevBtn.addEventListener('click', () => {
    currentIndex = Math.max(currentIndex - 1, 0);
    updateCarousel();
  });

  nextBtn.addEventListener('click', () => {
    currentIndex = Math.min(currentIndex + 1, maxIndex());
    updateCarousel();
  });

  window.addEventListener('resize', recalculateCarousel);
  recalculateCarousel();

  // Optional autoplay.
  setInterval(() => {
    if (document.hidden) return;
    currentIndex = currentIndex >= maxIndex() ? 0 : currentIndex + 1;
    updateCarousel();
  }, 5200);
}

if (openTestimonialFormBtn && testimonialFormWrap) {
  openTestimonialFormBtn.addEventListener('click', () => {
    const isOpen = testimonialFormWrap.classList.contains('is-open');
    testimonialFormWrap.classList.toggle('is-open', !isOpen);
    testimonialFormWrap.setAttribute('aria-hidden', String(isOpen));
    openTestimonialFormBtn.textContent = isOpen ? 'ESCREVER TESTEMUNHO' : 'FECHAR';

    if (!isOpen) {
      testimonialName?.focus();
    } else if (testimonialFormFeedback) {
      testimonialFormFeedback.textContent = '';
    }
  });
}

if (testimonialForm && testimonialName && testimonialMessage && testimonialFormFeedback) {
  testimonialForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = sanitizeText(testimonialName.value);
    const message = sanitizeText(testimonialMessage.value);
    const selectedRating = testimonialForm.querySelector('input[name="rating"]:checked');
    const rating = Number(selectedRating?.value || 5);

    if (!name) {
      testimonialFormFeedback.textContent = 'O nome e obrigatorio.';
      testimonialName.focus();
      return;
    }

    if (!message) {
      testimonialFormFeedback.textContent = 'Escreve o teu testemunho antes de publicar.';
      testimonialMessage.focus();
      return;
    }

    const entry = { name, message, rating };
    const submitButton = testimonialForm.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      await saveTestimonial(entry);

      if (track) {
        const newCard = createTestimonialCard(entry);
        track.prepend(newCard);
        currentIndex = 0;
        recalculateCarousel();

        window.setTimeout(() => {
          newCard.classList.remove('is-new');
        }, 700);
      }

      testimonialForm.reset();
      testimonialFormFeedback.textContent = 'Obrigado. O teu testemunho foi publicado.';
    } catch {
      testimonialFormFeedback.textContent = 'Nao foi possivel publicar agora. Tenta novamente em instantes.';
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

loadSavedTestimonials().finally(() => {
  recalculateCarousel();
});
