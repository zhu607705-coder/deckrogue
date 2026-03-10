# Hidden and Cache Directories / 隐藏与缓存目录分类

## SCM / Version Control
- `.git/`
  - 分类：版本控制系统目录
  - 维护者：Git
  - 规则：禁止手工移动或重排内部结构

## Dependencies
- `node_modules/`
  - 分类：依赖安装缓存目录
  - 维护者：npm
  - 规则：通过安装命令重建，不做人为功能分区迁移

## Automation Workspace
- `.playwright-cli/`
  - 分类：浏览器自动化输出目录
  - 内容：日志、页面快照、截图
  - 规则：可清理，不作为源码依赖

## Local Skill Workspace
- `.minimax/`
  - 分类：本地技能与辅助环境目录
  - 规则：按工具约定维护

## IDE Workspace
- `.trae/`
  - 分类：IDE 草稿与规划目录
  - 规则：正式文档迁入 `docs/`
