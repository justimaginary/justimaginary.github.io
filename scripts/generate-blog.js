#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const kramed = require("kramed");

const root = path.resolve(__dirname, "..");
const postsDir = path.join(root, "content", "posts");
const blogDir = path.join(root, "blog");
const indexPath = path.join(root, "index.html");
const legacyPostLinks = new Map([
  ["https://justimaginary.github.io/2026/03/30/Frontend-Backend-Practice-Vol-1/", "frontend-backend-practice-vol-1.html"],
  ["https://justimaginary.github.io/2026/04/03/Frontend-Backend-Practice-Vol-2/", "frontend-backend-practice-vol-2.html"],
  ["https://justimaginary.github.io/2026/04/04/Frontend-Backend-Practice-Vol-3/", "frontend-backend-practice-vol-3.html"],
  ["https://justimaginary.github.io/2026/04/03/Frontend-Backend-Practice-Vol-3/", "frontend-backend-practice-vol-3.html"],
  ["https://justimaginary.github.io/2026/04/07/Frontend-Backend-Practice-Vol-4/", "frontend-backend-practice-vol-4.html"],
  ["https://justimaginary.github.io/2026/04/05/BiLSTM-CRF-From-Scratch-CN/", "bilstm-crf-from-scratch-cn.html"],
  ["https://justimaginary.github.io/2026/04/05/BiLSTM-CRF-From-Scratch-EN/", "bilstm-crf-from-scratch-en.html"],
  ["/2026/03/30/Frontend-Backend-Practice-Vol-1/", "frontend-backend-practice-vol-1.html"],
  ["/2026/04/03/Frontend-Backend-Practice-Vol-2/", "frontend-backend-practice-vol-2.html"],
  ["/2026/04/04/Frontend-Backend-Practice-Vol-3/", "frontend-backend-practice-vol-3.html"],
  ["/2026/04/03/Frontend-Backend-Practice-Vol-3/", "frontend-backend-practice-vol-3.html"],
  ["/2026/04/07/Frontend-Backend-Practice-Vol-4/", "frontend-backend-practice-vol-4.html"],
  ["/2026/04/05/BiLSTM-CRF-From-Scratch-CN/", "bilstm-crf-from-scratch-cn.html"],
  ["/2026/04/05/BiLSTM-CRF-From-Scratch-EN/", "bilstm-crf-from-scratch-en.html"],
]);

const renderer = new kramed.Renderer();
const originalImage = renderer.image.bind(renderer);

renderer.image = (href, title, text) => {
  const rewritten = rewriteAssetPath(href);
  return originalImage(rewritten, title, text || "");
};

kramed.setOptions({
  renderer,
  gfm: true,
  tables: true,
  breaks: false,
  sanitize: false,
  smartLists: true,
});

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugify(value) {
  return String(value)
    .trim()
    .replace(/\.md$/i, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function parseFrontmatter(raw, file) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return {
      metadata: { title: path.basename(file, ".md") },
      body: raw,
    };
  }

  return {
    metadata: yaml.load(match[1]) || {},
    body: match[2],
  };
}

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(normalizeList);
  return [String(value)];
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function readPosts() {
  return fs
    .readdirSync(postsDir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const raw = fs.readFileSync(path.join(postsDir, file), "utf8");
      const { metadata, body } = parseFrontmatter(raw, file);
      const title = metadata.title || path.basename(file, ".md");
      const slug = slugify(path.basename(file, ".md")) || slugify(title);
      const date = formatDate(metadata.date);
      const protectedMath = protectMath(body);
      const rendered = restoreMath(kramed(protectedMath.markdown), protectedMath.math);

      return {
        file,
        slug,
        title,
        date,
        categories: normalizeList(metadata.categories),
        tags: normalizeList(metadata.tags),
        html: addCopyButtonsToCodeBlocks(rewriteLegacyPostLinks(rewriteRenderedAssets(rendered))),
      };
    })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || a.title.localeCompare(b.title));
}

