const fs = require("fs");
const path = require("path");
const defaultTheme = require("./default");

/**
 * 加载主题：default ← themes/<repo>.js（若存在）
 * 仓库定制主题只需新增同名文件并导出要覆盖的字段即可。
 */
function loadTheme(repoName) {
  const overridePath = path.join(__dirname, `${repoName}.js`);
  if (!fs.existsSync(overridePath)) {
    return { ...defaultTheme };
  }

  // 仓库定制主题只需新增同名文件并导出要覆盖的字段即可。
  const override = require(overridePath);
  return {
    ...defaultTheme,
    ...override,
    categoryIcons: {
      ...defaultTheme.categoryIcons,
      ...(override.categoryIcons || {}),
    },
    badges: {
      ...defaultTheme.badges,
      ...(override.badges || {}),
    },
    labelIcons: override.labelIcons || defaultTheme.labelIcons,
  };
}

module.exports = { loadTheme, defaultTheme };
