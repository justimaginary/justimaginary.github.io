const header = document.querySelector("[data-site-header]");
const sections = [...document.querySelectorAll("main section[id]")];
const navLinks = [...document.querySelectorAll(".nav__links a")];
const navLinksByHash = new Map(navLinks.map((link) => [link.hash, link]));
let activeHash = "";
let scrollFrame = 0;

function updateHeaderState() {
  document.body.classList.toggle("is-scrolled", window.scrollY > 8);
}

function setActiveNav(hash) {
  if (!hash || hash === activeHash || !navLinksByHash.has(hash)) return;
  activeHash = hash;

  navLinks.forEach((link) => {
    const isActive = link.hash === hash;
    link.classList.toggle("is-active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "true");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function updateActiveNavFromScroll() {
  const documentElement = document.documentElement;
  const bottomReached = window.innerHeight + window.scrollY >= documentElement.scrollHeight - 2;

  if (bottomReached && sections.length) {
    setActiveNav(`#${sections.at(-1).id}`);
    return;
  }

  const headerOffset = (header?.offsetHeight || 0) + 24;
  const currentSection = sections.reduce((current, section) => {
    return section.offsetTop <= window.scrollY + headerOffset ? section : current;
  }, sections[0]);

  if (currentSection) {
    setActiveNav(`#${currentSection.id}`);
  }
}

function requestActiveNavUpdate() {
  if (scrollFrame) return;
  scrollFrame = window.requestAnimationFrame(() => {
    scrollFrame = 0;
    updateHeaderState();
    updateActiveNavFromScroll();
  });
}

updateHeaderState();
updateActiveNavFromScroll();
window.addEventListener("scroll", requestActiveNavUpdate, { passive: true });
window.addEventListener("resize", requestActiveNavUpdate);

if (header) {
  header.addEventListener("click", (event) => {
    const target = event.target.closest("a[href^='#']");
    if (!target) return;
    const section = document.querySelector(target.getAttribute("href"));
    if (!section) return;
    event.preventDefault();
    setActiveNav(target.hash);
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    history.pushState(null, "", target.getAttribute("href"));
  });
}

function initSiteSearch() {
  const searchInput = document.querySelector("[data-site-search]");
  const searchShell = searchInput?.closest(".nav__search");
  const searchToggle = document.querySelector("[data-site-search-toggle]");
  const searchPanel = document.querySelector("[data-site-search-panel]");
  const searchStatus = document.querySelector("[data-site-search-status]");
  const searchResults = document.querySelector("[data-site-search-results]");
  const blogList = document.querySelector("[data-blog-list]");
  const publicationList = document.querySelector("[data-publication-list]");
  if (!searchInput) return;

  const blogCards = blogList ? [...blogList.querySelectorAll(".blog-card")] : [];
  const publicationCards = publicationList ? [...publicationList.querySelectorAll(".publication-card")] : [];
  const normalize = (value) => value.trim().toLocaleLowerCase();
  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const items = [
    ...publicationCards.map((card) => ({
      type: "Publication",
      title: card.querySelector("h3")?.textContent?.trim() || card.textContent.trim(),
      meta: card.querySelector(".publication-card__meta")?.textContent?.trim() || "",
      href: card.getAttribute("href") || "#publications",
      searchText: card.dataset.search || card.textContent,
    })),
    ...blogCards.map((card) => ({
      type: "Blog",
      title: card.querySelector("h3")?.textContent?.trim() || card.textContent.trim(),
      meta: card.querySelector(".blog-card__meta")?.textContent?.trim() || "",
      href: card.getAttribute("href") || "#blogs",
      searchText: card.dataset.search || card.textContent,
    })),
  ];

  function setSearchOpen(isOpen) {
    if (!searchShell || !searchToggle) return;
    searchShell.classList.toggle("is-open", isOpen);
    if (searchPanel) {
      searchPanel.hidden = !isOpen;
    }
    searchToggle.setAttribute("aria-expanded", String(isOpen));
    searchToggle.setAttribute("aria-label", isOpen ? "Close search" : "Open search");
    searchInput.tabIndex = isOpen ? 0 : -1;
  }

  function closeSearch() {
    searchInput.value = "";
    renderSearchResults();
    setSearchOpen(false);
  }

  function getSnippet(text, query) {
    const compactText = String(text ?? "").replace(/\s+/g, " ").trim();
    const normalizedText = compactText.toLocaleLowerCase();
    const matchIndex = normalizedText.indexOf(query);
    if (matchIndex === -1) return compactText.slice(0, 130);

    const start = Math.max(0, matchIndex - 44);
    const end = Math.min(compactText.length, matchIndex + query.length + 86);
    return `${start > 0 ? "..." : ""}${compactText.slice(start, end)}${end < compactText.length ? "..." : ""}`;
  }

  function renderSearchResults() {
    const query = normalize(searchInput.value);
    if (!searchResults || !searchStatus) return;

    if (!query) {
      searchStatus.textContent = "Type to search blogs and publications.";
      searchResults.innerHTML = "";
      return;
    }

    const matches = items
      .filter((item) => normalize(item.searchText).includes(query))
      .slice(0, 8);

    searchStatus.textContent = matches.length
      ? `${matches.length} result${matches.length === 1 ? "" : "s"} found.`
      : "No matching publications or blog posts.";

    if (!matches.length) {
      searchResults.innerHTML = "";
      return;
    }

    searchResults.innerHTML = matches
      .map((item) => {
        const snippet = getSnippet(item.searchText, query);
        return `<a class="search-result" href="${escapeHtml(item.href)}">
          <span class="search-result__type">${escapeHtml(item.type)}</span>
          <strong>${escapeHtml(item.title)}</strong>
          ${item.meta ? `<span class="search-result__meta">${escapeHtml(item.meta)}</span>` : ""}
          ${snippet ? `<span class="search-result__snippet">${escapeHtml(snippet)}</span>` : ""}
        </a>`;
      })
      .join("");
  }

  searchToggle?.addEventListener("click", () => {
    const willOpen = !searchShell?.classList.contains("is-open");
    if (willOpen) {
      setSearchOpen(true);
      searchInput.focus();
    } else {
      closeSearch();
    }
  });

  searchInput.addEventListener("input", renderSearchResults);
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSearch();
      searchToggle?.focus();
    }
  });

  document.addEventListener("click", (event) => {
    if (!searchShell?.classList.contains("is-open")) return;
    if (event.target.closest(".search-result")) {
      setSearchOpen(false);
      return;
    }
    if (searchShell.contains(event.target)) return;
    closeSearch();
  });

  setSearchOpen(false);
  renderSearchResults();
}

initSiteSearch();

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest(".copy-code-button");
  if (!button) return;

  const code = button.closest(".code-block")?.querySelector("code");
  if (!code) return;

  const originalText = button.textContent;
  try {
    await copyText(code.textContent);
    button.textContent = "Copied";
    button.classList.add("is-copied");
    window.setTimeout(() => {
      button.textContent = originalText;
      button.classList.remove("is-copied");
    }, 1600);
  } catch (_error) {
    button.textContent = "Failed";
    window.setTimeout(() => {
      button.textContent = originalText;
    }, 1600);
  }
});
