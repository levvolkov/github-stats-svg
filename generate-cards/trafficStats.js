const fs = require("fs");
const path = require("path");

// GitHub username и токен из переменных окружения
const username = process.env.GITHUB_ACTOR;
const token = process.env.ACCESS_TOKEN; 

if (!token) {
  console.error("Ошибка: ACCESS_TOKEN не определен в переменных окружения.");
  process.exit(1);
}

const REST_API = "https://api.github.com"; // GitHub REST API endpoint

// Цвета для светлой и темной тем
const colors = {
  light: {
    // Цвета для светлой темы
    background: "none", // Фоновый цвет
    stroke: "rgb(225, 228, 232)", // Цвет обводки
    iconGithub: "rgb(88, 96, 105)", // Цвет иконки GitHub
    textTitle: "#006AFF", // Цвет текста заголовка
    folderIcons: "rgb(88, 96, 105)", // Цвет заливки иконок папок
    folderIconOutline: "rgb(88, 96, 105)", // Цвет обводки иконок папок
    repositoryText: "#000000", // Цвет названия репозитория
    uniqueCount: "#000000", // Цвет кол-ва посетителей
    visitorsText: "rgb(88, 96, 105)", // Цвет текста "visitors"
    dateRange: "rgb(88, 96, 105)", // Цвет диапазона дат
  },
  dark: {
    // Цвета для темной темы
    background: "none", // Фоновый цвет
    stroke: "rgba(225, 228, 232, 0.5)", // Цвет обводки
    iconGithub: "#8b949e", // Цвет иконки GitHub
    textTitle: "#006AFF", // Цвет текста заголовка
    folderIcons: "#006AFF", // Цвет заливки иконок папок
    folderIconOutline: "#006AFF", // Цвет обводки иконок папок
    repositoryText: "#c9d1d9", // Цвет названия репозитория
    uniqueCount: "#c9d1d9", // Цвет кол-ва посетителей
    visitorsText: "#8b949e", // Цвет текста "visitors"
    dateRange: "#8b949e", // Цвет диапазона дат
  },
};

// Класс для работы с REST API
class GitHubQueries {
  constructor(token) {
    this.token = token;
  }

  async queryRest(endpoint) {
    let response;
    do {
      response = await fetch(`${REST_API}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 202) {
        // Данные еще не готовы, ждем 1 секунду и повторяем запрос
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else if (!response.ok) {
        const errorText = await response.text();
        console.error("Ошибка GitHub REST API:", errorText);
        throw new Error("Не удалось получить данные из GitHub REST API.");
      }
    } while (response.status === 202);

    return response.json();
  }
}

// Функция для получения списка репозиториев
async function getRepos(username, queries) {
  const repos = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await queries.queryRest(
      `/users/${username}/repos?page=${page}&per_page=100`
    );
    if (response.length === 0) {
      hasMore = false;
    } else {
      repos.push(...response.map((repo) => repo.full_name));
      page++;
    }
  }

  return repos;
}

// Функция для получения статистики просмотров репозиториев
async function getRepoViews(repos, queries) {
  const repoStats = [];

  for (const repo of repos) {
    try {
      const r = await queries.queryRest(`/repos/${repo}/traffic/views`);
      console.log(`Данные о просмотрах для репозитория ${repo}:`, r);

      // Добавляем репозиторий в статистику только если есть уникальные посетители
      if (r.uniques && r.uniques > 0) {
        // Извлекаем первую и последнюю дату из массива views
        const firstView = r.views[0];
        const lastView = r.views[r.views.length - 1];

        // Форматируем даты в DD.MM
        const formatDate = (timestamp) => {
          const date = new Date(timestamp);
          const day = String(date.getDate()).padStart(2, "0");
          const month = String(date.getMonth() + 1).padStart(2, "0");
          return `${day}.${month}`;
        };

        const dateRange =
          firstView && lastView
            ? `${formatDate(firstView.timestamp)} - ${formatDate(
                lastView.timestamp
              )}`
            : "N/A";

        repoStats.push({
          name: repo,
          uniques: r.uniques,
          dateRange, // Добавляем диапазон дат
        });
      }
    } catch (error) {
      console.error(
        `Ошибка получения просмотров для репозитория ${repo}:`,
        error.message
      );
    }
  }

  return repoStats;
}

// Функция для генерации SVG на основе статистики
function generateSVG(repoStats) {
  // Сортируем репозитории по количеству уникальных посетителей (по убыванию)
  const sortedStats = repoStats.sort((a, b) => b.uniques - a.uniques);

  // Берем только первые 5 репозиториев
  const topRepos = sortedStats.slice(0, 5);

  const rows = topRepos
    .map(
      (repo, index) => `
<tr>
  <td style="animation-delay: ${index * 150}ms">
    <!-- Иконка папки -->
    <svg class="folder-icons" width="16" height="16" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
      <path d="M 6 4 C 4.3545455 4 3 5.3545455 3 7 L 3 16 L 3 43 C 3 44.645455 4.3545455 46 6 46 L 44 46 C 45.645455 46 47 44.645455 47 43 L 47 16 L 47 11 C 47 9.3545455 45.645455 8 44 8 L 19 8 C 19.06944 8 18.95032 7.99708 18.705078 7.7167969 C 18.459833 7.4365165 18.160156 6.9707031 17.847656 6.4707031 C 17.535156 5.9707031 17.209833 5.4365165 16.798828 4.9667969 C 16.387823 4.4970773 15.819444 4 15 4 L 6 4 z M 6 6 L 15 6 C 14.93056 6 15.04968 6.00292 15.294922 6.2832031 C 15.540167 6.5634835 15.839844 7.0292969 16.152344 7.5292969 C 16.464844 8.0292969 16.790167 8.5634835 17.201172 9.0332031 C 17.612177 9.5029227 18.180556 10 19 10 L 44 10 C 44.554545 10 45 10.445455 45 11 L 45 13.1875 C 44.685079 13.07397 44.351946 13 44 13 L 6 13 C 5.6480538 13 5.3149207 13.07397 5 13.1875 L 5 7 C 5 6.4454545 5.4454545 6 6 6 z M 6 15 L 44 15 C 44.554545 15 45 15.445455 45 16 L 45 43 C 45 43.554545 44.554545 44 44 44 L 6 44 C 5.4454545 44 5 43.554545 5 43 L 5 16 C 5 15.445455 5.4454545 15 6 15 z" transform="translate(0, -2)" />
    </svg>
    <span style="font-weight: 600;">${repo.name.split("/")[1]}</span>
  </td>
  <td style="animation-delay: ${index * 150}ms">
  <span class="unique-count" style="font-weight: 600;">${repo.uniques}</span>
  <span class="visitors-text"> visitors </span>
  <span class="date-range">(${repo.dateRange})</span>
</td>
</tr>
`
    )
    .join("");

  return `
<svg id="gh-dark-mode-only" width="500" height="${
    topRepos.length * 30 + 50
  }" xmlns="http://www.w3.org/2000/svg">
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
  stroke: ${colors.light.stroke};
  stroke-width: 1px;
  rx: 6px;
  ry: 6px;
}

#gh-dark-mode-only:target #background {
  fill: ${colors.dark.background};
  stroke: ${colors.dark.stroke};
  stroke-width: 1px;
}

foreignObject {
  width: 100%;
  height: 100%;
}

table {
  width: 100%;
  border-collapse: collapse;
  table-layout: auto;
}

.github-icon {
    width: 18px; 
    height: 18px; 
    vertical-align: middle;
    margin-right: 8px;
}

.github-icon path{
   fill: ${colors.light.iconGithub};
}

#gh-dark-mode-only:target .github-icon path {
  fill: ${colors.dark.iconGithub};
}

