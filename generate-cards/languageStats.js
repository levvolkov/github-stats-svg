const fs = require("fs");
const path = require("path");

const username = process.env.GITHUB_ACTOR;
const token = process.env.ACCESS_TOKEN;
const exclusionThreshold = 0.9;

if (!token) {
  console.error(
    "Error: ACCESS_TOKEN is not defined in the environment variables."
  );
  process.exit(1);
}

const GRAPHQL_API = "https://api.github.com/graphql";

// Colors for light and dark themes (Цвета для светлой и темной тем)
const colors = {
  light: {
    background: "none", // Background color (Цвет фона)
    title: "#006AFF", // Header color (Цвет заголовка)
    lang: "#000000", // Language text color (Цвет текста языка)
    percent: "rgb(88, 96, 105)", // Color of percentages (Цвет процентов)
    outline: "rgb(225, 228, 232)", // Outline color (Цвет обводки)
    progressBackground: "#e1e4e8", // Progress bar background color (Цвет фона прогресс-бара)
    progressItemOutline: "rgb(225, 228, 232)", // Progress bar element outline color (Цвет обводки элементов прогресс-бара)
  },
  dark: {
    background: "none",
    title: "#006AFF",
    lang: "#c9d1d9",
    percent: "#8b949e",
    outline: "rgb(225, 228, 232)",
    progressBackground: "rgba(110, 118, 129, 0.4)",
    progressItemOutline: "#393f47",
  },
};

async function fetchFromGitHub(query, variables = {}) {
  const response = await fetch(GRAPHQL_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("GitHub API Error:", errorText);
    throw new Error("Failed to fetch data from GitHub API.");
  }

  const data = await response.json();
  if (data.errors) {
    console.error("GitHub API Error:", JSON.stringify(data.errors, null, 2));
    throw new Error("Failed to fetch data from GitHub API.");
  }
  return data.data;
}

async function fetchTopLanguages() {
  const query = `
    query {
      user(login: "${username}") {
        repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
          nodes {
            languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
              edges {
                size
                node {
                  name
                  color
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = await fetchFromGitHub(query);
  const languages = {};

  for (const repo of data.user.repositories.nodes) {
    for (const langEdge of repo.languages.edges) {
      const lang = langEdge.node.name;
      const size = langEdge.size;
      const color = langEdge.node.color;

      if (!languages[lang]) {
        languages[lang] = { size: 0, color };
      }
      languages[lang].size += size;
    }
  }

  const totalBytes = Object.values(languages).reduce(
    (sum, lang) => sum + lang.size,
    0
  );

  const filteredLanguages = Object.entries(languages)
    .filter(
      ([_, lang]) => (lang.size / totalBytes) * 100 < exclusionThreshold * 100
    )
    .map(([name, lang]) => ({
      lang: name,
      percent: (lang.size / totalBytes) * 100,
      color: lang.color,
    }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 12); // Отображаем 12 языков

  return filteredLanguages;
}

function generateSVG(languageStats) {
  const svgWidth = 360;
  const svgHeight = 210;

  let svgContent = `<svg id="gh-dark-mode-only" width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
<style>
svg {
  font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif, Apple Color Emoji, Segoe UI Emoji;
  font-size: 14px;
  line-height: 21px;
}

#background {
  width: calc(100% - 10px);
  height: calc(100% - 10px);
  fill: ${colors.light.background}; 
  stroke: ${colors.light.outline};
  stroke-width: 1px;
  rx: 6px;
  ry: 6px;
}

#gh-dark-mode-only:target #background {
  fill: ${colors.dark.background};
  stroke: ${colors.dark.outline};
  stroke-width: 0.5px;
}

foreignObject {
  width: calc(100% - 10px - 32px);
  height: calc(100% - 10px - 24px);
}

h2 {
  margin-top: 0;
  margin-bottom: 0.75em;
  line-height: 24px;
  font-size: 16px;
  font-weight: 600;
  color: ${colors.light.title}; /* Цвет заголовка */
}

#gh-dark-mode-only:target h2 {
  color: ${colors.dark.title}; /* Цвет заголовка для темной темы */
}

ul {
  list-style: none;
  padding-left: 0;
  margin-top: 0;
  margin-bottom: 0;
}

li {
  display: inline-flex;
  font-size: 12px;
  margin-right: 2ch;
  align-items: center;
  flex-wrap: nowrap;
  transform: translateX(-500%);
  animation: slideIn 2s ease-in-out forwards;
}

@keyframes slideIn {
  to {
    transform: translateX(0);
  }
}

div.ellipsis {
  height: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.octicon {
  fill: ${colors.light.percent};
  margin-right: 0.5ch;
  vertical-align: top;
}

#gh-dark-mode-only:target .octicon {
  fill: ${colors.dark.percent};
}

.progress {
  display: flex;
  height: 8px;
  overflow: hidden;
  background-color: ${colors.light.progressBackground}; 
  border-radius: 6px;
  outline: 1px solid transparent;
  margin-bottom: 1em;
}

#gh-dark-mode-only:target .progress {
  background-color: ${colors.dark.progressBackground}; 
}

.progress-item {
  outline: 2px solid ${colors.light.progressItemOutline};
  border-collapse: collapse;
}

#gh-dark-mode-only:target .progress-item {
  outline: 2px solid ${colors.dark.progressItemOutline};
}

.lang {
  font-weight: 600;
  margin-right: 4px;
  color: ${colors.light.lang}; 
}

#gh-dark-mode-only:target .lang {
  color: ${colors.dark.lang}; 
}

.percent {
  color: ${colors.light.percent};
}

#gh-dark-mode-only:target .percent {
  color: ${colors.dark.percent};
}
</style>
<g>
<rect x="5" y="5" id="background" />
<g>
<foreignObject x="21" y="17" width="318" height="176">
<div xmlns="http://www.w3.org/1999/xhtml" class="ellipsis">

<h2>Languages Used (By File Size)</h2>

<div>
<span class="progress">
${languageStats
  .map(
    ({ lang, percent, color }) =>
      `<span style="background-color: ${
        color || "#cccccc"
      }; width: ${percent}%;" class="progress-item"></span>`
  )
  .join("")}
</span>
</div>

<ul>
${languageStats
  .map(
    ({ lang, percent, color }, index) => `
<li style="animation-delay: ${index * 150}ms;">
<svg xmlns="http://www.w3.org/2000/svg" class="octicon" style="fill:${
      color || "#cccccc"
    };"
viewBox="0 0 16 16" version="1.1" width="16" height="16"><path
fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8z"></path></svg>
<span class="lang">${lang}</span>
<span class="percent">${percent.toFixed(2)}%</span>
</li>`
  )
  .join("")}
</ul>

</div>
</foreignObject>
</g>
</g>
</svg>`;

  return svgContent;
}

async function createLanguageStatisticsSVG() {
  try {
    const languageStats = await fetchTopLanguages();
    const svg = generateSVG(languageStats);

    const dir = "svg";

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }

    const filePath = path.join(dir, "language_stats.svg");
    fs.writeFileSync(filePath, svg);

    console.log(`Создан svg файл: ${filePath}`);
  } catch (error) {
    console.error("Error generating SVG:", error);
  }
}

createLanguageStatisticsSVG();
