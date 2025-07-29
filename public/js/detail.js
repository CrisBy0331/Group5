const lang = (new URLSearchParams(window.location.search).get('lang') || 'zh');

const TEXT = {
    zh: {
        title: '投资产品持仓详情',
        typeFilter: '筛选类型：',
        sortField: '排序字段：',
        sortOrder: '顺序：',
        sortFields: [
            { value: 'time', label: '添加时间' },
            { value: 'amount', label: '持有金额' },
            { value: 'profit', label: '收益率' },
            { value: 'quantity', label: '持有数量' }
        ],
        sortOrders: { desc: '倒序', asc: '正序' },
        all: '全部',
        summary: [
            '持仓总金额：<b>¥{amount}</b>',
            '平均收益率：<b>{profit}%</b>',
            '持仓数量：<b>{count}</b>'
        ],
        fields: {
            name: '{name} <small>({type})</small>',
            code: '{code}',
            time: '添加时间: {time}',
            quantity: '持有数量: {quantity}',
            buyPrice: '买入价: {buyPrice}',
            currentPrice: '当前价: {currentPrice}',
            amount: '持有金额: ¥{amount}',
            profit: '收益率: {profit}%'
        },
        chartLabel: '走势'
    },
    en: {
        title: 'Portfolio Holdings Details',
        typeFilter: 'Type Filter:',
        sortField: 'Sort By:',
        sortOrder: 'Order:',
        sortFields: [
            { value: 'time', label: 'Date Added' },
            { value: 'amount', label: 'Amount' },
            { value: 'profit', label: 'Profit Rate' },
            { value: 'quantity', label: 'Quantity' }
        ],
        sortOrders: { desc: 'Descending', asc: 'Ascending' },
        all: 'All',
        summary: [
            'Total Amount: <b>¥{amount}</b>',
            'Average Profit Rate: <b>{profit}%</b>',
            'Holdings Count: <b>{count}</b>'
        ],
        fields: {
            name: '{name} <small>({type})</small>',
            code: '{code}',
            time: 'Date Added: {time}',
            quantity: 'Quantity: {quantity}',
            buyPrice: 'Buy Price: {buyPrice}',
            currentPrice: 'Current Price: {currentPrice}',
            amount: 'Amount: ¥{amount}',
            profit: 'Profit Rate: {profit}%'
        },
        chartLabel: 'Trend'
    }
};

let holdings = []; // 声明 holdings 变量，用于存储从后端获取的数据

// 动态生成类型筛选选项
function renderTypeFilter() {
    // 确保 holdings 数组已经填充
    if (holdings.length === 0) return;

    const types = Array.from(new Set(holdings.map(h => h.type[lang])));
    const select = document.getElementById('type-filter');
    select.innerHTML = `<option value="all">${TEXT[lang].all}</option>` +
        types.map(t => `<option value="${t}">${t}</option>`).join('');
}

// 获取筛选后的持仓
function getFilteredHoldings(type) {
    if (type === 'all') return holdings;
    return holdings.filter(h => h.type[lang] === type);
}

// 渲染总览统计
function renderSummary(filtered) {
    const totalAmount = filtered.reduce((sum, h) => sum + h.amount, 0);
    const avgProfit = filtered.length
        ? (filtered.reduce((sum, h) => sum + h.profit, 0) / filtered.length).toFixed(2)
        : 0;
    document.getElementById('portfolio-summary').innerHTML =
        TEXT[lang].summary.map((tpl, i) =>
            tpl.replace('{amount}', totalAmount)
            .replace('{profit}', avgProfit)
            .replace('{count}', filtered.length)
        ).join('<div style="margin-right:32px;display:inline-block"></div>');
}

// 排序持仓
function sortHoldings(arr, field, order) {
    let sorted = arr.slice();
    if (field === 'time') {
        sorted.sort((a, b) => new Date(a.time) - new Date(b.time));
    } else {
        sorted.sort((a, b) => a[field] - b[field]);
    }
    if (order === 'desc') sorted.reverse();
    return sorted;
}

