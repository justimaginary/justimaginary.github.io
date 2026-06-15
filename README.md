# Academic Homepage

A lightweight static academic homepage for GitHub Pages. This site replaces the previous Hexo workflow with plain HTML, CSS, and JavaScript.

## Local Preview

```bash
python3 -m http.server 8080
```

Then open <http://localhost:8080>.

## Structure

- `index.html`: homepage
- `assets/styles.css`: Apple HIG-inspired visual system
- `assets/site.js`: small navigation and scroll-state interactions
- `content/posts/`: local Markdown sources for migrated blog posts
- `blog/`: generated static blog pages
- `assets/img/`: profile and site images
- `assets/blog-img/`: copied image assets used by blog posts

The previous Hexo directory is kept only as an archive. This folder contains the assets and content needed for the current static site.

## Regenerate Blog Pages

```bash
node scripts/generate-blog.js
```
