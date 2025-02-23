const fs = require("fs");
const path = require("path");

const username = "levvolkov";
const token = process.env.GITHUB_TOKEN;

if (!token) {
  console.error(
    "Error: GITHUB_TOKEN is not defined in the environment variables."
  );
  process.exit(1);
}

const GRAPHQL_API = "https://api.github.com/graphql";

// Цвета для светлой и темной темы
const colors = {
  light: {
    background: "none", // Прозрачный фон
    stat: "#000000", // Цвет статистики
    label: "#000000", // Цвет меток
    date: "#006AFF", // Цвет дат
    divider: "#006AFF", // Цвет разделителей
    ring: "#006AFF", // Цвет кольца
    fire: "#006AFF", // Цвет иконки огня
    footer: "#000000", // Цвет футера
  },
  dark: {
    background: "none", // Прозрачный фон
    stat: "#c9d1d9", // Цвет статистики
    label: "#c9d1d9", // Цвет меток
    date: "#006AFF", // Цвет дат
    divider: "#006AFF", // Цвет разделителей
    ring: "#006AFF", // Цвет кольца
    fire: "#006AFF", // Цвет иконки огня
    footer: "#c9d1d9", // Цвет футера
  },
};

// Вспомогательная функция для выполнения запросов GraphQL
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

// Функция для получения даты создания аккаунта пользователя
async function fetchUserCreationDate() {
  const query = `
    query ($username: String!) {
      user(login: $username) {
        createdAt
      }
    }
  `;

  const variables = { username };
  const data = await fetchFromGitHub(query, variables);
  return new Date(data.user.createdAt);
}

// Вспомогательная функция для получения максимального 1-летнего периода вкладов
async function fetchContributionsForPeriod(fromDate, toDate) {
  const query = `
    query ($username: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $username) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }
  `;

  const variables = {
    username,
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
  };

  const data = await fetchFromGitHub(query, variables);
  return data.user.contributionsCollection.contributionCalendar;
}

// Функция для получения всех вкладов пользователя с момента первого вклада до настоящего времени, по годам
async function fetchAllContributions(userCreationDate, now) {
  let currentStart = new Date(userCreationDate);
  let allContributionDays = [];
  let totalContributionsSum = 0;

  while (currentStart < now) {
    const currentEnd = new Date(
      Math.min(
        new Date(
          currentStart.getFullYear() + 1,
          currentStart.getMonth(),
          currentStart.getDate()
        ).getTime(),
        now.getTime()
      )
    );

    const contributions = await fetchContributionsForPeriod(
      currentStart,
      currentEnd
    );
    totalContributionsSum += contributions.totalContributions;

    contributions.weeks.forEach((week) => {
      week.contributionDays.forEach((day) => {
        allContributionDays.push(day);
      });
    });

    currentStart = currentEnd;
  }

  return { allContributionDays, totalContributionsSum };
}

function calculateStreaksAndTotals(allContributionDays) {
  let currentStreak = 0;
  let longestStreak = 0;
  let currentStreakStart = null;
  let longestStreakStart = null;
  let longestStreakEnd = null;
  let lastContributedDate = null;
  const today = new Date().toISOString().split("T")[0];

  allContributionDays.sort((a, b) => new Date(a.date) - new Date(b.date));

  for (const { date, contributionCount } of allContributionDays) {
    if (date > today) continue;
    const currentDay = new Date(date);
    const dayOfWeek = currentDay.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (contributionCount > 0) {
      if (!lastContributedDate || isNextDay(lastContributedDate, date)) {
        currentStreak++;
        if (currentStreak === 1) currentStreakStart = date;
      } else {
        currentStreak = 1;
        currentStreakStart = date;
      }
      lastContributedDate = date;
      if (currentStreak > longestStreak) {
        longestStreak = currentStreak;
        longestStreakStart = currentStreakStart;
        longestStreakEnd = date;
      }
    } else if (isWeekend) {
      currentStreak++;
    } else {
      currentStreak = 0;
      currentStreakStart = null;
      lastContributedDate = null;
    }
  }

  return {
    currentStreak,
    longestStreak,
    currentStreakStart,
    longestStreakStart,
    longestStreakEnd,
  };
}

async function fetchEarliestCommitDate() {
  let hasNextPage = true;
  let endCursor = null;
  let earliestCommitDate = null;

  while (hasNextPage) {
    const query = `
      query ($username: String!, $after: String) {
        user(login: $username) {
          repositories(first: 100, after: $after, isFork: false, ownerAffiliations: OWNER, privacy: PUBLIC, orderBy: {field: CREATED_AT, direction: ASC}) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              name
              createdAt
            }
          }
        }
      }
    `;

    const variables = { username, after: endCursor };
    const data = await fetchFromGitHub(query, variables);
    const repositories = data.user.repositories.nodes;

    for (const repo of repositories) {
      const repoCreatedAt = new Date(repo.createdAt);
      if (!earliestCommitDate || repoCreatedAt < earliestCommitDate) {
        earliestCommitDate = repoCreatedAt;
      }
    }

    hasNextPage = data.user.repositories.pageInfo.hasNextPage;
    endCursor = data.user.repositories.pageInfo.endCursor;
  }

  return earliestCommitDate;
}

