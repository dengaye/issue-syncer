const axios = require("axios");
const fs = require("fs");
const https = require("https");
const path = require("path");

const icons = ["✂️", "🌱", "👯", "❄️", "📫", "🎅", "🍁", "🛀", "🍃", "🎃"	, "👻"];
const defaultIcon =  "🔆";
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

  let readmeContent = `# ${repoPath}\n`;

  let issuesByLabel = {};

  for (const issue of issues) {
    for (const label of issue.labels) {
      const labelName = label.name;
      if (issuesByLabel[labelName]) {
        issuesByLabel[labelName].push(issue);
      } else {
        issuesByLabel[labelName] = [issue]
      }
    }
  }

  for (const [label, labelIssues] of Object.entries(issuesByLabel)) {
    readmeContent += `## ${label}\n`;

    for (const issue of labelIssues) {
    readmeContent += createIssueItem(issue);
    readmeContent += createIssueItem(issue);
      readmeContent += createIssueItem(issue);
    }

    readmeContent += `\n`;
  }


  fs.access(readmePath, fs.constants.F_OK, (err) => {
    if (!err) {
      fs.unlink(readmePath, (err) => {
        if (err) {
          console.error('Error deleting the file:', err);
          return;
        }
        createFile(readmePath, readmeContent)
      });
    } else {
      createFile(readmePath, readmeContent)
    }
  })
}

async function fetchIssues(repo) {
  try {
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
    })
    axios.defaults.httpsAgent = httpsAgent
    const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/issues`, {
      headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3+json" }
    });

    return response.data;
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
  const { title, number, html_url, labels } = issue;
  const iconWithLabels = createIcon(labels, [...icons]);
  return `- ${iconWithLabels} [${title}](${html_url}) (#${number})\n`
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
        displayIcons =+ defaultIcon
      }
    }
  }
  return displayIcons;
}
