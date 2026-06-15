const header = document.querySelector("[data-site-header]");
const sections = [...document.querySelectorAll("main section[id]")];
const navLinks = [...document.querySelectorAll(".nav__links a")];

function updateHeaderState() {
  document.body.classList.toggle("is-scrolled", window.scrollY > 8);
}

const observer = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (!visible) return;

    navLinks.forEach((link) => {
      const isActive = link.getAttribute("href") === `#${visible.target.id}`;
      link.classList.toggle("is-active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  },
  {
    rootMargin: "-24% 0px -62% 0px",
    threshold: [0.12, 0.3, 0.6],
  },
);

sections.forEach((section) => observer.observe(section));
updateHeaderState();
window.addEventListener("scroll", updateHeaderState, { passive: true });

if (header) {
  header.addEventListener("click", (event) => {
    const target = event.target.closest("a[href^='#']");
    if (!target) return;
    const section = document.querySelector(target.getAttribute("href"));
    if (!section) return;
    event.preventDefault();
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    history.pushState(null, "", target.getAttribute("href"));
  });
}

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