async function generateSVG() {
  try {
    const userCreationDate = await fetchUserCreationDate();
    const now = new Date();

    const { allContributionDays, totalContributionsSum } =
      await fetchAllContributions(userCreationDate, now);

    const {
      currentStreak,
      longestStreak,
      currentStreakStart,
      longestStreakStart,
      longestStreakEnd,
    } = calculateStreaksAndTotals(allContributionDays);

    const mostRecentCommitDate = now;

    const formatDate = (date) => {
      if (!date) return "N/A";
      const options = { year: "numeric", month: "short", day: "numeric" };
      return date.toLocaleDateString("en", options);
    };

    const commitDateRange = userCreationDate
      ? `${formatDate(userCreationDate)} - ${formatDate(mostRecentCommitDate)}`
      : "N/A";

    const longestStreakDates =
      longestStreak > 0 && longestStreakStart && longestStreakEnd
        ? `${formatDate(new Date(longestStreakStart))} - ${formatDate(
            new Date(longestStreakEnd)
          )}`
        : "N/A";

    // Форматирование времени для "Updated last at"
    const lastUpdate = new Date()
      .toLocaleString("en", {
        timeZone: "Europe/Moscow",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false, // Используем 24-часовой формат
      })
      .replace(",", ""); // Убираем запятую после года

    function generateStyles(theme) {
      return `
    --background: ${colors[theme].background};
    --stat-color: ${colors[theme].stat};
    --label-color: ${colors[theme].label};
    --date-color: ${colors[theme].date};
    --divider-color: ${colors[theme].divider};
    --ring-color: ${colors[theme].ring};
    --fire-color: ${colors[theme].fire};
    --footer-color: ${colors[theme].footer};
  `;
    }

    const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
style="isolation: isolate" viewBox="0 0 600 200" width="600px" height="200px">
<style>
  /* Dark theme by default */
  :root {
    ${generateStyles("dark")}
  }

  @media (prefers-color-scheme: light) {
    :root {
      ${generateStyles("light")}
    }
  }

  @keyframes fadein {
    0% { opacity: 0; }
    100% { opacity: 1; }
  }

  @keyframes currstreak {
    0% { font-size: 3px; opacity: 0.2; }
    80% { font-size: 34px; opacity: 1; }
    100% { font-size: 28px; opacity: 1; }
  }

  .stat {
    font: bold 28px sans-serif;
    fill: var(--stat-color);
  }

  .label {
    font: bold 14px sans-serif;
    fill: var(--label-color);
  }

  .date {
    font: 12px sans-serif;
    fill: var(--date-color);
  }

  .divider {
    stroke: var(--divider-color);
    stroke-width: 1;
  }

  .footer {
    font: 10px sans-serif;
    font-weight: 100;
    fill: var(--footer-color);
  }

  .background {
    fill: var(--background);
    stroke: rgb(225, 228, 232);
    stroke-width: 0.7px;
    rx: 6px; /* Скругление углов */
    ry: 6px; /* Скругление углов */
  }

  .ring {
    stroke: var(--ring-color);
  }

  .fire {
    fill: var(--fire-color);
  }

  /* Стили для рамки */
  .border {
    fill: none;
    stroke: rgb(225, 228, 232);
    stroke-width: 0.3px;
    rx: 6px; 
    ry: 6px; 
  }
</style>

<!-- Background -->
<rect width="100%" height="100%" class="background" rx="15" />

<!-- Border -->
<rect width="calc(100% - 2px)" height="calc(100% - 2px)" x="1" y="1" class="border" />

<!-- Divider Lines -->
<line x1="200" y1="25" x2="200" y2="175" class="divider" />
<line x1="400" y1="25" x2="400" y2="175" class="divider" />

<!-- Section 1: Total Contributions -->
<g transform="translate(100, 70)">
  <text class="stat" y="15" text-anchor="middle" style="opacity: 0; animation: fadein 0.5s linear forwards 0.6s">
    ${totalContributionsSum}
  </text>
  <text class="label" y="55" text-anchor="middle" style="opacity: 0; animation: fadein 0.5s linear forwards 0.7s">
    Total Contributions
  </text>
  <text class="date" y="85" text-anchor="middle" style="opacity: 0; animation: fadein 0.5s linear forwards 0.8s">
    ${commitDateRange}
  </text>
</g>

<!-- Section 2: Current Streak -->
<g style="isolation: isolate" transform="translate(300, 70)">
  <g mask="url(#ringMask)">
    <circle cx="0" cy="0" r="40" fill="none" class="ring" stroke-width="8"
           style="opacity: 0; animation: fadein 0.5s linear forwards 0.4s"/>
  </g>
  <defs>
    <mask id="ringMask">
      <rect x="-50" y="-40" width="100" height="100" fill="white" />
      <circle cx="0" cy="0" r="40" fill="black" />
      <ellipse cx="0" cy="-40" rx="20" ry="15" />
    </mask>
  </defs>

  <text class="stat" y="10" text-anchor="middle" 
        style="opacity: 0; animation: currstreak 0.6s linear forwards 0s">
    ${currentStreak}
  </text>

  <text class="label" y="70" text-anchor="middle" style="opacity: 0; animation: fadein 0.5s linear forwards 0.9s">
    Current Streak
  </text>

  <text class="date" y="95" text-anchor="middle" style="opacity: 0; animation: fadein 0.5s linear forwards 1.0s">
    ${
      currentStreak > 0 && currentStreakStart
        ? `${formatDate(new Date(currentStreakStart))} - ${formatDate(
            mostRecentCommitDate
          )}`
        : "N/A"
    }
  </text>

  <!-- Fire icon -->
<g transform="translate(0, -60)" stroke-opacity="0"
style="opacity: 0; animation: fadein 0.5s linear forwards 0.6s">
<path d="M -12 -0.5 L 15 -0.5 L 15 23.5 L -12 23.5 L -12 -0.5 Z" fill="none"/>
<path class="fire" d="M 1.5 0.67 C 1.5 0.67 2.24 3.32 2.24 5.47 C 2.24 7.53 0.89 9.2 -1.17 9.2
C -3.23 9.2 -4.79 7.53 -4.79 5.47 L -4.76 5.11
C -6.78 7.51 -8 10.62 -8 13.99 C -8 18.41 -4.42 22 0 22
C 4.42 22 8 18.41 8 13.99
C 8 8.6 5.41 3.79 1.5 0.67 Z
M -0.29 19 C -2.07 19 -3.51 17.6 -3.51 15.86
C -3.51 14.24 -2.46 13.1 -0.7 12.74
C 1.07 12.38 2.9 11.53 3.92 10.16
C 4.31 11.45 4.51 12.81 4.51 14.2
C 4.51 16.85 2.36 19 -0.29 19 Z"
 stroke-opacity="0"/>
</g>
</g>

<!-- Section 3: Longest Streak -->
<g transform="translate(500, 70)">
  <text class="stat" y="15" text-anchor="middle" style="opacity: 0; animation: fadein 0.5s linear forwards 1.2s">
    ${longestStreak}
  </text>
  <text class="label" y="55" text-anchor="middle" style="opacity: 0; animation: fadein 0.5s linear forwards 1.3s">
    Longest Streak
  </text>
  <text class="date" y="85" text-anchor="middle" style="opacity: 0; animation: fadein 0.5s linear forwards 1.4s">
    ${longestStreakDates}
  </text>
</g>

<!-- Footer -->
<g transform="translate(300, 185)">
  <text class="footer" x="0" y="5" text-anchor="middle" style="opacity: 0; animation: fadein 0.5s linear forwards 1.6s">
    Updated last at: ${lastUpdate}
  </text>
</g>
</svg>
`;

    // Сохраняем в папку svg
    const outputPath = path.join("svg", "streak_stats.svg");
    fs.writeFileSync(outputPath, svgContent);
    console.log(`Создан svg файл: ${outputPath}`);
  } catch (error) {
    console.error("Error generating SVG:", error);

    // Генерация резервного SVG в случае ошибки
    const fallbackSVG = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 200">
      <rect width="100%" height="100%" fill="#f0f6fc" rx="10" />
      <text x="50%" y="45%" text-anchor="middle" font-family="sans-serif" fill="#000" font-size="16">
        Error loading GitHub stats
      </text>
    </svg>`;

    const fallbackPath = path.join("svg", "error_streak_stats.svg");
    fs.writeFileSync(fallbackPath, fallbackSVG);
  }
}

// Вспомогательная функция для проверки, являются ли две даты последовательными
function isNextDay(previousDate, currentDate) {
  const prev = new Date(previousDate);
  const curr = new Date(currentDate);

  // Нормализовать обе даты до полуночи по времени UTC
  const prevUTC = Date.UTC(
    prev.getUTCFullYear(),
    prev.getUTCMonth(),
    prev.getUTCDate()
  );
  const currUTC = Date.UTC(
    curr.getUTCFullYear(),
    curr.getUTCMonth(),
    curr.getUTCDate()
  );

  const diffDays = Math.floor((currUTC - prevUTC) / (1000 * 60 * 60 * 24));
  return diffDays === 1;
}

generateSVG().catch((error) => console.error("Runtime error:", error));
