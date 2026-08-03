/**
 * 默认通用主题。后续可为仓库新增 themes/<repo>.js 覆盖部分字段。
 * 例如：module.exports = { categoryIcons: { AI: "🤖" } };
 */
module.exports = {
  /** 无仓库描述时不展示副标题 */
  tip: "点击下方目录可跳转到对应分类 · `Ctrl/Cmd + F` 可快速搜索名称",
  collapseThreshold: 8,
  unlabeledIcon: "📦",
  defaultIcon: "🔆",
  labelIcons: ["✂️", "🌱", "👯", "❄️", "📫", "🎅", "🍁", "🛀", "🍃", "🎃", "👻"],
  /** 按 label 名覆盖图标；默认主题为空，保持通用 */
  categoryIcons: {},
  badges: {
    total: "0ea5e9",
    unlabeled: "64748b",
    count: "111827",
  },
  unlabeledDisplayName: "Unlabeled",
  emptyDescriptionPlaceholder: "—",
  collapseSummary: (count) => `点击展开 · ${count} items`,
};
