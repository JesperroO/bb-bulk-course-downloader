# Blackboard 一键下载

Tampermonkey 脚本，在 Blackboard 课程文件目录页右上角加一个下载按钮，点一下把整个目录（含子文件夹）的课件全下了。

支持所有用 Blackboard Learn 的学校，不只是港中深。

## 安装

1. 装 [Tampermonkey](https://www.tampermonkey.net/)
2. 从 **[Greasy Fork](#)** 安装 *(链接待更新)*，或点本页 `blackboard-download.user.js` 的 **Raw** 按钮，Tampermonkey 会弹安装提示

## 用法

登录 BB → 进任意课程的文件目录（URL 含 `listContent.jsp`）→ 右上角点 **📥 一键下载**。

按钮只在文件目录页出现，课程主页不会有。

## 功能

- 递归扫描子文件夹，并行抓取
- 扫描和下载进度实时显示在按钮上
- 文件名用真实名称（读 `Content-Disposition` header），不是 BB 内部的 `xid-XXXXXX`
- 子文件夹里的文件加路径前缀，比如 `Week3 - Slides - lecture.pdf`
- 同一文件多处引用只下一次
- 3 个并发，失败自动重试

## 说明

- 下载到浏览器默认下载目录
- 只访问你自己有权限看的文件，没有绕过登录
- 代码无混淆，无外部请求
