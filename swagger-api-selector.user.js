// ==UserScript==
// @name         Swagger API 接口选择器
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  在 Swagger UI 页面底部添加可搜索的接口下拉框
// @author       You
// @match        https://*/*/swagger-ui/*
// @match        http://*/*/swagger-ui/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    // 等待页面加载完成
    function waitForElement(selector, callback) {
        const element = document.querySelector(selector);
        if (element) {
            callback(element);
        } else {
            setTimeout(() => waitForElement(selector, callback), 100);
        }
    }

    // 从 API 文档地址获取接口数据
    async function getApiData() {
        try {
            // 从当前URL动态构建API文档地址
            const currentUrl = window.location.href;
            const baseUrl = currentUrl.split('/datahome/')[0] + '/datahome';
            const apiDocsUrl = `${baseUrl}/v3/api-docs`;
            
            const response = await fetch(apiDocsUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const apiDoc = await response.json();
            const apiData = [];
            
            // 解析 OpenAPI 文档中的接口信息
            if (apiDoc.paths) {
                Object.entries(apiDoc.paths).forEach(([path, pathItem]) => {
                    // 支持的 HTTP 方法
                    const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];
                    
                    Object.entries(pathItem).forEach(([method, operation]) => {
                        // 只处理 HTTP 方法，跳过 $ref 等特殊属性
                        if (httpMethods.includes(method.toLowerCase()) && typeof operation === 'object') {
                            apiData.push({
                                id: apiData.length,
                                method: method.toUpperCase(),
                                path: path,
                                summary: operation.summary || operation.description || '无描述',
                                fullText: `${method.toUpperCase()} ${path} ${operation.summary || operation.description || ''}`.toLowerCase(),
                                tags: operation.tags || [],
                                operationId: operation.operationId,
                                description: operation.description || ''
                            });
                        }
                    });
                });
            }
            
            console.log(`从 API 文档获取到 ${apiData.length} 个接口`);
            return apiData;
        } catch (error) {
            console.error('获取 API 数据失败:', error);
            // 如果 API 请求失败，回退到从 DOM 提取
            return getApiDataFromDOM();
        }
    }

    // 从 DOM 提取接口数据（备用方案）
    function getApiDataFromDOM() {
        const apiData = [];
        
        // 从 Swagger UI 中提取接口信息
        const operationElements = document.querySelectorAll('.opblock');
        
        operationElements.forEach((element, index) => {
            const method = element.querySelector('.opblock-summary-method')?.textContent?.trim();
            const path = element.querySelector('.opblock-summary-path')?.textContent?.trim();
            const summary = element.querySelector('.opblock-summary-description')?.textContent?.trim();
            
            if (method && path) {
                apiData.push({
                    id: index,
                    method: method,
                    path: path,
                    summary: summary || '无描述',
                    fullText: `${method} ${path} ${summary || ''}`.toLowerCase()
                });
            }
        });
        
        console.log(`从 DOM 提取到 ${apiData.length} 个接口`);
        return apiData;
    }

    // 创建搜索下拉框
    function createApiSelector() {
        const container = document.createElement('div');
        container.id = 'api-selector-container';
        container.innerHTML = `
            <div class="api-selector-wrapper">
                <div class="api-selector-header">
                    <h3>接口快速选择</h3>
                    <button id="toggle-selector" class="toggle-btn">收起</button>
                </div>
                <div class="api-selector-content">
                    <div class="search-box">
                        <input type="text" id="api-search" placeholder="搜索接口..." />
                        <div class="search-icon">🔍</div>
                    </div>
                    <div class="api-list" id="api-list">
                        <!-- 接口列表将在这里动态生成 -->
                    </div>
                </div>
            </div>
        `;

        // 添加样式
        const style = document.createElement('style');
        style.id = 'swagger-api-selector-styles';
        style.textContent = `
            #api-selector-container {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: #fff;
                border-top: 2px solid #3b82f6;
                box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.15);
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                max-height: 60vh;
                transition: all 0.3s ease;
            }

            .api-selector-wrapper {
                padding: 16px;
            }

            .api-selector-wrapper.collapsed {
                padding: 8px 16px;
            }

            .api-selector-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
                padding-bottom: 8px;
                border-bottom: 1px solid #e5e7eb;
            }

            .api-selector-header h3 {
                margin: 0;
                color: #1f2937;
                font-size: 16px;
                font-weight: 600;
            }

            .toggle-btn {
                background: #3b82f6;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                transition: background-color 0.2s;
            }

            .toggle-btn:hover {
                background: #2563eb;
            }

            .api-selector-content {
                max-height: 400px;
                overflow: hidden;
                transition: max-height 0.3s ease;
            }

            .api-selector-content.collapsed {
                max-height: 0;
                padding: 0;
                margin: 0;
            }

            .search-box {
                position: relative;
                margin-bottom: 12px;
            }

            #api-search {
                width: 100%;
                padding: 10px 40px 10px 12px;
                border: 2px solid #e5e7eb;
                border-radius: 8px;
                font-size: 14px;
                outline: none;
                transition: border-color 0.2s;
                box-sizing: border-box;
            }

            #api-search:focus {
                border-color: #3b82f6;
            }

            .search-icon {
                position: absolute;
                right: 12px;
                top: 50%;
                transform: translateY(-50%);
                color: #6b7280;
                pointer-events: none;
            }

            .api-list {
                max-height: 300px;
                overflow-y: auto;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                background: #fafafa;
            }

            .api-item {
                padding: 12px;
                border-bottom: 1px solid #e5e7eb;
                cursor: pointer;
                transition: background-color 0.2s;
                display: flex;
                align-items: flex-start;
                gap: 8px;
            }

            .api-item:last-child {
                border-bottom: none;
            }

            .api-item:hover {
                background: #f3f4f6;
            }

            .api-item.highlighted {
                background: #dbeafe;
            }

            .method-badge {
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                min-width: 50px;
                text-align: center;
            }

            .method-get { background: #10b981; color: white; }
            .method-post { background: #3b82f6; color: white; }
            .method-put { background: #f59e0b; color: white; }
            .method-delete { background: #ef4444; color: white; }
            .method-patch { background: #8b5cf6; color: white; }

            .api-info {
                flex: 1;
            }

            .api-path {
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                font-size: 13px;
                color: #374151;
                font-weight: 500;
            }

            .api-summary {
                color: #6b7280;
                font-size: 12px;
                margin-top: 2px;
                line-height: 1.4;
            }

            .api-tags {
                color: #9ca3af;
                font-size: 11px;
                margin-top: 4px;
                font-style: italic;
            }

            .no-results {
                padding: 20px;
                text-align: center;
                color: #6b7280;
                font-style: italic;
            }

            /* 滚动条样式 */
            .api-list::-webkit-scrollbar {
                width: 6px;
            }

            .api-list::-webkit-scrollbar-track {
                background: #f1f1f1;
                border-radius: 3px;
            }

            .api-list::-webkit-scrollbar-thumb {
                background: #c1c1c1;
                border-radius: 3px;
            }

            .api-list::-webkit-scrollbar-thumb:hover {
                background: #a8a8a8;
            }
            
            /* 强制样式优先级 */
            #api-selector-container * {
                box-sizing: border-box !important;
            }
            
            #api-selector-container {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
            }
            
            /* 动画样式 */
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;

        // 确保样式正确应用
        if (!document.getElementById('swagger-api-selector-styles')) {
            document.head.appendChild(style);
        }
        
        // 备用样式应用方法
        setTimeout(() => {
            const existingStyle = document.getElementById('swagger-api-selector-styles');
            if (!existingStyle) {
                document.head.appendChild(style.cloneNode(true));
            }
        }, 100);
        
        document.body.appendChild(container);
        
        // 强制应用内联样式作为备用
        container.style.cssText = `
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            background: #fff !important;
            border-top: 2px solid #3b82f6 !important;
            box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.15) !important;
            z-index: 10000 !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            max-height: 60vh !important;
            display: block !important;
            visibility: visible !important;
        `;

        return container;
    }

    // 渲染接口列表
    function renderApiList(apiData, searchTerm = '') {
        const apiList = document.getElementById('api-list');
        if (!apiList) return;

        const filteredData = apiData.filter(api => 
            api.fullText.includes(searchTerm.toLowerCase())
        );

        if (filteredData.length === 0) {
            apiList.innerHTML = '<div class="no-results">未找到匹配的接口</div>';
            return;
        }

        apiList.innerHTML = filteredData.map(api => `
            <div class="api-item" data-path="${api.path}" data-method="${api.method}" data-operation-id="${api.operationId || ''}" data-tags="${api.tags ? api.tags.join(',') : ''}">
                <span class="method-badge method-${api.method.toLowerCase()}">${api.method}</span>
                <div class="api-info">
                    <div class="api-path">${api.path}</div>
                    <div class="api-summary">${api.summary}</div>
                    ${api.tags && api.tags.length > 0 ? `<div class="api-tags">标签: ${api.tags.join(', ')}</div>` : ''}
                </div>
            </div>
        `).join('');

        // 添加点击事件
        apiList.querySelectorAll('.api-item').forEach(item => {
            item.addEventListener('click', async () => {
                const path = item.dataset.path;
                const method = item.dataset.method;
                const operationId = item.dataset.operationId;
                const tags = item.dataset.tags ? item.dataset.tags.split(',') : [];
                
                // 使用新的定位函数（现在是异步的）
                const targetElement = await findApiElement(path, method, operationId, tags);
                
                if (targetElement) {
                    
                    // 滚动到目标元素
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    // 高亮显示
                    const originalBorder = targetElement.style.border;
                    const originalBorderRadius = targetElement.style.borderRadius;
                    const originalBoxShadow = targetElement.style.boxShadow;
                    
                    targetElement.style.border = '3px solid #3b82f6';
                    targetElement.style.borderRadius = '6px';
                    targetElement.style.boxShadow = '0 0 10px rgba(59, 130, 246, 0.5)';
                    
                    // 展开接口详情
                    const summaryElement = targetElement.querySelector('.opblock-summary');
                    if (summaryElement) {
                        summaryElement.click();
                    }
                    
                    // 恢复样式
                    setTimeout(() => {
                        targetElement.style.border = originalBorder;
                        targetElement.style.borderRadius = originalBorderRadius;
                        targetElement.style.boxShadow = originalBoxShadow;
                    }, 3000);
                    
                    // 搜索完成后收起下拉框
                    const content = document.querySelector('.api-selector-content');
                    const wrapper = document.querySelector('.api-selector-wrapper');
                    const toggleBtn = document.getElementById('toggle-selector');
                    if (content && wrapper && toggleBtn) {
                        content.classList.add('collapsed');
                        wrapper.classList.add('collapsed');
                        toggleBtn.textContent = '展开';
                    }
                } else {
                    showErrorMessage(`未找到接口: ${method} ${path}`);
                }
            });
        });
    }

    // 初始化搜索功能
    function initSearch(apiData) {
        const searchInput = document.getElementById('api-search');
        if (!searchInput) return;

        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                renderApiList(apiData, e.target.value);
            }, 150);
        });

        // 键盘导航
        let selectedIndex = -1;
        searchInput.addEventListener('keydown', (e) => {
            const items = document.querySelectorAll('.api-item');
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                updateSelection(items, selectedIndex);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, -1);
                updateSelection(items, selectedIndex);
            } else if (e.key === 'Enter' && selectedIndex >= 0) {
                e.preventDefault();
                items[selectedIndex]?.click();
            } else if (e.key === 'Escape') {
                searchInput.blur();
            }
        });

        function updateSelection(items, index) {
            items.forEach((item, i) => {
                item.classList.toggle('highlighted', i === index);
            });
        }
    }

    // 初始化折叠功能
    function initToggle() {
        const toggleBtn = document.getElementById('toggle-selector');
        const content = document.querySelector('.api-selector-content');
        const wrapper = document.querySelector('.api-selector-wrapper');
        
        if (!toggleBtn || !content || !wrapper) return;

        let isCollapsed = false;
        
        toggleBtn.addEventListener('click', () => {
            isCollapsed = !isCollapsed;
            content.classList.toggle('collapsed', isCollapsed);
            wrapper.classList.toggle('collapsed', isCollapsed);
            toggleBtn.textContent = isCollapsed ? '展开' : '收起';
        });
    }


    // 显示错误消息
    function showErrorMessage(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ef4444;
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            font-size: 14px;
            z-index: 10001;
            box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
            animation: slideIn 0.3s ease;
        `;
        toast.textContent = `❌ ${message}`;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
    }

    // 等待 Swagger UI 完全加载
    function waitForSwaggerUI() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 20; // 最多等待10秒
            
            const checkSwaggerUI = () => {
                attempts++;
                console.log(`检查 Swagger UI 加载状态 (${attempts}/${maxAttempts})...`);
                
                const swaggerUI = document.querySelector('.swagger-ui');
                const opblocks = document.querySelectorAll('.opblock');
                const swaggerContainer = document.querySelector('#swagger-ui');
                
                // 更宽松的检测条件
                if (swaggerUI || swaggerContainer) {
                    console.log(`Swagger UI 已加载，找到 ${opblocks.length} 个接口块`);
                    resolve();
                    return;
                }
                
                // 如果达到最大尝试次数，强制继续
                if (attempts >= maxAttempts) {
                    console.log('达到最大等待时间，强制继续初始化');
                    resolve();
                    return;
                }
                
                console.log('等待 Swagger UI 加载...');
                setTimeout(checkSwaggerUI, 500);
            };
            checkSwaggerUI();
        });
    }

    // 正确的接口定位函数
    function findApiElement(path, method, operationId, tags = []) {
        return new Promise((resolve) => {
            // 1. 先找到接口所属的标签
            const targetTag = findTargetTag(path, method, tags);
            
            if (!targetTag) {
                resolve(null);
                return;
            }
            
            // 2. 展开目标标签
            const isOpen = targetTag.dataset.isOpen === 'true';
            if (!isOpen) {
                targetTag.click();
            }
            
            // 3. 等待标签展开后查找接口
            setTimeout(() => {
                const targetApi = findApiInTag(targetTag, path, method);
                resolve(targetApi);
            }, 100);
        });
    }
    
    // 查找接口所属的标签
    function findTargetTag(path, method, tags = []) {
        // 查找所有标签
        const allTags = document.querySelectorAll('.opblock-tag');
        
        // 1. 优先通过 API tags 匹配
        if (tags.length > 0) {
            for (const apiTag of tags) {
                for (const tag of allTags) {
                    const tagName = tag.dataset.tag;
                    if (tagName && tagName.toLowerCase() === apiTag.toLowerCase()) {
                        return tag;
                    }
                }
            }
        }
        
        // 2. 如果 API tags 没匹配到，根据路径推断标签名称
        const pathSegments = path.split('/').filter(segment => segment && !segment.startsWith('{'));
        const possibleTags = pathSegments.slice(0, 2); // 取前两个路径段作为可能的标签
        
        for (const tag of allTags) {
            const tagName = tag.querySelector('.opblock-tag-section h4')?.textContent?.trim();
            if (tagName) {
                // 检查标签名是否包含路径的关键部分
                const hasMatch = possibleTags.some(segment => 
                    tagName.toLowerCase().includes(segment.toLowerCase())
                );
                
                if (hasMatch) {
                    return tag;
                }
            }
        }
        
        // 3. 如果都没找到匹配的标签，返回第一个标签作为默认
        if (allTags.length > 0) {
            return allTags[0];
        }
        
        return null;
    }
    
    // 在指定标签下查找接口
    function findApiInTag(tag, path, method) {
        // 找到标签下的所有接口
        const tagSection = tag.nextElementSibling;
        if (!tagSection) {
            return null;
        }
        
        const apis = tagSection.querySelectorAll('.opblock');
        
        for (const api of apis) {
            const pathEl = api.querySelector('.opblock-summary-path');
            const methodEl = api.querySelector('.opblock-summary-method');
            
            if (pathEl && methodEl) {
                const apiPath = pathEl.dataset.path;
                const apiMethod = methodEl.textContent.trim().toLowerCase();
                
                if (apiPath === path && apiMethod === method.toLowerCase()) {
                    return api;
                }
            }
        }
        
        return null;
    }

    // 主函数
    async function init() {
        try {
            // 创建选择器（不等待 Swagger UI）
            createApiSelector();
            
            // 显示加载状态
            const apiList = document.getElementById('api-list');
            if (apiList) {
                apiList.innerHTML = '<div class="no-results">正在加载接口数据...</div>';
            }
            
            // 获取接口数据
            const apiData = await getApiData();
            
            if (apiData.length === 0) {
                // 等待一下再尝试从 DOM 提取
                setTimeout(async () => {
                    const domData = getApiDataFromDOM();
                    if (domData.length > 0) {
                        renderApiList(domData);
                        initSearch(domData);
                        initToggle();
                    } else {
                        if (apiList) {
                            apiList.innerHTML = '<div class="no-results">未找到接口数据</div>';
                        }
                    }
                }, 2000);
                return;
            }
            
            // 初始化功能
            renderApiList(apiData);
            initSearch(apiData);
            initToggle();
            
            // 检查样式是否正确应用
            setTimeout(() => {
                const container = document.getElementById('api-selector-container');
                if (container) {
                    const styles = window.getComputedStyle(container);
                    
                    if (styles.display === 'none' || styles.visibility === 'hidden') {
                        container.style.display = 'block';
                        container.style.visibility = 'visible';
                    }
                }
            }, 1000);
            
        } catch (error) {
            console.error('初始化失败:', error);
            const apiList = document.getElementById('api-list');
            if (apiList) {
                apiList.innerHTML = '<div class="no-results">加载失败，请刷新页面重试</div>';
            }
        }
    }

    // 防止重复初始化
    if (window.swaggerApiSelectorInitialized) {
        return;
    }
    window.swaggerApiSelectorInitialized = true;

    // 启动脚本
    
    // 等待页面加载完成后再启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // 页面已经加载完成，延迟一下启动
        setTimeout(init, 1000);
    }
})();
