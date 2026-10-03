const express = require("express");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 10000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BASE_URL =
  process.env.BASE_URL || "https://y-fetish-coms.onrender.com";

const CATEGORIES = {
  "Он ищет её": "on-ishchet-eyo",
  "Она ищет его": "ona-ishchet-ego",
  "Он ищет его": "on-ishchet-ego",
  "Она ищет её": "ona-ishchet-eyo",
  "Пара ищет его": "para-ishchet-ego",
  "Пара ищет её": "para-ishchet-eyo",
  "Он ищет пару": "on-ishchet-paru",
  "Она ищет пару": "ona-ishchet-paru",
  "Пара ищет пару": "para-ishchet-paru",
  "Госпожа ищет рабов": "gospozha-ishchet-rabov",
  "Рабы ищут госпожу": "raby-ishchut-gospozhu",
  "Господин ищет рабов": "gospodin-ishchet-rabov",
  "Рабы ищут господина": "raby-ishchut-gospodina",
  "Разное": "raznoe"
};

function getCategoryBySlug(slug) {
  for (const [name, value] of Object.entries(CATEGORIES)) {
    if (value === slug) return name;
  }
  return null;
}

function makeSlug(text) {
  const translit = {
    а:"a", б:"b", в:"v", г:"g", д:"d", е:"e",
    ё:"yo", ж:"zh", з:"z", и:"i", й:"y", к:"k",
    л:"l", м:"m", н:"n", о:"o", п:"p", р:"r",
    с:"s", т:"t", у:"u", ф:"f", х:"h", ц:"c",
    ч:"ch", ш:"sh", щ:"shch", ъ:"", ы:"y", ь:"",
    э:"e", ю:"yu", я:"ya"
  };

  return text
    .toLowerCase()
    .split("")
    .map(c => translit[c] || c)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "obyavlenie";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(date) {
  return new Date(date).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

app.get("/", (req, res) => {
  res.redirect("/ads");
});

app.get("/ads", (req, res) => {
  res.sendFile(path.join(__dirname, "ads.html"));
});

app.get("/ads/new", (req, res) => {
  res.sendFile(path.join(__dirname, "new-ad.html"));
});

/* Все объявления */

app.get("/api/ads", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("text_ads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Не удалось загрузить объявления"
    });
  }
});

/* Объявления конкретной категории */

app.get("/api/category/:categorySlug", async (req, res) => {
  try {
    const category = getCategoryBySlug(
      req.params.categorySlug
    );

    if (!category) {
      return res.status(404).json({
        error: "Категория не найдена"
      });
    }

    const { data, error } = await supabase
      .from("text_ads")
      .select("*")
      .eq("category", category)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Ошибка загрузки"
    });
  }
});

/* Создание объявления */

