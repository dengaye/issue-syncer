const fs = require('fs');
const axios = require('axios');

const owner = 'dengaye';
const repo = 'collector';
const token = process.env.GITHUB_TOKEN;

async function updateReadme() {
  try {
    const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/issues`, {
      headers: { Authorization: `token ${token}` }
    });

    const issues = response.data.map(issue => `- [${issue.title}](${issue.html_url})`).join('\n');

    let readmeContent = fs.readFileSync('README.md', 'utf-8');
    const sectionTitle = `$# {repo}`;
    const startIndex = readmeContent.indexOf(sectionTitle);

    if (startIndex !== -1) {
      const before = readmeContent.substring(0, startIndex + sectionTitle.length);
      const afterIndex = readmeContent.indexOf('##', startIndex + sectionTitle.length);
      const after = afterIndex !== -1 ? readmeContent.substring(afterIndex) : '';
      readmeContent = `${before}\n\n${issues}\n\n${after}`;
      fs.writeFileSync('README.md', readmeContent);
    }
  } catch (error) {
    console.error('Error fetching issues:', error);
  }
}

updateReadme();