th {
  padding: 0.5em;
  padding-top: 0;
  text-align: left;
  font-size: 16px;
  font-weight: 600;
  color: ${colors.light.textTitle};
}

#gh-dark-mode-only:target th {
  color: ${colors.dark.textTitle};
}

.folder-icons {
  vertical-align: middle; 
}

.folder-icons path {
  fill: ${colors.light.folderIcons}; 
  stroke: ${colors.light.folderIconOutline}; 
  stroke-width: 1; 
}

#gh-dark-mode-only:target .folder-icons path {
  fill: ${colors.dark.folderIcons}; 
  stroke: ${colors.dark.folderIconOutline}; 
}

td {
  margin-bottom: 16px; 
  margin-top: 8px; 
  padding: 0.25em; 
  font-size: 12px; 
  line-height: 18px; 
  color: ${colors.light.repositoryText};
  opacity: 0; 
  transform: translateY(20px); 
  animation: slideIn 0.5s ease-out forwards; 
}

#gh-dark-mode-only:target td {
  color: ${colors.dark.repositoryText};
}

.unique-count {
  color: ${colors.light.uniqueCount};
}

#gh-dark-mode-only:target .unique-count {
  color: ${colors.dark.uniqueCount};
}

.visitors-text {
  font-size: 12px; 
  color: ${colors.light.visitorsText};
}

#gh-dark-mode-only:target .visitors-text {
  color: ${colors.dark.visitorsText};
}

.date-range {
  color: ${colors.light.dateRange};
}

#gh-dark-mode-only:target .date-range {
  color: ${colors.dark.dateRange};
}

@keyframes slideIn {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
<g>
<rect x="5" y="5" id="background" rx="6" ry="6" />
<g>
<foreignObject x="21" y="21" width="100%" height="100%">
<div xmlns="http://www.w3.org/1999/xhtml">

<table>
<thead><tr>
<th colspan="2">
  <!-- Иконка GitHub -->
  <svg class="github-icon" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
    <path fill-rule="evenodd"  d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
  </svg>
  Top 5 Repositories by Traffic (past two weeks)
</th>
</tr></thead>
<tbody>
${rows}
</tbody>
</table>

</div>
</foreignObject>
</g>
</g>
</svg>
`;
}

// Основная функция для получения статистики и генерации SVG
async function main() {
  try {
    const queries = new GitHubQueries(token);

    // Получаем список репозиториев
    const repos = await getRepos(username, queries);

    // Получаем статистику просмотров для каждого репозитория
    const repoStats = await getRepoViews(repos, queries);

    // Генерация SVG
    const svg = generateSVG(repoStats);

    // Создание папки svg, если она не существует
    const svgDir = path.resolve(__dirname, "..", "svg"); // Путь к папке svg в корне проекта
    if (!fs.existsSync(svgDir)) {
      fs.mkdirSync(svgDir, { recursive: true });
    }

    // Сохранение SVG в файл
    const svgFilePath = path.join(svgDir, "traffic_stats.svg");
    fs.writeFileSync(svgFilePath, svg);
    console.log("Создан svg файл: traffic_stats.svg");
  } catch (error) {
    console.error("Error generating SVG:", error);
  }
}

main();