function rewriteAssetPath(href) {
  if (!href || /^(https?:)?\/\//.test(href) || href.startsWith("data:")) return href;
  const normalized = href.replace(/^\/+/, "");
  if (normalized.startsWith("img/")) {
    return `../assets/blog-img/${normalized.slice(4)}`;
  }
  if (normalized.startsWith("assets/")) {
    return `../${normalized}`;
  }
  return href;
}

function rewriteRenderedAssets(html) {
  return html
    .replaceAll('src="/img/', 'src="../assets/blog-img/')
    .replaceAll("src='/img/", "src='../assets/blog-img/")
    .replaceAll('href="/img/', 'href="../assets/blog-img/')
    .replaceAll("href='/img/", "href='../assets/blog-img/");
}

function rewriteLegacyPostLinks(html) {
  let rewritten = html;
  for (const [legacyUrl, currentUrl] of legacyPostLinks) {
    rewritten = rewritten.replaceAll(legacyUrl, currentUrl);
  }
  return rewritten;
}

function protectMath(markdown) {
  const math = [];
  const stash = (type, content) => {
    const token = `@@MATH_${math.length}@@`;
    math.push({ type, content });
    return token;
  };

  const protectSegment = (segment) =>
    segment
      .replace(/\$\$([\s\S]+?)\$\$/g, (_match, content) => stash("display", content.trim()))
      .replace(/(^|[^\\$])\$([^\n$]+?)\$/g, (_match, prefix, content) => `${prefix}${stash("inline", content.trim())}`);

  return {
    markdown: markdown
      .split(/(```[\s\S]*?```)/g)
      .map((segment) => (segment.startsWith("```") ? segment : protectSegment(segment)))
      .join(""),
    math,
  };
}

function restoreMath(html, math) {
  return math.reduce((result, item, index) => {
    const content = escapeHtml(item.content);
    const rendered =
      item.type === "display"
        ? `<div class="math-display">\\[${content}\\]</div>`
        : `<span class="math-inline">\\(${content}\\)</span>`;
    const token = `@@MATH_${index}@@`;
    return item.type === "display"
      ? result.replaceAll(`<p>${token}</p>`, rendered).replaceAll(token, rendered)
      : result.replaceAll(token, rendered);
  }, html);
}

function addCopyButtonsToCodeBlocks(html) {
  return html.replace(/<pre><code([\s\S]*?)>([\s\S]*?)<\/code><\/pre>/g, (_match, codeAttrs, codeContent) => {
    return `<div class="code-block"><button class="copy-code-button" type="button">Copy</button><pre><code${codeAttrs}>${codeContent}</code></pre></div>`;
  });
}

function renderCategories(categories) {
  if (!categories.length) return "";
  return `<div class="category-list" aria-label="Categories">${categories
    .map((category) => `<span>${escapeHtml(category)}</span>`)
    .join("")}</div>`;
}

function renderPostNav(previousPost, nextPost) {
  const previous = previousPost
    ? `<a href="${previousPost.slug}.html"><span>Previous</span><strong>${escapeHtml(previousPost.title)}</strong></a>`
    : `<span class="is-disabled"><span>Previous</span><strong>No newer post</strong></span>`;
  const next = nextPost
    ? `<a href="${nextPost.slug}.html"><span>Next</span><strong>${escapeHtml(nextPost.title)}</strong></a>`
    : `<span class="is-disabled"><span>Next</span><strong>No older post</strong></span>`;
  return `<nav class="post-nav" aria-label="Post navigation">${previous}${next}</nav>`;
}

function postTemplate(post, previousPost, nextPost) {
  const categories = post.categories.length ? post.categories.join(" / ") : "Blog";
  const tags = post.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${escapeHtml(post.title)}">
    <title>${escapeHtml(post.title)} · imaginary</title>
    <link rel="icon" href="../assets/img/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="../assets/styles.css">
    <script>
      window.MathJax = {
        tex: {
          inlineMath: [["\\\\(", "\\\\)"]],
          displayMath: [["\\\\[", "\\\\]"]],
          processEscapes: true
        },
        options: {
          skipHtmlTags: ["script", "noscript", "style", "textarea", "pre", "code"]
        }
      };
    </script>
    <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js" async></script>
    <script src="../assets/site.js" defer></script>
  </head>
  <body>
    <a class="skip-link" href="#article">Skip to article</a>
    <header class="site-header" data-site-header>
      <nav class="nav" aria-label="Primary navigation">
        <a class="nav__brand" href="../index.html#about" aria-label="imaginary homepage">imaginary</a>
        <div class="nav__links" aria-label="Sections">
          <a href="../index.html#about">About</a>
          <a href="../index.html#news">News</a>
          <a href="../index.html#publications">Publications</a>
          <a href="../index.html#blogs" aria-current="true" class="is-active">Blogs</a>
        </div>
      </nav>
    </header>
    <main class="article-shell" id="article">
      <article class="article">
        <a class="back-link" href="../index.html#blogs">Back to Blogs</a>
        <p class="eyebrow">${escapeHtml(categories)}</p>
        <h1>${escapeHtml(post.title)}</h1>
        <p class="article__meta"><time datetime="${escapeHtml(post.date)}">${escapeHtml(post.date)}</time></p>
        ${renderCategories(post.categories)}
        ${tags ? `<div class="tag-list" aria-label="Tags">${tags}</div>` : ""}
        <div class="article__content">
${post.html}
        </div>
        ${renderPostNav(previousPost, nextPost)}
      </article>
    </main>
    <footer class="site-footer">
      <p>© 2026 imaginary. Built as a lightweight static academic homepage.</p>
    </footer>
  </body>
</html>
`;
}

function renderBlogList(posts) {
  return posts
    .map((post) => {
      const meta = [post.date, ...post.categories].filter(Boolean).join(" · ");
      return `<a class="blog-card" href="blog/${post.slug}.html">
            <h3>${escapeHtml(post.title)}</h3>
            <p class="blog-card__meta">${escapeHtml(meta)}</p>
            ${renderCategories(post.categories)}
          </a>`;
    })
    .join("\n          ");
}

function updateIndex(posts) {
  const start = '<div class="blog-list" data-blog-list>';
  const end = "\n        </div>\n      </section>";
  const html = fs.readFileSync(indexPath, "utf8");
  const startIndex = html.indexOf(start);
  if (startIndex === -1) throw new Error("Could not find blog list start marker.");
  const contentStart = startIndex + start.length;
  const endIndex = html.indexOf(end, contentStart);
  if (endIndex === -1) throw new Error("Could not find blog list end marker.");

  const replacement = posts.length
    ? `\n          ${renderBlogList(posts)}\n        `
    : '\n          <p class="empty-state">Blog posts will be added here.</p>\n        ';

  fs.writeFileSync(indexPath, `${html.slice(0, contentStart)}${replacement}${html.slice(endIndex)}`);
}

function main() {
  fs.mkdirSync(blogDir, { recursive: true });

  const posts = readPosts();
  for (const [index, post] of posts.entries()) {
    fs.writeFileSync(path.join(blogDir, `${post.slug}.html`), postTemplate(post, posts[index - 1], posts[index + 1]));
  }
  fs.writeFileSync(path.join(blogDir, "posts.json"), JSON.stringify(posts.map(({ html, ...post }) => post), null, 2));
  updateIndex(posts);
  console.log(`Generated ${posts.length} blog posts.`);
}

main();
