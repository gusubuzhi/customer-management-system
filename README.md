# 客户管理系统 · 样有回音

用于管理客户咨询后的打样、寄样反馈与订单跟进。当前提供客户档案、打样记录、今日跟进、沟通历史、历史表格导入和备份恢复。

## 本地运行

先安装 Node.js 的 LTS 版本，在项目目录打开终端：

```sh
npm start
```

然后访问 http://127.0.0.1:4173 。本项目不需要安装额外依赖。也可直接打开 `dist/index.html`，但本地文件和网页服务使用不同的数据空间，建议固定使用网页服务。

## 在另一台电脑下载

```sh
git clone https://github.com/gusubuzhi/customer-management-system.git
cd customer-management-system
npm start
```

也可在 GitHub 点击 **Code → Download ZIP**，解压后运行。

## 数据保存

当前为单人浏览器本地版，客户数据保存在当前浏览器、当前网址的本地存储中，没有服务器数据库，不会跨电脑自动同步。换电脑前先在“数据与备份”导出，再在新电脑恢复。导入 Excel、CSV 等文件时，仅在浏览器本地解析。

本仓库仅包含程序代码、虚构示例和测试，不包含真实客户记录、历史导入表、数据备份或部署凭据。请勿把这些资料提交到公开仓库；`.gitignore` 提供基础排除规则，但提交前仍应检查文件内容。

## 验证

```sh
npm test
```

详细操作见 [使用说明](使用说明.md)。Excel 解析组件为 SheetJS CE，随附其 [许可文件](dist/vendor/SHEETJS-LICENSE.txt)。