// 渲染类别时根据 type 字段动态添加对应的类别 class
function getTypeClass(typeEn) {
    switch (typeEn.toLowerCase()) {
        case 'stock': return 'holding-type-stock';
        case 'fund': return 'holding-type-fund';
        case 'bond': return 'holding-type-bond';
        case 'gold': return 'holding-type-gold';
        case 'currency': return 'holding-type-currency';
        case 'real estate': return 'holding-type-realestate';
        case 'cash': return 'holding-type-cash'; // Add cash type
        default: return '';
    }
}

// 新增：渲染自定义类型筛选菜单
function renderTypeFilterCustom() {
    // 确保 holdings 数组已经填充
    if (holdings.length === 0) return;

    const types = Array.from(new Set(holdings.map(h => h.type[lang])));
    const select = document.getElementById('type-filter');
    select.style.display = 'none';

    // 确保没有重复的自定义菜单
    if (document.querySelector('.type-filter-dropdown-wrapper')) {
        document.querySelector('.type-filter-dropdown-wrapper').remove();
    }

    // 创建自定义下拉菜单
    const wrapper = document.createElement('div');
    wrapper.className = 'type-filter-dropdown-wrapper';
    wrapper.innerHTML = `
        <div class="type-filter-dropdown-selected" id="type-filter-selected">
            <span class="type-dot type-dot-all"></span>${TEXT[lang].all}
            <span class="type-filter-arrow">&#9662;</span>
        </div>
        <div class="type-filter-dropdown-list" id="type-filter-list" style="display:none;">
            <div class="type-filter-option" data-value="all">
                <span class="type-dot type-dot-all"></span>${TEXT[lang].all}
            </div>
            ${types.map(type => {
                const holdingOfType = holdings.find(h => h.type[lang] === type);
                const typeEn = holdingOfType ? holdingOfType.type.en : ''; // Fallback if type not found
                const typeClass = getTypeClass(typeEn);
                return `<div class="type-filter-option" data-value="${type}">
                    <span class="type-dot ${typeClass}"></span>${type}
                </div>`;
            }).join('')}
        </div>
    `;
    select.parentNode.insertBefore(wrapper, select);

    // 下拉菜单交互
    const selected = wrapper.querySelector('#type-filter-selected');
    const list = wrapper.querySelector('#type-filter-list');
    selected.onclick = function(e) {
        e.stopPropagation();
        list.style.display = list.style.display === 'none' ? 'block' : 'none';
    };
    document.addEventListener('click', () => { list.style.display = 'none'; });

    // 选项点击
    list.querySelectorAll('.type-filter-option').forEach(opt => {
        opt.onclick = function(e) {
            e.stopPropagation();
            const value = this.getAttribute('data-value');
            select.value = value;
            selected.innerHTML = this.innerHTML + '<span class="type-filter-arrow">&#9662;</span>';
            list.style.display = 'none';
            renderHoldings(
                value,
                document.getElementById('sort-field').value,
                document.getElementById('sort-order').value
            );
            // 高亮选中
            list.querySelectorAll('.type-filter-option').forEach(o => o.classList.remove('active'));
            this.classList.add('active');
        };
    });
    // 默认高亮第一个
    list.querySelector('.type-filter-option[data-value="' + select.value + '"]').classList.add('active');
    selected.innerHTML = list.querySelector('.type-filter-option[data-value="' + select.value + '"]').innerHTML + '<span class="type-filter-arrow">&#9662;</span>';
}


