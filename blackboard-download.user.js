// ==UserScript==
// @name         Blackboard 一键下载
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  在 Blackboard 课程内容页一键批量下载课件。需先进入某个课程的文件目录（URL 含 listContent.jsp）才会出现下载按钮。
// @author       JesperroO
// @match        https://*/webapps/blackboard/content/listContent.jsp*
// @grant        GM_notification
// ==/UserScript==

(function() {
    'use strict';

    if (!window.location.href.includes('listContent.jsp')) return;

    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get('course_id');
    const contentId = urlParams.get('content_id');

    if (!courseId || !contentId) return;

    const btn = document.createElement('button');
    btn.textContent = '📥 一键下载';
    btn.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        z-index: 99999;
        padding: 12px 20px;
        background: #28a745;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
        font-weight: bold;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    `;

    btn.onclick = async () => {
        btn.textContent = '⏳ 验证登录...';
        btn.disabled = true;

        try {
            const testResp = await fetch(window.location.href, { credentials: 'include' });
            if (testResp.url.includes('login') || testResp.url.includes('relogin')) {
                alert('请先登录 Blackboard！');
                btn.textContent = '📥 一键下载';
                btn.disabled = false;
                return;
            }
        } catch (e) {}

        btn.textContent = '🔍 扫描中...';

        const baseUrl = window.location.origin;
        const filesByUrl = new Map(); // url -> { url, displayName, folderPath }，自动去重
        const visited = new Set();
        let folderCount = 0;

        function updateScanStatus() {
            btn.textContent = `🔍 ${folderCount} 个文件夹 / ${filesByUrl.size} 个文件`;
        }

        async function fetchFolder(cid, folderPath) {
            if (visited.has(cid)) return;
            visited.add(cid);
            folderCount++;
            updateScanStatus();

            const url = `${baseUrl}/webapps/blackboard/content/listContent.jsp?course_id=${courseId}&content_id=${cid}`;
            const response = await fetch(url, { credentials: 'include' });
            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');

            // 提取文件链接及 BB 显示名，以 URL 为 key 去重（保留先发现的路径）
            doc.querySelectorAll('a[href*="/bbcswebdav/"]').forEach(a => {
                const href = a.getAttribute('href');
                if (filesByUrl.has(href)) return;
                const li = a.closest('li');
                const displayName = (
                    li?.querySelector('.item-name')?.textContent?.trim() ||
                    a.textContent.trim() ||
                    href.split('/').pop()
                );
                filesByUrl.set(href, { url: href, displayName, folderPath });
                updateScanStatus();
            });

            // 并行递归子文件夹
            const subTasks = [];
            doc.querySelectorAll('a[href*="listContent.jsp"]').forEach(a => {
                try {
                    const params = new URLSearchParams(new URL(a.href).search);
                    const fid = params.get('content_id');
                    if (!fid || fid === cid || visited.has(fid)) return;
                    const folderName = (
                        a.closest('li')?.querySelector('.item-name')?.textContent?.trim() ||
                        a.textContent.trim() ||
                        fid
                    );
                    const newPath = folderPath ? `${folderPath}/${folderName}` : folderName;
                    subTasks.push(fetchFolder(fid, newPath));
                } catch (e) {}
            });
            await Promise.all(subTasks);
        }

        await fetchFolder(contentId, '');
        const fileMap = [...filesByUrl.values()];

        if (fileMap.length === 0) {
            alert('未找到任何文件');
            btn.textContent = '📥 一键下载';
            btn.disabled = false;
            return;
        }

        btn.textContent = `📥 下载 0/${fileMap.length}`;

        // 从 Content-Disposition 或最终 URL 解析真实文件名
        function resolveFilename(item, response) {
            const disposition = response.headers.get('Content-Disposition');
            if (disposition) {
                // 优先 filename*=UTF-8''... 格式
                let m = disposition.match(/filename\*=UTF-8''([^;\n]+)/i);
                if (m) return decodeURIComponent(m[1].trim());
                m = disposition.match(/filename="?([^";\n]+)"?/i);
                if (m) return decodeURIComponent(m[1].trim());
            }
            // 跟随重定向后的最终 URL
            if (response.url && response.url !== `${baseUrl}${item.url}`) {
                const urlName = decodeURIComponent(response.url.split('/').pop().split('?')[0]);
                if (urlName && urlName !== 'xid') return urlName;
            }
            // 回退到 BB 显示名（确保有扩展名）
            return item.displayName;
        }

        function sanitize(name) {
            return name.replace(/[/\\:*?"<>|]/g, '_').trim();
        }

        // 并行下载，最多 3 个同时进行
        let done = 0, failed = 0;

        async function attemptDownload(item) {
            const fileUrl = `${baseUrl}${item.url}`;
            const response = await fetch(fileUrl, { credentials: 'include' });
            const serverName = resolveFilename(item, response);
            const prefix = item.folderPath ? sanitize(item.folderPath).replace(/\//g, ' - ') + ' - ' : '';
            const filename = prefix + sanitize(serverName);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }

        async function downloadOne(item) {
            try {
                await attemptDownload(item);
                done++;
            } catch (e) {
                // 失败后重试一次
                try {
                    await new Promise(r => setTimeout(r, 1000));
                    await attemptDownload(item);
                    done++;
                } catch (e2) {
                    console.error(`Failed: ${item.url}`, e2);
                    failed++;
                }
            }
            btn.textContent = `📥 下载中 ${done + failed}/${fileMap.length}`;
        }

        async function runConcurrent(tasks, concurrency) {
            const queue = [...tasks];
            const workers = Array(concurrency).fill(null).map(async () => {
                while (queue.length) {
                    const task = queue.shift();
                    await task();
                    // 小延迟避免浏览器拦截连续下载
                    await new Promise(r => setTimeout(r, 300));
                }
            });
            await Promise.all(workers);
        }

        const tasks = fileMap.map(item => () => downloadOne(item));
        await runConcurrent(tasks, 3);

        btn.textContent = '✅ 完成!';
        setTimeout(() => {
            btn.textContent = '📥 一键下载';
            btn.disabled = false;
        }, 3000);

        alert(`下载完成！\n成功: ${done}\n失败: ${failed}`);
    };

    document.body.appendChild(btn);
})();
