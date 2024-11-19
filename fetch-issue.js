const axios = require("axios");
const fs = require("fs");
const https = require("https")
const path = require("path")

const token = process.env.ISSUSE_TOKEN;
const owner = process.env.GIT_USERNAME;
const repos = (process.env.REPO_NAMES || "").split(";");

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

async function updateReadme(repoPath) {
  const issues = await fetchIssues(repoPath);
  if (!issues) return;

  const readmePath = path.join(__dirname, `${repoPath}_README.md`);

  let readmeContent = `# ${repoPath}\n`;

  for (const issue of issues) {
    const title = issue.title;
    const number = issue.number;
    const url = issue.html_url;
    readmeContent += ` - [${title}](${url}) (#${number})\n`;
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

function createFile(filePath, content) {
  fs.writeFile(filePath, content, (err) => {
    if (err) {
      console.error('Error creating the file:', err);
      return;
    }
    console.log('File created successfully:', filePath);
  });
}

repos.forEach(item => {
  updateReadme(item)
});