const fs = require("fs");
const path = require("path");

const username = process.env.GITHUB_ACTOR;
const token = process.env.ACCESS_TOKEN;

if (!token) {
  console.error("Ошибка: ACCESS_TOKEN не определен в переменных окружения.");
  process.exit(1);
}

const REST_API = "https://api.github.com";

// Colors for light and dark theme (Цвета для светлой и темной темы)
const colors = {
  light: {
    background: "none", // Background color (Фоновый цвет)
    stroke: "none", // Outline color (Цвет обводки)
    iconGithub: "rgb(88, 96, 105)", // GitHub Icon Color (Цвет иконки GitHub)
    titleCards: "#006AFF", // Header Text Color (Цвет текста заголовка)
    textTitle: "#FFFFFF", // Color of statistics column headers (Цвет заголовков столбцов статистики)
    borderColor: "rgb(88, 96, 105)", // Border color of statistics column headers (Цвет обовдки заголовков столбцов статистики)
    folderIcons: "rgb(88, 96, 105)", // Folder Icon Fill Color (Цвет заливки иконок папок)
    folderIconOutline: "rgb(88, 96, 105)", // Folder Icon Outline Color (Цвет обводки иконок папок)
    repositoryText: "#000000", // Repository name color (Цвет названия репозитория)
    uniqueCount: "#000000", // Color of number of visitors (Цвет кол-ва посетителей)
    dateRange: "#000000", // Date range color (Цвет диапазона дат)
  },
  dark: {
    background: "none",
    stroke: "none",
    iconGithub: "#8b949e",
    titleCards: "#006AFF",
    textTitle: "#000000",
    borderColor: "#8b949e",
    folderIcons: "#8b949e",
    folderIconOutline: "#8b949e",
    repositoryText: "#c9d1d9",
    uniqueCount: "#c9d1d9",
    dateRange: "#c9d1d9",
  },
};

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
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else if (!response.ok) {
        throw new Error("Не удалось получить данные из GitHub REST API.");
      }
    } while (response.status === 202);

    return response.json();
  }
}

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
      repos.push(...response.map((repo) => repo.name));
      page++;
    }
  }

  return repos;
}

async function getRepoViews(repos, queries) {
  const repoStats = [];

  for (const repo of repos) {
    try {
      const r = await queries.queryRest(
        `/repos/${username}/${repo}/traffic/views`
      );

      if (r.uniques && r.uniques > 0) {
        const firstView = r.views[0];
        const lastView = r.views[r.views.length - 1];

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
          dateRange,
        });
      }
    } catch (error) {}
  }

  return repoStats;
}

