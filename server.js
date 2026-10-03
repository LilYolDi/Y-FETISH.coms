require("dotenv").config();

const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();

const PORT = process.env.PORT || 3000;
const BASE_URL = (process.env.BASE_URL || "").replace(/\/$/, "");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CATEGORIES = [
  "Он ищет её",
  "Она ищет его",
  "Он ищет его",
  "Она ищет её",
  "Пара ищет его",
  "Пара ищет её",
  "Он ищет пару",
  "Она ищет пару",
  "Пара ищет пару",
  "Госпожа ищет рабов",
  "Рабы ищут госпожу",
  "Господин ищет рабов",
  "Рабы ищут господина",
  "Разное"
];

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.redirect("/ads");
});

app.get("/ads", (req, res) => {
  res.sendFile(path.join(__dirname, "ads.html"));
});

app.get("/ads/new", (req, res) => {
  res.sendFile(path.join(__dirname, "new-ad.html"));
});

app.get("/api/ads", async (req, res) => {
  try {
    const category = String(req.query.category || "").trim();

    let query = supabase
      .from("text_ads")
      .select("id,title,body,city,telegram,category,slug,created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (category && CATEGORIES.includes(category)) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;

    if (error) {
      console.error(error);
      return res.status(500).json({
        error: error.message
      });
    }

    res.json(data || []);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Ошибка сервера."
    });
  }
});

app.post("/api/ads", async (req, res) => {
  try {
    const city = String(req.body.city || "").trim();
    const body = String(req.body.body || "").trim();
    const telegram = String(req.body.telegram || "").trim();
    const category = String(req.body.category || "").trim();

    if (!category || !CATEGORIES.includes(category)) {
      return res.status(400).json({
        error: "Выберите категорию."
      });
    }

    if (!city) {
      return res.status(400).json({
        error: "Выберите город."
      });
    }

    if (body.length < 10) {
      return res.status(400).json({
        error: "Напишите минимум 10 символов."
      });
    }

    if (body.length > 10000) {
      return res.status(400).json({
        error: "Максимум 10 000 символов."
      });
    }

    if (!telegram) {
      return res.status(400).json({
        error: "Укажите Telegram."
      });
    }

    let username = telegram
      .trim()
      .replace(/^https?:\/\/t\.me\//i, "")
      .replace(/^@/, "")
      .replace(/\?.*$/, "")
      .trim();

    if (!/^[a-zA-Z0-9_]{5,32}$/.test(username)) {
      return res.status(400).json({
        error: "Введите корректный Telegram username, например @username."
      });
    }

    const firstLine = body
      .split(/\r?\n/)[0]
      .trim();

    const title =
      firstLine.slice(0, 120) ||
      "Объявление Y-FETISH";

    function slugify(text) {
      const map = {
        а: "a", б: "b", в: "v", г: "g", ґ: "g",
        д: "d", е: "e", є: "ye", ж: "zh", з: "z",
        и: "i", і: "i", ї: "yi", й: "y", к: "k",
        л: "l", м: "m", н: "n", о: "o", п: "p",
        р: "r", с: "s", т: "t", у: "u", ф: "f",
        х: "h", ц: "ts", ч: "ch", ш: "sh",
        щ: "shch", ь: "", ю: "yu", я: "ya",
        ы: "y", э: "e", ъ: "", ё: "yo"
      };

      return String(text)
        .toLowerCase()
        .split("")
        .map(char => map[char] ?? char)
        .join("")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 90) || "obyavlenie";
    }

    let slug = slugify(title);

    const { data: existing } = await supabase
      .from("text_ads")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const { data, error } = await supabase
      .from("text_ads")
      .insert({
        title,
        body,
        city,
        telegram: username,
        category,
        slug
      })
      .select("id,title,body,city,telegram,category,slug,created_at")
      .single();

    if (error) {
      console.error(error);

      return res.status(500).json({
        error: error.message
      });
    }

    res.status(201).json({
      ...data,
      url: `/ads/${encodeURIComponent(data.slug)}`
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Ошибка сервера."
    });
  }
});