app.post("/api/ads", async (req, res) => {
  try {
    const category = String(req.body.category || "").trim();
    const city = String(req.body.city || "").trim();
    const body = String(req.body.body || "").trim();
    const telegram = String(req.body.telegram || "")
      .replace(/^https?:\/\/t\.me\//i, "")
      .replace(/^@/, "")
      .trim();

    if (!CATEGORIES[category]) {
      return res.status(400).json({
        error: "Выберите категорию"
      });
    }

    if (!city) {
      return res.status(400).json({
        error: "Выберите город"
      });
    }

    if (!body) {
      return res.status(400).json({
        error: "Введите текст объявления"
      });
    }

    if (!/^[a-zA-Z0-9_]{5,32}$/.test(telegram)) {
      return res.status(400).json({
        error: "Введите корректный Telegram username"
      });
    }

    const title = category;

    const slug =
      makeSlug(body.slice(0, 70)) +
      "-" +
      crypto.randomBytes(3).toString("hex");

    const { data, error } = await supabase
      .from("text_ads")
      .insert({
        title,
        body,
        slug,
        city,
        telegram,
        category
      })
      .select()
      .single();

    if (error) throw error;

    const categorySlug = CATEGORIES[category];

    res.json({
      success: true,
      url:
        `${BASE_URL}/ads/${categorySlug}/${data.slug}`
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Не удалось опубликовать объявление"
    });
  }
});

/* SEO-страница категории */

app.get("/ads/:categorySlug", async (req, res) => {
  const categorySlug = req.params.categorySlug;
  const category = getCategoryBySlug(categorySlug);

  if (!category) {
    return res.status(404).send("Категория не найдена");
  }

  const title =
    `${category} — объявления Украина | Y-FETISH`;

  const description =
    `${category}. Объявления знакомств и поиска людей в Украине.`;

  res.send(`
<!DOCTYPE html>
<html lang="ru">
<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<title>${escapeHtml(title)}</title>

<meta
  name="description"
  content="${escapeHtml(description)}"
>

<link
  rel="canonical"
  href="${BASE_URL}/ads/${categorySlug}"
>

<link rel="stylesheet" href="/style.css">

</head>

<body>

<header class="header">

<div class="header-inner">

<a href="/ads" class="logo">
Y-FETISH
</a>

<a href="/ads/new" class="header-button">
Подать объявление
</a>

</div>

</header>

<main class="container">

<div class="category-page-title">

<h1>
${escapeHtml(category)}
</h1>

</div>

<div id="adsList" class="ads-list">

<div class="empty">
Загрузка...
</div>

</div>

</main>

<script>

const categorySlug =
${JSON.stringify(categorySlug)};

const categorySlugs =
${JSON.stringify(CATEGORIES)};

async function loadAds() {

const container =
document.getElementById("adsList");

try {

const response =
await fetch(
"/api/category/" +
encodeURIComponent(categorySlug)
);

const ads =
await response.json();

if (!ads.length) {

container.innerHTML =
'<div class="empty">В этой категории пока нет объявлений.</div>';

return;

}

container.innerHTML =
ads.map(ad => {

const slug =
categorySlugs[ad.category] || "raznoe";

return \`
<article class="ad-card">

<a
class="ad-card-link"
href="/ads/\${slug}/\${encodeURIComponent(ad.slug)}"
>

<h2 class="ad-card-title">
\${escapeHtml(ad.title)}
</h2>

<div class="ad-card-city">
📍 \${escapeHtml(ad.city)}
</div>

<div class="ad-card-text">
\${escapeHtml(ad.body)}
</div>

<div class="ad-card-date">
\${formatDate(ad.created_at)}
</div>

</a>

</article>
\`;

}).join("");

} catch (error) {

container.innerHTML =
'<div class="empty">Ошибка загрузки объявлений.</div>';

}

}

function escapeHtml(value) {

return String(value || "")
.replace(/&/g, "&amp;")
.replace(/</g, "&lt;")
.replace(/>/g, "&gt;")
.replace(/"/g, "&quot;")
.replace(/'/g, "&#039;");

}

function formatDate(date) {

return new Date(date).toLocaleDateString(
"ru-RU",
{
day: "2-digit",
month: "2-digit",
year: "numeric"
}
);

}

loadAds();

</script>

</body>
</html>
  `);
});

/* SEO-страница конкретного объявления */

app.get("/ads/:categorySlug/:slug", async (req, res) => {

  try {

    const category =
      getCategoryBySlug(
        req.params.categorySlug
      );

    if (!category) {
      return res.status(404).send(
        "Категория не найдена"
      );
    }

    const { data: ad, error } =
      await supabase
        .from("text_ads")
        .select("*")
        .eq("slug", req.params.slug)
        .eq("category", category)
        .single();

    if (error || !ad) {
      return res.status(404).send(
        "Объявление не найдено"
      );
    }

    const title =
      `${ad.title} — ${ad.city} | Y-FETISH`;

    const description =
      `${ad.category}. ${ad.city}. ${ad.body.slice(0, 150)}`;

    const telegram =
      String(ad.telegram || "")
        .replace(/^@/, "")
        .trim();

    res.send(`
<!DOCTYPE html>
<html lang="ru">

<head>

<meta charset="UTF-8">

<meta
name="viewport"
content="width=device-width, initial-scale=1.0"
>

<title>${escapeHtml(title)}</title>

<meta
name="description"
content="${escapeHtml(description)}"
>

<link
rel="canonical"
href="${BASE_URL}/ads/${req.params.categorySlug}/${ad.slug}"
>

<link rel="stylesheet" href="/style.css">

</head>

<body>

<header class="header">

<div class="header-inner">

<a href="/ads" class="logo">
Y-FETISH
</a>

<a href="/ads/new" class="header-button">
Подать объявление
</a>

</div>

</header>

<main class="container">

<article class="single-ad">

<div class="single-category">

<a href="/ads/${req.params.categorySlug}">
${escapeHtml(ad.category)}
</a>

</div>

<h1>
${escapeHtml(ad.title)}
</h1>

<div class="ad-city">
📍 ${escapeHtml(ad.city)}
</div>

<div class="ad-date">
${formatDate(ad.created_at)}
</div>

<div class="ad-body">
${escapeHtml(ad.body).replace(/\n/g, "<br>")}
</div>

<div class="ad-contact">

<a
class="telegram-button"
href="https://t.me/${encodeURIComponent(telegram)}"
target="_blank"
rel="noopener noreferrer"
>
Telegram
</a>

</div>

</article>

</main>

</body>

</html>
    `);

  } catch (error) {

    console.error(error);

    res.status(500).send(
      "Ошибка сервера"
    );
  }

});

/* robots */

app.get("/robots.txt", (req, res) => {

  res.type("text/plain");

  res.send(`
User-agent: *
Allow: /

Sitemap: ${BASE_URL}/sitemap.xml
  `.trim());

});

/* sitemap */

app.get("/sitemap.xml", async (req, res) => {

  try {

    const urls = [];

    urls.push(
      `${BASE_URL}/ads`
    );

    for (
      const slug of Object.values(CATEGORIES)
    ) {

      urls.push(
        `${BASE_URL}/ads/${slug}`
      );

    }

    const { data: ads } =
      await supabase
        .from("text_ads")
        .select("slug, category");

    if (ads) {

      for (const ad of ads) {

        urls.push(
          `${BASE_URL}/ads/` +
          `${CATEGORIES[ad.category] || "raznoe"}/` +
          `${ad.slug}`
        );

      }

    }

    const xml =
`<?xml version="1.0" encoding="UTF-8"?>

<urlset
xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
>

${urls.map(url => `
<url>
<loc>${escapeHtml(url)}</loc>
</url>
`).join("")}

</urlset>`;

    res
      .type("application/xml")
      .send(xml);

  } catch (error) {

    console.error(error);

    res.status(500).send(
      "Sitemap error"
    );

  }

});

app.listen(PORT, () => {

  console.log(
    `Y-FETISH Text Ads running on port ${PORT}`
  );

});