function generateSVG(repoStats) {
  const sortedStats = repoStats.sort((a, b) => b.uniques - a.uniques);
  const topRepos = sortedStats.slice(0, 5);

  const iconColumnWidth = 30;
  const repoColumnWidth = 200;
  const uniquesColumnWidth = 145;
  const dateColumnWidth = 120;

  const rows = Array.isArray(topRepos) ? topRepos : [];

  const rowsHTML = rows
    .map(
      (repo, index) => `
<tr class="repo-row" style="animation-delay: ${index * 0.2}s;">
  <td class="repo-name" style="width: ${repoColumnWidth}px; text-align: left; padding-left: 11.5px;">
    <div style="display: flex; align-items: center;">
      <svg class="folder-icons" width="16" height="16" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
        <path d="M 6 4 C 4.3545455 4 3 5.3545455 3 7 L 3 16 L 3 43 C 3 44.645455 4.3545455 46 6 46 L 44 46 C 45.645455 46 47 44.645455 47 43 L 47 16 L 47 11 C 47 9.3545455 45.645455 8 44 8 L 19 8 C 19.06944 8 18.95032 7.99708 18.705078 7.7167969 C 18.459833 7.4365165 18.160156 6.9707031 17.847656 6.4707031 C 17.535156 5.9707031 17.209833 5.4365165 16.798828 4.9667969 C 16.387823 4.4970773 15.819444 4 15 4 L 6 4 z M 6 6 L 15 6 C 14.93056 6 15.04968 6.00292 15.294922 6.2832031 C 15.540167 6.5634835 15.839844 7.0292969 16.152344 7.5292969 C 16.464844 8.0292969 16.790167 8.5634835 17.201172 9.0332031 C 17.612177 9.5029227 18.180556 10 19 10 L 44 10 C 44.554545 10 45 10.445455 45 11 L 45 13.1875 C 44.685079 13.07397 44.351946 13 44 13 L 6 13 C 5.6480538 13 5.3149207 13.07397 5 13.1875 L 5 7 C 5 6.4454545 5.4454545 6 6 6 z M 6 15 L 44 15 C 44.554545 15 45 15.445455 45 16 L 45 43 C 45 43.554545 44.554545 44 44 44 L 6 44 C 5.4454545 44 5 43.554545 5 43 L 5 16 C 5 15.445455 5.4454545 15 6 15 z" transform="translate(0, -4)" />
      </svg>
      <span style="margin-left: 8px; max-width: ${
        repoColumnWidth - iconColumnWidth - 16
      }px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${
        repo.name
      }</span>
    </div>
  </td>
  <td class="unique-count" style="width: ${uniquesColumnWidth}px; text-align: center; padding-right: 28px;">${
        repo.uniques
      }</td>
  <td class="date-range" style="width: ${dateColumnWidth}px; text-align: center;">${
        repo.dateRange
      }</td>
</tr>
`
    )
    .join("");

  return `
<svg id="gh-dark-mode-only" width="495" height="195" xmlns="http://www.w3.org/2000/svg">
  <style>
    svg {
      font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif, Apple Color Emoji, Segoe UI Emoji;
    }

    #background {
      fill: ${colors.light.background};
      stroke: ${colors.light.stroke};
      stroke-width: 1.7px;
      rx: 6px;
      ry: 6px;
    }

    #gh-dark-mode-only:target #background {
      fill: ${colors.dark.background};
      stroke: ${colors.dark.stroke};
    }

    .title-cards {
      font-size: 16px; 
      font-weight: bold;
      fill: ${colors.light.titleCards}; 
    }

    #gh-dark-mode-only:target .title-cards {
      fill: ${colors.dark.titleCards};
    }

    .github-icon path {
      fill: ${colors.light.iconGithub};
    }

    #gh-dark-mode-only:target .github-icon path {
      fill: ${colors.dark.iconGithub};
    }

    th {
      font-size: 12px;
      font-weight: 600;
      color: ${colors.light.textTitle};
      text-shadow: 
        1px 1px 0px ${colors.light.borderColor}, 
        -1px -1px 0px ${colors.light.borderColor}, 
        1px -1px 0px ${colors.light.borderColor}, 
        -1px 1px 0px ${colors.light.borderColor};
      padding-bottom: 5px;
    }

    #gh-dark-mode-only:target th {
      color: ${colors.dark.textTitle};
      text-shadow: 
        0.7px 0.7px 0px ${colors.dark.borderColor}, 
        -0.7px -0.7px 0px ${colors.dark.borderColor}, 
        0.7px -0.7px 0px ${colors.dark.borderColor}, 
        -0.7px 0.7px 0px ${colors.dark.borderColor};
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

    .repo-name {
      font-size: 13px;
      font-weight: 600;
      color: ${colors.light.repositoryText};
      line-height: 1.8; 
    }

    #gh-dark-mode-only:target .repo-name {
      color: ${colors.dark.repositoryText};
    }

    .unique-count {
      font-size: 12px;
      font-weight: 600;
      color: ${colors.light.uniqueCount};
    }

    #gh-dark-mode-only:target .unique-count {
      color: ${colors.dark.uniqueCount};
    }

    .date-range {
      font-size: 12px;
      font-weight: 600; 
      color: ${colors.light.dateRange};
    }

    #gh-dark-mode-only:target .date-range {
      color: ${colors.dark.dateRange};
    }

    @keyframes fadein {
      0% { opacity: 0; }
      100% { opacity: 1; }
    }

    .repo-row {
      opacity: 0;
      animation: fadein 0.5s ease-in forwards;
    }
  </style>
  <g>
    <rect id="background" x="0" y="0" width="495" height="195" />
    
    <g transform="translate(30, 12)">
      <svg class="github-icon" width="18" height="18" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
        <path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
      </svg>
      <text class="title-cards" x="25" y="15" font-family="Arial">Top 5 Repositories by Traffic (past two weeks)</text>
    </g>

    <foreignObject x="11.5" y="45" width="472" height="245">
      <table xmlns="http://www.w3.org/1999/xhtml" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="width: ${repoColumnWidth}px; text-align: left; padding-left: 36.5px;">Repository</th>
            <th style="width: ${uniquesColumnWidth}px; text-align: center; padding-right: 28px;">Uniques</th>
            <th style="width: ${dateColumnWidth}px; text-align: center;">Date Range</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHTML}
        </tbody>
      </table>
    </foreignObject>
  </g>
</svg>
`;
}

async function main() {
  try {
    const queries = new GitHubQueries(token);
    const repos = await getRepos(username, queries);
    const repoStats = await getRepoViews(repos, queries);
    const svg = generateSVG(repoStats);
    const svgDir = path.resolve(__dirname, "..", "svg");
    if (!fs.existsSync(svgDir)) {
      fs.mkdirSync(svgDir, { recursive: true });
    }

    const svgFilePath = path.join(svgDir, "traffic_stats.svg");
    fs.writeFileSync(svgFilePath, svg);
    console.log("Создан svg файл: traffic_stats.svg");
  } catch (error) {
    console.error("Error generating SVG:", error);
  }
}

main();