app.get("/ads/:slug", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("text_ads")
      .select("id,title,body,city,telegram,category,slug,created_at")
      .eq("slug", req.params.slug)
      .maybeSingle();

    if (error || !data) {
      return res.status(404).send(`
<!doctype html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Объявление не найдено — Y-FETISH</title>
<link rel="stylesheet" href="/style.css">
</head>
<body>
<header>
<a href="/ads" class="logo">Y-FETISH</a>
</header>
<main class="container">
<section class="card">
<h1>Объявление не найдено</h1>
<a href="/ads" class="button">К объявлениям</a>
</section>
</main>
</body>
</html>
`);
    }

    const escapeHtml = value =>
      String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    const title = escapeHtml(data.title);

    const body = escapeHtml(data.body)
      .replace(/\r?\n/g, "<br>");

    const city = escapeHtml(data.city);
    const telegram = escapeHtml(data.telegram);
    const category = escapeHtml(data.category || "Разное");

    const description = escapeHtml(
      data.body
        .replace(/\s+/g, " ")
        .slice(0, 155)
    );

    const base =
      BASE_URL ||
      `${req.protocol}://${req.get("host")}`;

    const canonical =
      `${base}/ads/${encodeURIComponent(data.slug)}`;

    res.send(`
<!doctype html>
<html lang="ru">

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width, initial-scale=1">

<title>${title} — ${category} — Y-FETISH</title>

<meta name="description"
content="${description}">

<link rel="canonical"
href="${canonical}">

<meta property="og:title"
content="${title} — Y-FETISH">

<meta property="og:description"
content="${description}">

<meta property="og:url"
content="${canonical}">

<meta property="og:type"
content="article">

<link rel="stylesheet"
href="/style.css">

</head>

<body>

<header>

<a href="/ads"
class="logo">
Y-FETISH
</a>

<nav>

<a href="/ads">
Объявления
</a>

<a href="/ads/new"
class="button small">
Создать
</a>

</nav>

</header>

<main class="container">

<article class="single-ad">

<div class="single-category">
${category}
</div>

<h1>
${title}
</h1>

<div class="ad-city">
📍 ${city}
</div>

<div class="ad-body">
${body}
</div>

<div class="ad-contact">

<strong>
Telegram:
</strong>

<a
href="https://t.me/${telegram}"
target="_blank"
rel="noopener noreferrer">

@${telegram}

</a>

</div>

<div class="ad-date">

${new Date(data.created_at)
  .toLocaleDateString("ru-RU")}

</div>

</article>

</main>

</body>
</html>
`);

  } catch (error) {
    console.error(error);

    res.status(500).send("Ошибка сервера.");
  }
});

app.get("/robots.txt", (req, res) => {

  const base =
    BASE_URL ||
    `${req.protocol}://${req.get("host")}`;

  res.type("text/plain");

  res.send(`User-agent: *
Allow: /ads
Allow: /ads/
Disallow: /api/

Sitemap: ${base}/sitemap.xml
`);
});

app.get("/sitemap.xml", async (req, res) => {

  try {

    const base =
      BASE_URL ||
      `${req.protocol}://${req.get("host")}`;

    const { data, error } = await supabase
      .from("text_ads")
      .select("slug,created_at")
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) {
      console.error(error);
      return res.status(500).send("Ошибка sitemap.");
    }

    const urls = (data || [])
      .map(ad => `
  <url>
    <loc>${base}/ads/${encodeURIComponent(ad.slug)}</loc>
    <lastmod>${new Date(ad.created_at).toISOString()}</lastmod>
  </url>`)
      .join("");

    res.type("application/xml");

    res.send(`<?xml version="1.0" encoding="UTF-8"?>

<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">

  <url>
    <loc>${base}/ads</loc>
  </url>

  ${urls}

</urlset>`);

  } catch (error) {

    console.error(error);

    res.status(500).send("Ошибка sitemap.");
  }
});

app.listen(PORT, () => {
  console.log(`Y-FETISH Text Ads running on port ${PORT}`);
});
