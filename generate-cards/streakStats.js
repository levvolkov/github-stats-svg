const fs = require("fs");
const path = require("path");

const username = process.env.GITHUB_ACTOR;
const token = process.env.ACCESS_TOKEN;

if (!token) {
  console.error(
    "Error: ACCESS_TOKEN is not defined in the environment variables."
  );
  process.exit(1);
}

const GRAPHQL_API = "https://api.github.com/graphql";

// Colors for light and dark theme (Цвета для светлой и темной темы)
const colors = {
  light: {
    background: "none", // Background color (Цвет фона)
    stroke: "none", // Outline color (Цвет обводки)
    stat: "#000000", // Color of statistics (Цвет статистики)
    label: "#000000", // Color of labels (Цвет меток)
    date: "#006AFF", // Color of dates (Цвет дат)
    divider: "#006AFF", // Color of dividers (Цвет разделителей)
    ring: "#006AFF", // Ring color (Цвет кольца)
    fire: "#006AFF", // Fire icon color (Цвет иконки огня)
    footer: "#000000", // Footer color (Цвет футера)
  },
  dark: {
    background: "none",
    stat: "#c9d1d9",
    label: "#c9d1d9",
    date: "#006AFF",
    divider: "#006AFF",
    ring: "#006AFF",
    fire: "#006AFF",
    footer: "#c9d1d9",
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
  allContributionDays.sort((a, b) => new Date(a.date) - new Date(b.date));

  let longestStreak = 0;
  let longestStreakStart = null;
  let longestStreakEnd = null;

  let currentStreak = 0;
  let currentStreakStart = null;
  let lastContributionDate = null;

  const today = new Date().toISOString().split("T")[0];

  for (const { date, contributionCount } of allContributionDays) {
    if (date > today) continue;
    if (contributionCount > 0) {
      if (!lastContributionDate) {
        currentStreak = 1;
        currentStreakStart = date;
      } else {
        const prev = new Date(lastContributionDate);
        const curr = new Date(date);
        const diffDays = Math.floor((curr - prev) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          currentStreak++;
        } else {
          currentStreak = 1;
          currentStreakStart = date;
        }
      }
      if (currentStreak > longestStreak) {
        longestStreak = currentStreak;
        longestStreakStart = currentStreakStart;
        longestStreakEnd = date;
      }
      lastContributionDate = date;
    }
  }

  let isCurrentStreakActive = lastContributionDate === today;

  return {
    currentStreak: isCurrentStreakActive ? currentStreak : 0,
    currentStreakStart: isCurrentStreakActive ? currentStreakStart : null,
    longestStreak,
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

    // Formatting time for "Updated last at" (Форматирование времени для "Updated last at")
    const lastUpdate = new Date()
      .toLocaleString("en", {
        timeZone: "Europe/Moscow", // Time Zone (Часовой пояс)
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
      .replace(",", "");

    let svgContent = `<svg id="gh-dark-mode-only" width="495" height="195" xmlns="http://www.w3.org/2000/svg">
<style>
svg {
  font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif, Apple Color Emoji, Segoe UI Emoji;
  font-size: 12px; 
  line-height: 18px; 
}

@keyframes fadein {
  0% { opacity: 0; }
  100% { opacity: 1; }
}

@keyframes currstreak {
  0% { font-size: 3px; opacity: 0.2; }
  80% { font-size: 28px; opacity: 1; }
  100% { font-size: 24px; opacity: 1; }
}

.stat {
  font: bold 28px sans-serif; 
  fill: ${colors.light.stat};
}

#gh-dark-mode-only:target .stat {
  fill: ${colors.dark.stat};
}

.label {
  font: bold 14px sans-serif; 
  fill: ${colors.light.label};
}

#gh-dark-mode-only:target .label {
  fill: ${colors.dark.label};
}

.date {
  font: 12px sans-serif; 
  fill: ${colors.light.date};
}

#gh-dark-mode-only:target .date {
  fill: ${colors.dark.date};
}

.divider {
  stroke: ${colors.light.divider};
  stroke-width: 1;
}

#gh-dark-mode-only:target .divider {
  stroke: ${colors.dark.divider};
}

.footer {
  font: 10px sans-serif; 
  fill: ${colors.light.footer};
}

#gh-dark-mode-only:target .footer {
  fill: ${colors.dark.footer};
}

#background {
  fill: ${colors.light.background};
  stroke: ${colors.light.stroke};
  stroke-width: 1px;
  rx: 6px; 
  ry: 6px; 
}

#gh-dark-mode-only:target #background {
  fill: ${colors.dark.background};
}

.ring {
  stroke: ${colors.light.ring};
}

#gh-dark-mode-only:target .ring {
  stroke: ${colors.dark.ring};
}

.fire {
  fill: ${colors.light.fire};
}

#gh-dark-mode-only:target .fire {
  fill: ${colors.dark.fire};
}
</style>

<!-- Background -->
<rect width="100%" height="100%" id="background" rx="15" />

<!-- Divider Lines -->
<line x1="165" y1="25" x2="165" y2="170" class="divider" />
<line x1="330" y1="25" x2="330" y2="170" class="divider" />

<!-- Section 1: Total Contributions -->
<g transform="translate(82.5, 70)">
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
<g style="isolation: isolate" transform="translate(247.5, 70)">
  <g mask="url(#ringMask)">
    <circle cx="0" cy="0" r="37" fill="none" class="ring" stroke-width="8"
           style="opacity: 0; animation: fadein 0.5s linear forwards 0.4s"/>
  </g>
  <defs>
    <mask id="ringMask">
      <rect x="-50" y="-50" width="100" height="100" fill="white" />
      <circle cx="0" cy="0" r="37" fill="black" />
      <ellipse cx="0" cy="-37" rx="15" ry="10" />
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
  <g transform="translate(0, -50)" stroke-opacity="0"
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
<g transform="translate(412.5, 70)">
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
<g transform="translate(247.5, 180)">
  <text class="footer" x="0" y="5" text-anchor="middle" style="opacity: 0; animation: fadein 0.5s linear forwards 1.6s">
    Updated last at: ${lastUpdate}
  </text>
</g>
</svg>
`;

    const outputPath = path.join("svg", "streak_stats.svg");
    fs.writeFileSync(outputPath, svgContent);
    console.log(`Создан svg файл: ${outputPath}`);
  } catch (error) {
    console.error("Error generating SVG:", error);
  }
}

function isNextDay(previousDate, currentDate) {
  const prev = new Date(previousDate);
  const curr = new Date(currentDate);

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
