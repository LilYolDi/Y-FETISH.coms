require("dotenv").config();

const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();

const PORT = process.env.PORT || 3000;

const BASE_URL = (process.env.BASE_URL || "").replace(/\/$/, "");


// ===============================
// SUPABASE
// ===============================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);


// ===============================
// EXPRESS
// ===============================

app.use(express.json({
  limit: "100kb"
}));

app.use(express.urlencoded({
  extended: true,
  limit: "100kb"
}));

app.use(express.static(
  path.join(__dirname, "public")
));


// ===============================
// SLUG
// ===============================

function slugify(text) {

  const map = {

    "а":"a",
    "б":"b",
    "в":"v",
    "г":"g",
    "ґ":"g",
    "д":"d",
    "е":"e",
    "є":"ye",
    "ж":"zh",
    "з":"z",
    "и":"i",
    "і":"i",
    "ї":"yi",
    "й":"y",
    "к":"k",
    "л":"l",
    "м":"m",
    "н":"n",
    "о":"o",
    "п":"p",
    "р":"r",
    "с":"s",
    "т":"t",
    "у":"u",
    "ф":"f",
    "х":"h",
    "ц":"ts",
    "ч":"ch",
    "ш":"sh",
    "щ":"shch",
    "ь":"",
    "ю":"yu",
    "я":"ya",

    "ы":"y",
    "э":"e",
    "ъ":"",
    "ё":"yo"

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

    .slice(0, 90)

    || "obyavlenie";
}


// ===============================
// TITLE
// ===============================

function titleFromBody(body) {

  const firstLine = String(body)
    .trim()
    .split(/\r?\n/)[0]
    .trim();

  return (
    firstLine.slice(0, 120)
    || "Объявление Y-FETISH"
  );
}


// ===============================
// HTML ESCAPE
// ===============================

function escapeHtml(value) {

  return String(value)

    .replaceAll("&", "&amp;")

    .replaceAll("<", "&lt;")

    .replaceAll(">", "&gt;")

    .replaceAll('"', "&quot;")

    .replaceAll("'", "&#039;");
}


// ===============================
// PAGE: /ads
// ===============================

app.get("/ads", (req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      "public",
      "ads.html"
    )
  );

});


// ===============================
// PAGE: /ads/new
// ===============================

app.get("/ads/new", (req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      "public",
      "new-ad.html"
    )
  );

});


// ===============================
// API: GET ADS
// ===============================

app.get("/api/ads", async (req, res) => {

  const {
    data,
    error
  } = await supabase

    .from("text_ads")

    .select(
      "id,title,body,slug,created_at"
    )

    .order(
      "created_at",
      {
        ascending: false
      }
    )

    .limit(100);


  if (error) {

    return res.status(500).json({
      error: error.message
    });

  }


  res.json(data || []);

});


// ===============================
// API: CREATE AD
// ===============================

app.post("/api/ads", async (req, res) => {

  try {

    const body = String(
      req.body.body || ""
    ).trim();


    if (body.length < 10) {

      return res.status(400).json({
        error:
          "Напишите минимум 10 символов."
      });

    }


    if (body.length > 10000) {

      return res.status(400).json({
        error:
          "Текст слишком длинный. Максимум 10 000 символов."
      });

    }


    const title =
      titleFromBody(body);


    let slug =
      slugify(title);


    // Проверяем существующий URL

    const {
      data: existing
    } = await supabase

      .from("text_ads")

      .select("id")

      .eq("slug", slug)

      .maybeSingle();


    if (existing) {

      slug =
        `${slug}-${Date.now().toString(36)}`;

    }


    // Сохраняем объявление

    const {
      data,
      error
    } = await supabase

      .from("text_ads")

      .insert({

        title,

        body,

        slug

      })

      .select(
        "id,title,body,slug,created_at"
      )

      .single();


    if (error) {

      return res.status(500).json({
        error: error.message
      });

    }


    res.status(201).json({

      ...data,

      url:
        `/ads/${data.slug}`

    });


  } catch (error) {

    console.error(error);


    res.status(500).json({

      error:
        "Ошибка сервера."

    });

  }

});


// ===============================
// SINGLE AD PAGE
// ===============================

app.get("/ads/:slug", async (req, res) => {

  const {
    data,
    error
  } = await supabase

    .from("text_ads")

    .select(
      "id,title,body,slug,created_at"
    )

    .eq(
      "slug",
      req.params.slug
    )

    .maybeSingle();


  if (error || !data) {

    return res
      .status(404)
      .send(
        "Объявление не найдено"
      );

  }


  const title =
    escapeHtml(data.title);


  const body =
    escapeHtml(data.body)
      .replace(
        /\r?\n/g,
        "<br>"
      );


  const description =
    escapeHtml(data.body)
      .slice(0, 155);


  const base =
    BASE_URL ||
    `${req.protocol}://${req.get("host")}`;


  const canonical =
    `${base}/ads/${encodeURIComponent(data.slug)}`;


  res.send(`

<!DOCTYPE html>

<html lang="ru">

<head>

<meta charset="utf-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
>


<title>
${title} | Y-FETISH
</title>


<meta
  name="description"
  content="${description}"
>


<link
  rel="canonical"
  href="${canonical}"
>


<link
  rel="stylesheet"
  href="/style.css"
>

</head>


<body>


<header class="topbar">

  <a
    class="logo"
    href="/"
  >
    Y-FETISH
  </a>


  <a
    class="header-btn"
    href="/ads/new"
  >
    + Создать объявление
  </a>

</header>


<main class="page">


<article class="ad-card">


<div class="ad-label">
  ОБЪЯВЛЕНИЕ
</div>


<h1>
  ${title}
</h1>


<div class="ad-date">

  ${new Date(
    data.created_at
  ).toLocaleDateString("ru-RU")}

</div>


<div class="ad-text">

  ${body}

</div>


</article>


<a
  class="back-link"
  href="/ads"
>
  ← Все объявления
</a>


</main>


</body>

</html>

`);

});


// ===============================
// ROBOTS
// ===============================

app.get("/robots.txt", (req, res) => {

  const base =
    BASE_URL ||
    `${req.protocol}://${req.get("host")}`;


  res.type("text/plain");


  res.send(`

User-agent: *

Allow: /ads
Allow: /ads/

Disallow: /api/


Sitemap: ${base}/sitemap.xml

`);

});


// ===============================
// SITEMAP
// ===============================

app.get("/sitemap.xml", async (req, res) => {

  const base =
    BASE_URL ||
    `${req.protocol}://${req.get("host")}`;


  const {
    data
  } = await supabase

    .from("text_ads")

    .select(
      "slug,created_at"
    )

    .order(
      "created_at",
      {
        ascending: false
      }
    )

    .limit(5000);


  const urls =
    (data || [])

      .map(ad => `

  <url>

    <loc>
      ${base}/ads/${encodeURIComponent(ad.slug)}
    </loc>

    <lastmod>
      ${new Date(
        ad.created_at
      ).toISOString()}
    </lastmod>

  </url>

`)

      .join("");


  res
    .type("application/xml")
    .send(`

<?xml version="1.0"
encoding="UTF-8"?>

<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
>

  <url>

    <loc>
      ${base}/ads
    </loc>

  </url>

  ${urls}

</urlset>

`);

});


// ===============================
// START
// ===============================

app.listen(
  PORT,
  () => {

    console.log(
      `Y-FETISH Text Ads running on port ${PORT}`
    );

  }
);

