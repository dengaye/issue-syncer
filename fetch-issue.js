const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");
const { loadTheme } = require("./themes");

let usedLabels = new Map();
/** @type {ReturnType<typeof loadTheme>} */
let theme;

const token = process.env.ISSUSE_TOKEN;
const owner = process.env.GIT_USERNAME;
const repos = (process.env.REPO_NAMES || "")
  .split(";")
  .map((name) => name.trim())
  .filter(Boolean);

async function main() {
  for (const item of repos) {
    usedLabels = new Map();
    theme = loadTheme(item);
    await updateReadme(item);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

async function updateReadme(repoPath) {
  const [issues, repoMeta] = await Promise.all([
    fetchIssues(repoPath),
    fetchRepoMeta(repoPath),
  ]);
  if (!issues) return;

  assignStableIcons(issues);

  const issuesByLabel = groupIssuesByLabel(issues);
  const sortedLabels = Object.keys(issuesByLabel).sort((a, b) => {
    if (a === "default") return 1;
    if (b === "default") return -1;
    return a.localeCompare(b);
  });

  const unlabeledCount = issuesByLabel.default?.length || 0;
  const sections = sortedLabels.map((label) => {
    const displayName =
      label === "default" ? theme.unlabeledDisplayName : label;
    const icon = getCategoryIcon(label, issuesByLabel[label]);
    const heading = `${icon} ${displayName}`;
    return {
      label,
      displayName,
      icon,
      heading,
      anchor: toGithubAnchor(heading),
      issues: issuesByLabel[label].sort((a, b) => b.number - a.number),
    };
  });

  const { badges } = theme;
  let readmeContent = "";
  readmeContent += `<div align="center">\n\n`;
  readmeContent += `# ${repoPath}\n\n`;
  if (repoMeta.description) {
    readmeContent += `**${escapeInline(repoMeta.description)}**\n\n`;
  }
  readmeContent += `![Total](https://img.shields.io/badge/Total-${issues.length}-${badges.total}?style=for-the-badge&logo=github&logoColor=white)\n`;
  readmeContent += `![Unlabeled](https://img.shields.io/badge/Unlabeled-${unlabeledCount}-${badges.unlabeled}?style=for-the-badge)\n\n`;
  readmeContent += `<br/>\n\n`;
  readmeContent += `</div>\n\n`;

  readmeContent += `> [!TIP]\n`;
  readmeContent += `> ${theme.tip}\n\n`;

  readmeContent += `### 📑 Contents\n\n`;
  readmeContent += buildContentsTable(sections);
  readmeContent += `\n<br/>\n\n---\n\n`;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const count = section.issues.length;
    const countLabel = count === 1 ? "1_item" : `${count}_items`;
    const table = buildIssuesTable(section.issues);
    const shouldCollapse =
      section.label === "default" || count >= theme.collapseThreshold;

    readmeContent += `### ${section.heading}\n\n`;

    if (shouldCollapse) {
      readmeContent += `<details>\n`;
      readmeContent += `<summary><b>${theme.collapseSummary(count)}</b></summary>\n\n`;
      readmeContent += `<br/>\n\n`;
      readmeContent += table;
      readmeContent += `\n</details>\n`;
    } else {
      readmeContent += `![count](https://img.shields.io/badge/${countLabel}-${badges.count}?style=flat-square)\n\n`;
      readmeContent += table;
    }

    if (i < sections.length - 1) {
      readmeContent += `\n---\n\n`;
    } else {
      readmeContent += `\n`;
    }
  }

  const readmePath = path.join(__dirname, `${repoPath}_README.md`);
  await fs.writeFile(readmePath, readmeContent);
  console.log("File created successfully:", readmePath);
}

function groupIssuesByLabel(issues) {
  const issuesByLabel = {};

  for (const issue of issues) {
    if (!issue.labels?.length) {
      issuesByLabel.default = issuesByLabel.default || [];
      issuesByLabel.default.push(issue);
      continue;
    }
    for (const label of issue.labels) {
      const labelName = label.name;
      if (!issuesByLabel[labelName]) {
        issuesByLabel[labelName] = [];
      }
      issuesByLabel[labelName].push(issue);
    }
  }

  return issuesByLabel;
}

function buildContentsTable(sections) {
  let table = `| 分类 | 数量 | 分类 | 数量 |\n|:-----|-----:|:-----|-----:|\n`;

  for (let i = 0; i < sections.length; i += 2) {
    const left = sections[i];
    const right = sections[i + 1];
    const leftCell = `[${left.displayName}](#${left.anchor}) | \`${left.issues.length}\``;
    if (right) {
      table += `| ${leftCell} | [${right.displayName}](#${right.anchor}) | \`${right.issues.length}\` |\n`;
    } else {
      table += `| ${leftCell} | | |\n`;
    }
  }

  return table;
}

function buildIssuesTable(issues) {
  let table = `| 名称 | 说明 |\n|:-----|:-----|\n`;
  for (const issue of issues) {
    table += createIssueRow(issue);
  }
  return table;
}

function createIssueRow(issue) {
  const { name, description } = splitTitle(issue.title);
  const safeName = escapeCell(name);
  const safeDesc = escapeCell(description || theme.emptyDescriptionPlaceholder);
  return `| **[${safeName}](${issue.html_url})** | ${safeDesc} |\n`;
}

function splitTitle(title) {
  const separators = ["——", "—", " - "];
  for (const sep of separators) {
    const idx = title.indexOf(sep);
    if (idx !== -1) {
      return {
        name: title.slice(0, idx).trim(),
        description: title.slice(idx + sep.length).trim(),
      };
    }
  }
  return { name: title.trim(), description: "" };
}

function escapeCell(text) {
  return String(text).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function escapeInline(text) {
  return String(text).replace(/\n/g, " ").trim();
}

/** 尽量贴近 GitHub 标题锚点规则（emoji 去掉后可能留下前导 `-`） */
function toGithubAnchor(heading) {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N} -]/gu, "")
    .replace(/ /g, "-");
}