// 渲染排序字段
function renderSortFields() {
    const sortFieldSelect = document.getElementById('sort-field');
    sortFieldSelect.innerHTML = TEXT[lang].sortFields.map(
        f => `<option value="${f.value}">${f.label}</option>`
    ).join('');
    document.getElementById('sort-field-label').innerText = TEXT[lang].sortField;
    document.getElementById('sort-order-label').innerText = TEXT[lang].sortOrder;
    document.getElementById('type-filter-label').innerText = TEXT[lang].typeFilter;
    document.getElementById('sort-order').options[0].text = TEXT[lang].sortOrders.desc;
    document.getElementById('sort-order').options[1].text = TEXT[lang].sortOrders.asc;
}


// 渲染持仓列表
function renderHoldings(type = 'all', sortField = 'time', sortOrder = 'desc') {
    const filtered = getFilteredHoldings(type);
    const sorted = sortHoldings(filtered, sortField, sortOrder);
    renderSummary(sorted);
    const list = document.getElementById('holdings-list');
    list.innerHTML = ''; // 清空现有列表
    if (sorted.length === 0) {
        list.innerHTML = `<p style="text-align: center; color: #888; padding: 20px;">${lang === 'zh' ? '没有找到符合条件的持仓数据。' : 'No holdings found for the selected criteria.'}</p>`;
        return;
    }
    sorted.forEach(h => {
        const typeClass = getTypeClass(h.type.en);
        const card = document.createElement('div');
        card.className = 'holding-card';
        card.innerHTML = `
            <div class="holding-header" data-id="${h.id}">
                <div class="holding-info-row">
                    <img src="${h.logo}" alt="logo" class="holding-logo"/>
                    <div class="holding-namebox">
                        <span class="holding-name">${h.name[lang]}</span>
                        <span class="holding-code">${TEXT[lang].fields.code.replace('{code}', h.code)}</span>
                        <span class="holding-type ${typeClass}">${h.type[lang]}</span>
                    </div>
                </div>
                <div class="holding-center">
                    <span class="holding-time">${TEXT[lang].fields.time.replace('{time}', h.time)}</span>
                    <span class="holding-quantity">${TEXT[lang].fields.quantity.replace('{quantity}', h.quantity)}</span>
                    <span class="holding-buyprice">${TEXT[lang].fields.buyPrice.replace('{buyPrice}', h.buyPrice)}</span>
                    <span class="holding-currentprice">${TEXT[lang].fields.currentPrice.replace('{currentPrice}', h.currentPrice)}</span>
                </div>
                <div class="holding-values">
                    <span class="holding-amount">${TEXT[lang].fields.amount.replace('{amount}', h.amount)}</span>
                    <span class="holding-profit ${h.profit >= 0 ? 'profit-positive' : 'profit-negative'}">
                        ${TEXT[lang].fields.profit.replace('{profit}', h.profit)}
                    </span>
                </div>
            </div>
            <div class="trend-container" id="trend-${h.id}">
                <canvas id="chart-${h.id}"></canvas>
            </div>
        `;
        list.appendChild(card);
    });
    // 每次渲染后重新绑定事件
    bindEvents();
}

// 绑定事件
function bindEvents() {
    // 绑定持仓卡片点击事件（展开/收起图表）
    document.querySelectorAll('.holding-header').forEach(header => {
        // 先移除旧的事件监听器以避免重复绑定
        header.onclick = null;
        header.onclick = function() {
            const id = this.getAttribute('data-id');
            const trend = document.getElementById(`trend-${id}`);

            // 关闭所有其他图表
            document.querySelectorAll('.trend-container').forEach(c => {
                if (c.id !== `trend-${id}`) { // 只关闭不是当前点击的图表
                    c.classList.remove('active');
                }
            });

            // 切换当前点击图表的显示状态
            const wasActive = trend.classList.contains('active');
            if (!wasActive) {
                trend.classList.add('active');
                drawChart(id);
            } else {
                trend.classList.remove('active');
                // 可选：销毁图表实例以释放内存
                if (window[`chart${id}`]) {
                    window[`chart${id}`].destroy();
                    delete window[`chart${id}`];
                }
            }
        };
    });

    // 绑定排序字段和顺序的选择事件
    document.getElementById('sort-field').onchange = function() {
        renderHoldings(
            document.getElementById('type-filter').value,
            this.value,
            document.getElementById('sort-order').value
        );
    };
    document.getElementById('sort-order').onchange = function() {
        renderHoldings(
            document.getElementById('type-filter').value,
            document.getElementById('sort-field').value,
            this.value
        );
    };
    // 自定义类型筛选菜单的事件绑定在 renderTypeFilterCustom 中处理
}

