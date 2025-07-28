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

const holdings = [
    {
        id: 1,
        name: { zh: '贵州茅台', en: 'Kweichow Moutai' },
        code: '600519',
        type: { zh: '股票', en: 'Stock' },
        logo: 'logos/moutai.png',
        amount: 50000,
        quantity: 100,
        buyPrice: 1750,
        currentPrice: 2000,
        profit: 15.6,
        time: '2024-05-01',
        chart: {
            labels: { zh: ['1月', '2月', '3月', '4月', '5月', '6月'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] },
            data: [1800, 1850, 1900, 1850, 1950, 2000]
        }
    },
    {
        id: 2,
        name: { zh: '华夏创新基金', en: 'China Innovation Fund' },
        code: '000001',
        type: { zh: '基金', en: 'Fund' },
        logo: 'logos/huaxia.png',
        amount: 30000,
        quantity: 200,
        buyPrice: 1.52,
        currentPrice: 1.47,
        profit: -2.3,
        time: '2024-04-15',
        chart: {
            labels: { zh: ['1月', '2月', '3月', '4月', '5月', '6月'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] },
            data: [1.5, 1.48, 1.45, 1.47, 1.46, 1.47]
        }
    },
    {
        id: 3,
        name: { zh: '国债', en: 'Government Bond' },
        code: '019666',
        type: { zh: '债券', en: 'Bond' },
        logo: 'logos/bond.png',
        amount: 100000,
        quantity: 50,
        buyPrice: 99.8,
        currentPrice: 103.2,
        profit: 3.2,
        time: '2024-03-20',
        chart: {
            labels: { zh: ['1月', '2月', '3月', '4月', '5月', '6月'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] },
            data: [100, 101, 102, 102.5, 103, 103.2]
        }
    },
    {
        id: 4,
        name: { zh: '黄金ETF', en: 'Gold ETF' },
        code: '518880',
        type: { zh: '黄金', en: 'Gold' },
        logo: 'logos/gold.png',
        amount: 20000,
        quantity: 10,
        buyPrice: 3.7,
        currentPrice: 4.3,
        profit: 8.1,
        time: '2024-05-10',
        chart: {
            labels: { zh: ['1月', '2月', '3月', '4月', '5月', '6月'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] },
            data: [3.8, 3.9, 4.0, 4.1, 4.2, 4.3]
        }
    },
    {
        id: 5,
        name: { zh: '美元理财', en: 'USD Wealth' },
        code: 'USD001',
        type: { zh: '货币', en: 'Currency' },
        logo: 'logos/usd.png',
        amount: 15000,
        quantity: 500,
        buyPrice: 1.00,
        currentPrice: 1.04,
        profit: 1.2,
        time: '2024-02-28',
        chart: {
            labels: { zh: ['1月', '2月', '3月', '4月', '5月', '6月'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] },
            data: [1.00, 1.01, 1.02, 1.01, 1.03, 1.04]
        }
    },
    {
        id: 6,
        name: { zh: '商业地产信托', en: 'Commercial REIT' },
        code: 'REIT001',
        type: { zh: '房地产', en: 'Real Estate' },
        logo: 'logos/reit.png',
        amount: 80000,
        quantity: 5,
        buyPrice: 9.8,
        currentPrice: 11,
        profit: 5.5,
        time: '2024-04-01',
        chart: {
            labels: { zh: ['1月', '2月', '3月', '4月', '5月', '6月'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'] },
            data: [10, 10.2, 10.5, 10.7, 10.8, 11]
        }
    }
];

// 动态生成类型筛选选项
function renderTypeFilter() {
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
        default: return '';
    }
}

// 新增：渲染自定义类型筛选菜单
function renderTypeFilterCustom() {
    const types = Array.from(new Set(holdings.map(h => h.type[lang])));
    const select = document.getElementById('type-filter');
    select.style.display = 'none';

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
                const typeEn = holdings.find(h => h.type[lang] === type).type.en;
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

// 渲染持仓
function renderHoldings(type = 'all', sortField = 'time', sortOrder = 'desc') {
    const filtered = getFilteredHoldings(type);
    const sorted = sortHoldings(filtered, sortField, sortOrder);
    renderSummary(sorted);
    const list = document.getElementById('holdings-list');
    list.innerHTML = '';
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
    bindEvents();
}

// 绑定事件
function bindEvents() {
    document.querySelectorAll('.holding-header').forEach(header => {
        header.onclick = function() {
            const id = this.getAttribute('data-id');
            document.querySelectorAll('.trend-container').forEach(c => c.classList.remove('active'));
            const trend = document.getElementById(`trend-${id}`);
            const wasActive = trend.classList.contains('active');
            if (!wasActive) {
                trend.classList.add('active');
                drawChart(id);
            }
        };
    });
    document.getElementById('type-filter').onchange = function() {
        renderHoldings(
            this.value,
            document.getElementById('sort-field').value,
            document.getElementById('sort-order').value
        );
    };
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
}

// 绘制图表
function drawChart(id) {
    const h = holdings.find(x => x.id == id);
    const ctx = document.getElementById(`chart-${id}`).getContext('2d');
    if (window[`chart${id}`]) window[`chart${id}`].destroy();
    window[`chart${id}`] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: h.chart.labels[lang],
            datasets: [{
                label: h.name[lang] + ' ' + TEXT[lang].chartLabel,
                data: h.chart.data,
                borderColor: '#3498db',
                backgroundColor: 'rgba(52,152,219,0.08)',
                tension: 0.18,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: false } }
        }
    });
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

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('page-title').innerText = TEXT[lang].title;
    renderTypeFilter();
    renderTypeFilterCustom(); // 新增自定义菜单
    renderSortFields();
    renderHoldings();
    bindEvents();
});

// 切换图表显示
function toggleChart(id) {
    const chartContainer = document.getElementById(`chart-${id}`);
    const isActive = chartContainer.classList.contains('active');

    // 关闭所有其他图表
    document.querySelectorAll('.chart-container').forEach(container => {
        container.classList.remove('active');
    });

    if (!isActive) {
        chartContainer.classList.add('active');
        // 添加小延迟确保容器展开动画完成
        setTimeout(() => {
            const holding = holdings.find(h => h.id === id);
            createChart(`canvas-${id}`, holding.chartData);
        }, 50);
    }
}