function getCategoryIcon(labelKey, labelIssues) {
  if (labelKey === "default") return theme.unlabeledIcon;
  if (theme.categoryIcons[labelKey]) return theme.categoryIcons[labelKey];

  const firstLabel = labelIssues?.[0]?.labels?.find((l) => l.name === labelKey);
  if (firstLabel && usedLabels.has(firstLabel.id)) {
    return usedLabels.get(firstLabel.id);
  }
  return theme.defaultIcon;
}

const githubHeaders = {
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github.v3+json",
  "User-Agent": "issue-syncer",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestWithRetry(url, params, maxRetries = 5) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await axios.get(url, { headers: githubHeaders, params });
    } catch (error) {
      const status = error.response?.status;
      const headers = error.response?.headers || {};
      const message = error.response?.data?.message || "";
      const isRateLimit =
        status === 429 ||
        (status === 403 &&
          (headers["x-ratelimit-remaining"] === "0" ||
            headers["retry-after"] != null ||
            /rate limit/i.test(message)));

      if (!isRateLimit || attempt === maxRetries) throw error;

      const retryAfter = Number(headers["retry-after"]);
      const delayMs =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : Math.min(1000 * 2 ** attempt, 30000);

      console.warn(
        `Rate limited (${status}), retry ${attempt + 1}/${maxRetries} after ${delayMs}ms`
      );
      await sleep(delayMs);
    }
  }
}

async function fetchRepoMeta(repo) {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}`;
    const response = await requestWithRetry(url);
    return {
      description: (response.data.description || "").trim(),
    };
  } catch (error) {
    console.error("Error fetching repo meta:", error.message || error);
    return { description: "" };
  }
}

async function fetchIssues(repo) {
  try {
    const allIssues = [];
    const perPage = 100;
    let page = 1;
    const url = `https://api.github.com/repos/${owner}/${repo}/issues`;

    while (true) {
      const response = await requestWithRetry(url, {
        state: "all",
        per_page: perPage,
        page,
      });

      const pageIssues = response.data;
      allIssues.push(...pageIssues);

      if (pageIssues.length < perPage) break;
      page++;
    }

    // GitHub Issues API 会把 PR 一并返回，这里只保留真正的 Issue
    return allIssues.filter((issue) => !issue.pull_request);
  } catch (error) {
    console.error("Error fetching issues:", error);
    return "";
  }
}

function assignStableIcons(issues) {
  const uniqueLabels = new Map();
  for (const issue of issues) {
    for (const label of issue.labels || []) {
      uniqueLabels.set(label.id, label);
    }
  }

  const { labelIcons, defaultIcon, categoryIcons } = theme;
  const sortedLabels = [...uniqueLabels.values()].sort((a, b) => a.id - b.id);
  sortedLabels.forEach((label, index) => {
    if (categoryIcons[label.name]) {
      usedLabels.set(label.id, categoryIcons[label.name]);
      return;
    }
    usedLabels.set(
      label.id,
      index < labelIcons.length ? labelIcons[index] : defaultIcon
    );
  });
}