// 绘制图表
function drawChart(id) {
    const h = holdings.find(x => x.id == id);
    // 这里检查 h.chart 是否存在，因为后端可能没有提供完整图表数据
    if (!h || !h.chart || !h.chart.data || h.chart.data.length === 0) {
        console.warn(`图表数据未找到或为空，ID: ${id}`);
        const trendContainer = document.getElementById(`trend-${id}`);
        if (trendContainer) {
            trendContainer.innerHTML = `<p style="text-align: center; color: #888; padding: 20px;">${lang === 'zh' ? '图表数据不可用。' : 'Chart data not available.'}</p>`;
        }
        return;
    }

    const ctx = document.getElementById(`chart-${id}`);
    if (!ctx) {
        console.error(`无法找到 canvas 元素 ID: chart-${id}`);
        return;
    }

    // 销毁旧图表实例（如果存在）
    if (window[`chart${id}`]) {
        window[`chart${id}`].destroy();
        delete window[`chart${id}`];
    }

    window[`chart${id}`] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: h.chart.labels[lang],
            datasets: [{
                label: h.name[lang] + ' ' + TEXT[lang].chartLabel,
                data: h.chart.data,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.2)', // 轻微透明的背景
                tension: 0.3, // 曲线张力
                fill: true, // 填充图表下方区域
                pointRadius: 3, // 点的半径
                pointBackgroundColor: '#3498db', // 点的颜色
                pointBorderColor: '#fff', // 点的边框颜色
                pointHoverRadius: 5, // 鼠标悬停时点的半径
                borderWidth: 2 // 线条宽度
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // 允许图表宽度根据父容器调整
            scales: {
                x: {
                    grid: {
                        display: false // 隐藏X轴网格线
                    }
                },
                y: {
                    beginAtZero: false,
                    grid: {
                        color: '#eee' // Y轴网格线颜色
                    }
                }
            },
            plugins: {
                legend: {
                    display: false // 不显示图例
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#3498db',
                    borderWidth: 1,
                    cornerRadius: 5
                }
            }
        }
    });
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => { // 确保函数是 async
    document.getElementById('page-title').innerText = TEXT[lang].title;
    renderSortFields(); // 确保排序字段先渲染，以便获取其值

    try {
        // *** 关键修改: 从后端 API 获取数据 ***
        // 假设您有一个用户ID，例如 1。在实际应用中，用户ID会通过登录状态或其他方式获取。
        const response = await fetch('/api/holdings/1'); 
        if (!response.ok) {
            throw new Error(`HTTP 错误! 状态码: ${response.status}`);
        }
        holdings = await response.json(); // 将获取到的数据赋值给 holdings

        // 数据可用后，渲染所有内容
        renderTypeFilter();
        renderTypeFilterCustom(); // 新增自定义菜单
        renderHoldings(); // 首次渲染持仓列表
        // bindEvents() 会在 renderHoldings 内部调用
    } catch (error) {
        console.error('获取持仓数据出错:', error);
        document.getElementById('holdings-list').innerHTML = `<p style="text-align: center; color: red;">${lang === 'zh' ? '加载投资数据失败。请检查后端服务。' : 'Failed to load investment data. Please check the backend service.'}</p>`;
    }
});

// 切换语言函数（保持不变）
function switchLang(newLang) {
    const url = new URL(window.location.href);
    url.searchParams.set('lang', newLang);
    window.location.href = url.toString();
}