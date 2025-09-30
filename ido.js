// ==UserScript==
// @name         缓存刷新（订单）- ingress 删除缓存
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  在发布SQL列表页右侧添加“缓存刷新”按钮，批量删除订单缓存（支持逗号/换行分隔）
// @author       You
// @match        http://ido.ihomefnt.com/*
// @grant        GM_xmlhttpRequest
// @connect      ingress.ihomefnt.com
// ==/UserScript==

(function () {
    'use strict';

    const TARGET_HASH_PREFIX = '#/sql/release-sqllist';
    const API_BASE = 'http://ingress.ihomefnt.com/saas-decorator';
    const DEFAULT_TENANT_ID = '100001';

    // 仅在目标页面生效（hash 路由）
    function onRouteReady() {
        if (!location.hash.startsWith(TARGET_HASH_PREFIX)) return;
        ensureUIInjected();
    }

    const styleId = 'order-cache-refresh-style';
    function injectStyles() {
        if (document.getElementById(styleId)) return;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .ocr-floating-btn {
                position: fixed;
                right: 20px;
                top: 140px;
                z-index: 99999;
                background: #10b981;
                color: #fff;
                border: none;
                border-radius: 6px;
                padding: 10px 14px;
                cursor: pointer;
                box-shadow: 0 4px 10px rgba(16,185,129,0.25);
                font-size: 12px;
            }
            .ocr-modal-mask {
                position: fixed; inset: 0;
                background: rgba(0,0,0,0.45);
                z-index: 100000;
                display: flex; align-items: center; justify-content: center;
            }
            .ocr-modal {
                width: 560px; max-width: 90vw;
                background: #fff; border-radius: 8px;
                box-shadow: 0 6px 20px rgba(0,0,0,0.2);
                overflow: hidden; font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;
            }
            .ocr-modal-header {
                padding: 12px 16px; font-weight: 600; background: #f9fafb; border-bottom: 1px solid #eef2f7;
            }
            .ocr-modal-body {
                padding: 14px 16px; display: flex; flex-direction: column; gap: 10px;
            }
            .ocr-row { display: flex; align-items: center; gap: 8px; }
            .ocr-row label { width: 80px; color: #374151; font-size: 12px; }
            .ocr-input, .ocr-textarea {
                width: 100%; box-sizing: border-box;
                border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; font-size: 12px;
            }
            .ocr-textarea { height: 140px; resize: vertical; }
            .ocr-hint { color: #6b7280; font-size: 12px; }
            .ocr-modal-footer {
                padding: 12px 16px; display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid #eef2f7; background: #fafafa;
            }
            .ocr-btn {
                border: none; border-radius: 6px; padding: 8px 12px; cursor: pointer; font-size: 12px;
            }
            .ocr-btn-primary { background: #2563eb; color: #fff; }
            .ocr-btn-danger { background: #ef4444; color: #fff; }
            .ocr-btn-ghost { background: #fff; color: #374151; border: 1px solid #e5e7eb; }
            .ocr-log {
                background: #0b1221; color: #e5e7eb; border-radius: 6px; padding: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; height: 140px; overflow: auto;
            }
            .ocr-pill {
                display: inline-block; padding: 2px 6px; border-radius: 999px; font-size: 11px; margin-left: 6px; border: 1px solid #e5e7eb; color: #6b7280;
            }
            .ocr-badge { font-weight: 600; }
            .ocr-kv { display: inline-flex; gap: 4px; align-items: baseline; }
        `;
        document.head.appendChild(style);
    }

    let injected = false;
    function ensureUIInjected() {
        if (injected) return;
        injectStyles();

        // 悬浮按钮
        const btn = document.createElement('button');
        btn.className = 'ocr-floating-btn';
        btn.textContent = '缓存刷新';
        btn.title = '批量删除订单缓存';
        btn.addEventListener('click', openModal);
        document.body.appendChild(btn);

        injected = true;
    }

    function openModal() {
        const mask = document.createElement('div');
        mask.className = 'ocr-modal-mask';
        mask.innerHTML = `
            <div class="ocr-modal">
                <div class="ocr-modal-header">批量删除订单缓存 <span class="ocr-pill">DELETE</span></div>
                <div class="ocr-modal-body">
                    <div class="ocr-row">
                        <label>租户ID</label>
                        <input id="ocr-tenant" class="ocr-input" value="${DEFAULT_TENANT_ID}" />
                    </div>
                    <div class="ocr-row">
                        <label>订单号</label>
                        <textarea id="ocr-orders" class="ocr-textarea" placeholder="支持逗号、换行分隔多个订单号"></textarea>
                    </div>
                    <div class="ocr-hint">
                        示例：1234567890, 2234567890 或 每行一个订单号
                    </div>
                    <div class="ocr-row">
                        <span class="ocr-kv">
                            <span class="ocr-badge">接口</span>
                            <code>${API_BASE}/cache/order/remove/{orderNo}</code>
                        </span>
                    </div>
                    <div class="ocr-log" id="ocr-log"></div>
                </div>
                <div class="ocr-modal-footer">
                    <button class="ocr-btn ocr-btn-ghost" id="ocr-close">关闭</button>
                    <button class="ocr-btn ocr-btn-danger" id="ocr-clear">清空</button>
                    <button class="ocr-btn ocr-btn-primary" id="ocr-run">执行</button>
                </div>
            </div>
        `;
        document.body.appendChild(mask);

        const elTenant = mask.querySelector('#ocr-tenant');
        const elOrders = mask.querySelector('#ocr-orders');
        const elLog = mask.querySelector('#ocr-log');
        const elClose = mask.querySelector('#ocr-close');
        const elClear = mask.querySelector('#ocr-clear');
        const elRun = mask.querySelector('#ocr-run');

        elClose.onclick = () => mask.remove();
        elClear.onclick = () => { elOrders.value = ''; elLog.textContent = ''; };

        elRun.onclick = async () => {
            const tenantId = (elTenant.value || '').trim() || DEFAULT_TENANT_ID;
            let raw = (elOrders.value || '').trim();
            if (!raw) {
                toast('请输入订单号', true);
                return;
            }
            const orderNos = raw
                .split(/[\n,，]+/g)
                .map(s => s.trim())
                .filter(s => s.length > 0);

            if (orderNos.length === 0) {
                toast('未解析到有效订单号', true);
                return;
            }

            elRun.disabled = true;
            let ok = 0, fail = 0;
            log(elLog, `开始执行，共 ${orderNos.length} 个订单…`);

            // 顺序执行，避免并发过大
            for (const orderNo of orderNos) {
                const url = `${API_BASE}/cache/order/remove/${encodeURIComponent(orderNo)}`;
                try {
                    const { status, responseText } = await gmDelete(url, {
                        'accept': '*/*',
                        'x-tenant-id': tenantId
                    });
                    if (status >= 200 && status < 300) {
                        ok++;
                        log(elLog, `✔ [${status}] ${orderNo}`);
                    } else {
                        fail++;
                        log(elLog, `✖ [${status}] ${orderNo} -> ${safeMsg(responseText)}`);
                    }
                } catch (e) {
                    fail++;
                    log(elLog, `✖ [ERR] ${orderNo} -> ${e && e.message ? e.message : '请求失败'}`);
                }
            }

            log(elLog, `完成：成功 ${ok}，失败 ${fail}`);
            toast(`完成：成功 ${ok}，失败 ${fail}`);
            elRun.disabled = false;
        };
    }

    function log(box, text) {
        const time = new Date().toLocaleTimeString();
        box.textContent += `[${time}] ${text}\n`;
        box.scrollTop = box.scrollHeight;
    }

    function safeMsg(msg) {
        if (!msg) return '';
        if (typeof msg !== 'string') return JSON.stringify(msg);
        return msg.length > 400 ? msg.slice(0, 400) + '…' : msg;
    }

    function toast(message, isError) {
        const div = document.createElement('div');
        div.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 100001;
            background: ${isError ? '#ef4444' : '#10b981'}; color: #fff;
            padding: 8px 12px; border-radius: 6px; font-size: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,.2);
        `;
        div.textContent = message;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 2500);
    }

    // 使用 GM_xmlhttpRequest 发 DELETE，绕过 CORS
    function gmDelete(url, headers) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'DELETE',
                url,
                headers,
                onload: function (res) {
                    resolve({ status: res.status, responseText: res.responseText });
                },
                onerror: function (err) {
                    reject(new Error('network error'));
                },
                ontimeout: function () {
                    reject(new Error('timeout'));
                }
            });
        });
    }

    // 首次进入判断
    onRouteReady();
    // 监听 hash 路由变化
    window.addEventListener('hashchange', onRouteReady, false);
})();