const axios = require("axios");
const fs = require("fs");
const https = require("https");
const path = require("path");

const icons = ["✂️", "🌱", "👯", "❄️", "📫", "🎅", "🍁", "🛀", "🍃", "🎃", "👻"];
const defaultIcon = "🔆";
let usedLabels = new Map();

const token = process.env.ISSUSE_TOKEN;
const owner = process.env.GIT_USERNAME;
const repos = (process.env.REPO_NAMES || "").split(";");

function main() {
  repos.forEach(item => {
    usedLabels = new Map();
    updateReadme(item)
  });
}

main();

async function updateReadme(repoPath) {
  const issues = await fetchIssues(repoPath);
  if (!issues) return;

  const readmePath = path.join(__dirname, `${repoPath}_README.md`);

  let readmeContent = `# ${repoPath} 📖\n`;
  readmeContent += `### Issue Summary\n`;
  readmeContent += `- Total Issues: ${issues.length} 📝\n`;
  readmeContent += `- Unlabeled Issues: ${issues.filter(issue => !issue.labels?.length).length} ❓\n\n`;

  let issuesByLabel = {};

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
    readmeContent += `## ${label === 'default' ? 'Unlabeled Issues' : label} 🏷️\n`; 

    for (const issue of issuesByLabel[label]) {
      readmeContent += createIssueItem(issue);
    }

    readmeContent += `\n---\n\n`;
  }

  fs.access(readmePath, fs.constants.F_OK, (err) => {
    if (!err) {
      fs.unlink(readmePath, (err) => {
        if (err) {
          console.error('Error deleting the file:', err);
          return;
        }
        createFile(readmePath, readmeContent);
      });
    } else {
      createFile(readmePath, readmeContent);
    }
  });
}

async function fetchIssues(repo) {
  try {
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
    });
    axios.defaults.httpsAgent = httpsAgent;

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
    console.error('Error fetching issues:', error);
    return '';
  }
}

function createFile(filePath, content) {
  fs.writeFile(filePath, content, (err) => {
    if (err) {
      console.error('Error creating the file:', err);
      return;
    }
    console.log('File created successfully:', filePath);
  });
}

function createIssueItem(issue) {
  const { title, html_url, labels } = issue;
  const iconWithLabels = createIcon(labels, [...icons]);
  return `- ${iconWithLabels} [${title}](${html_url})\n`
}

function createIcon(labels, icons) {
  if (!labels.length) return '';
  const iconLength = icons.length;
  const labelLength = labels.length;
  /** 会有多个 icon */
  let displayIcons = '';
  for (const label of labels) {
    const { id } = label;
    const icon = usedLabels.get(id);
    if (icon) {
      /** 如果已匹配 icon, 直接使用 */
      displayIcons += `${icon}`;
    } else {
      if (iconLength >= labelLength) {
        /** 随机选择一个 icon */
        const randomIndex = Math.floor(Math.random() * icons.length);
        const newIcon = icons[randomIndex];
        displayIcons += newIcon;
        usedLabels.set(id, newIcon);
        /** 移除 */
        icons.splice(randomIndex, 1);
      } else {
        usedLabels.set(id, defaultIcon);
        displayIcons = + defaultIcon
      }
    }
  }
  return displayIcons;
}
