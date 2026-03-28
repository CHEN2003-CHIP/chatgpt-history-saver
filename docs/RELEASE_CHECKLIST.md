# Release Checklist / 上架清单

## Before packaging / 打包前检查

- Verify `manifest.json` version number
- 检查 `manifest.json` 版本号
- Reload the unpacked extension in Edge
- 在 Edge 中重新加载未打包扩展
- Test `Export HTML` on a real ChatGPT conversation
- 用真实 ChatGPT 对话测试 `Export HTML`
- Test `Export PDF` on a real ChatGPT conversation
- 用真实 ChatGPT 对话测试 `Export PDF`
- Review icons in `icons/`
- 检查 `icons/` 中的图标是否正常
- Replace the public support email placeholder in the privacy policy
- 将隐私政策中的公开支持邮箱占位符替换成你自己的公开联系邮箱
- Prepare at least 1-3 screenshots for the store listing
- 至少准备 1 到 3 张商店截图

## Package for submission / 打包提交

In PowerShell, from the project root / 在项目根目录 PowerShell 中执行：

```powershell
Compress-Archive -Path manifest.json,background,content,export,popup,shared,icons,README.md,docs -DestinationPath ChatGPT-History-Saver-v0.1.0.zip -Force
```

## Submit to Microsoft Edge Add-ons / 提交到 Microsoft Edge 插件商店

1. Sign in to the Microsoft Edge Add-ons Partner Center
1. 登录 Microsoft Edge Add-ons Partner Center
2. Create a new extension submission
2. 创建新的扩展提交
3. Upload the ZIP package
3. 上传 ZIP 安装包
4. Fill in store title, descriptions, screenshots, and URLs
4. 填写商店标题、描述、截图和相关链接
5. Submit for review
5. 提交审核

## After approval / 审核通过后

- Publish the store listing
- 正式发布插件页面
- Share the public install URL
- 分享公开安装链接
- Track user feedback and increment the version for updates
- 收集用户反馈，并在更新时递增版本号
