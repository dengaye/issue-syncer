const axios = require("axios");
const fs = require("fs").promises;
const path = require("path");

const icons = ["✂️", "🌱", "👯", "❄️", "📫", "🎅", "🍁", "🛀", "🍃", "🎃", "👻"];
const defaultIcon = "🔆";
let usedLabels = new Map();

const token = process.env.ISSUSE_TOKEN;
const owner = process.env.GIT_USERNAME;
const repos = (process.env.REPO_NAMES || "")
  .split(";")
  .map((name) => name.trim())
  .filter(Boolean);

async function main() {
  for (const item of repos) {
    usedLabels = new Map();
    await updateReadme(item);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

async function updateReadme(repoPath) {
  const issues = await fetchIssues(repoPath);
  if (!issues) return;

  assignStableIcons(issues);

  const readmePath = path.join(__dirname, `${repoPath}_README.md`);
  const openCount = issues.filter((issue) => issue.state === "open").length;
  const closedCount = issues.length - openCount;

  let readmeContent = `# ${repoPath} 📖\n`;
  readmeContent += `### Issue Summary\n`;
  readmeContent += `- Total Issues: ${issues.length} 📝\n`;
  readmeContent += `- Open: ${openCount} 🟢\n`;
  readmeContent += `- Closed: ${closedCount} 🔴\n`;
  readmeContent += `- Unlabeled Issues: ${issues.filter((issue) => !issue.labels?.length).length} ❓\n\n`;

  const issuesByLabel = {};

  for (const issue of issues) {
    if (!issue.labels?.length) {
      issuesByLabel.default = issuesByLabel.default || [];
      issuesByLabel.default.push(issue);
      continue;
    }
    for (const label of issue.labels) {
      const labelName = label.name;
      if (issuesByLabel[labelName]) {
        issuesByLabel[labelName].push(issue);
      } else {
        issuesByLabel[labelName] = [issue];
      }
    }
  }

  const sortedLabels = Object.keys(issuesByLabel).sort();

  for (const label of sortedLabels) {
    readmeContent += `## ${label === "default" ? "Unlabeled Issues" : label} 🏷️\n`;

    const sortedIssues = issuesByLabel[label].sort((a, b) => b.number - a.number);
    for (const issue of sortedIssues) {
      readmeContent += createIssueItem(issue);
    }

    readmeContent += `\n---\n\n`;
  }

  await fs.writeFile(readmePath, readmeContent);
  console.log("File created successfully:", readmePath);
}

async function fetchIssues(repo) {
  try {
    const allIssues = [];
    const perPage = 100;
    let page = 1;

    while (true) {
      const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/issues`, {
        headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" },
        params: { state: "all", per_page: perPage, page },
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

  const sortedLabels = [...uniqueLabels.values()].sort((a, b) => a.id - b.id);
  sortedLabels.forEach((label, index) => {
    usedLabels.set(label.id, index < icons.length ? icons[index] : defaultIcon);
  });
}

function createIssueItem(issue) {
  const { title, html_url, labels, state } = issue;
  const stateIcon = state === "open" ? "🟢" : "🔴";
  const iconWithLabels = createIcon(labels);
  const labelIcons = iconWithLabels ? ` ${iconWithLabels}` : "";
  return `- ${stateIcon}${labelIcons} [${title}](${html_url})\n`;
}

function createIcon(labels) {
  if (!labels.length) return "";
  return labels.map((label) => usedLabels.get(label.id) || defaultIcon).join("");
}
